// app/api/projects/route.ts
import { NextRequest } from "next/server";
import { connectDB } from "@/lib/db";
import Project from "@/models/Project";
import {
  createProject,
  getProjects,
  getProjectsPaginated,
} from "@/services/project.service";
import { parsePaginationParams } from "@/lib/pagination";
import { assertPlanLimit } from "@/services/billing.service";
import { successResponse, errorResponse } from "@/utils/response";
import { requireSession } from "@/lib/session";
import { getWorkspaceMembership, canWriteWorkspace } from "@/lib/authorization";
import { apiError } from '@/utils/error-handler';

/*
Projects API

.POST
Create project
.GET
Get workspace projects
*/

export async function POST(request: NextRequest) {
  try {
    const auth = await requireSession(request);
    if (auth.response) return auth.response;
    const userId = auth.user.userId;

    await connectDB();
    const body = await request.json();

    // IDOR+RBAC: write-capable member of the target workspace
    const membership = await getWorkspaceMembership(String(body.workspace), userId);
    if (!membership || !canWriteWorkspace(membership.role)) {
      return errorResponse("Forbidden", 403);
    }

    // Plan enforcement: workspace project cap (FREE/PRO/TEAM).
    const projectCount = await Project.countDocuments({ workspace: body.workspace });
    const planCheck = await assertPlanLimit({
      userId,
      workspaceId: body.workspace,
      resource: "projects",
      currentCount: projectCount,
    });
    if (!planCheck.ok) {
      return errorResponse(planCheck.error, planCheck.status, planCheck.code);
    }

    const project = await createProject({
      name: body.name,
      description: body.description,
      workspace: body.workspace,
    });

    return successResponse(project, "Project created");
  } catch (error) {
    return apiError(error, 'Server error ');
  }
}

export async function GET(request: NextRequest) {
  try {
    const auth = await requireSession(request);
    if (auth.response) return auth.response;
    const userId = auth.user.userId;

    await connectDB();
    const workspace = request.nextUrl.searchParams.get("workspace");

    if (!workspace) {
      return errorResponse("workspace required");
    }

    // IDOR: user must be a member of the workspace
    if (!(await getWorkspaceMembership(workspace, userId))) {
      return errorResponse("Forbidden", 403);
    }

    // Opt-in pagination: page/limit → {items,total,page,limit,hasMore};
    // otherwise the legacy full-array response is preserved.
    if (request.nextUrl.searchParams.has("page") || request.nextUrl.searchParams.has("limit")) {
      const parsed = parsePaginationParams(request.nextUrl.searchParams);
      if ("error" in parsed) {
        return errorResponse(parsed.error, 400);
      }
      const result = await getProjectsPaginated(workspace, parsed);
      return successResponse(result);
    }

    const projects = await getProjects(workspace);

    return successResponse(projects);
  } catch (error) {
    return apiError(error, 'Server error');
  }
}
