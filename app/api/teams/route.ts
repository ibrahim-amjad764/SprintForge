// app/api/teams/route.ts
import { NextRequest } from "next/server";
import { connectDB } from "@/lib/db";
import { createTeam, getTeams } from "@/services/team.service";
import { successResponse, errorResponse } from "@/utils/response";

/*
 Teams API

 POST
 Create team
 
 GET
 Get workspace teams
*/

export async function POST(request: NextRequest) {
  try {
    await connectDB();

    const body = await request.json();

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
    await connectDB();

    const workspace = request.nextUrl.searchParams.get("workspace");

    if (!workspace) {
      return errorResponse("Workspace required");
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
