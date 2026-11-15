// app/api/teams/route.ts
import { NextRequest } from "next/server";
import { connectDB } from "@/lib/db";
import { createTeam, getTeams } from "@/services/team.service";
import { successResponse, errorResponse } from "@/utils/response";
import { requireAuth } from "@/lib/auth";
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
    const auth = await requireAuth(request);
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
    return errorResponse(
      "Server error",

      500,
    );
  }
}

export async function GET(request: NextRequest) {
  try {
    const auth = await requireAuth(request);
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

    const teams = await getTeams(workspace);

    return successResponse(teams);
  } catch (error) {
    return errorResponse(
      "Server error",

      500,
    );
  }
}
