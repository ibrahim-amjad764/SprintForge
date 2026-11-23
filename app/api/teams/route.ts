// app/api/teams/route.ts
import { NextRequest } from "next/server";
import { connectDB } from "@/lib/db";
import { createTeam, getTeams, getTeamsPaginated } from "@/services/team.service";
import { parsePaginationParams } from "@/lib/pagination";
import { successResponse, errorResponse } from "@/utils/response";
import { apiError } from "@/utils/error-handler";
import { requireSession } from "@/lib/session";
import { getWorkspaceMembership, canWriteWorkspace } from "@/lib/authorization";

/*
 Teams API

 POST
 Create team
 
 GET
 Get workspace teams
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

    const team = await createTeam({
      name: body.name,

      description: body.description,

      workspace: body.workspace,
    });

    return successResponse(
      team,

      "Team created",
    );
  } catch (error) {
    return apiError(error, "Server error");
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
      return errorResponse("Workspace required");
    }

    // IDOR: user must be a member of the workspace
    if (!(await getWorkspaceMembership(workspace, userId))) {
      return errorResponse("Forbidden", 403);
    }

    // Opt-in pagination — same contract as /api/tasks and /api/projects.
    if (request.nextUrl.searchParams.has("page") || request.nextUrl.searchParams.has("limit")) {
      const parsed = parsePaginationParams(request.nextUrl.searchParams);
      if ("error" in parsed) {
        return errorResponse(parsed.error, 400);
      }
      const result = await getTeamsPaginated(
        workspace,
        parsed,
        request.nextUrl.searchParams.get("search") ?? undefined,
      );
      return successResponse(result);
    }

    const teams = await getTeams(workspace);

    return successResponse(teams);
  } catch (error) {
    return apiError(error, "Server error");
  }
}
