// app/api/teams/[id]/route.ts
import { NextRequest } from "next/server";
import { connectDB } from "@/lib/db";
import { updateTeam, deleteTeam } from "@/services/team.service";
import { successResponse, errorResponse } from "@/utils/response";

export async function PUT(
  request: NextRequest,
  context: {
    params: Promise<{
      id: string;
    }>;
  },
) {
  try {
    await connectDB();

    const body = await request.json();
    const { id } = await context.params;
    const team = await updateTeam(id, body);

    return successResponse(team, "Team updated");
  } catch (error) {
    return errorResponse("Update failed", 500);
  }
}

export async function DELETE(
  request: NextRequest,
  context: {
    params: Promise<{ id: string }>;
  },
) {
  try {
    await connectDB();

    const { id } = await context.params;
    await deleteTeam(id);

    return successResponse(null, "Team deleted");
  } catch (error) {
    return errorResponse("Delete failed", 500);
  }
}
