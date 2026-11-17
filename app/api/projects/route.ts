// app/api/projects/route.ts
import { NextRequest } from "next/server";
import { connectDB } from "@/lib/db";
import { createProject, getProjects } from "@/services/project.service";
import { successResponse, errorResponse } from "@/utils/response";
import { requireSession } from "@/lib/session";
import { getWorkspaceMembership, canWriteWorkspace } from "@/lib/authorization";

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

    const project = await createProject({
      name: body.name,
      description: body.description,
      workspace: body.workspace,
    });

    return successResponse(project, "Project created");
  } catch (error) {
    return errorResponse("Server error ", 500);
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

    const projects = await getProjects(workspace);

    return successResponse(projects);
  } catch (error) {
    return errorResponse("Server error", 500);
  }
}
