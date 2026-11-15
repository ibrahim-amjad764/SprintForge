// app/api/teams/[id]/route.ts
import { NextRequest } from "next/server";
import { connectDB } from "@/lib/db";
import { updateTeam, deleteTeam } from "@/services/team.service";
import { successResponse, errorResponse } from "@/utils/response";
import { requireAuth } from "@/lib/auth";
import { getMembershipForTeam, canWriteWorkspace } from "@/lib/authorization";

export async function PUT(
  request: NextRequest,
  context: {
    params: Promise<{
      id: string;
    }>;
  },
) {
  try {
    const auth = await requireAuth(request);
    if (auth.response) return auth.response;
    const userId = auth.user.userId;

    await connectDB();

    const body = await request.json();
    const { id } = await context.params;

    // IDOR+RBAC: write-capable member of the team's workspace
    const membership = await getMembershipForTeam(id, userId);
    if (!membership || !canWriteWorkspace(membership.role)) {
      return errorResponse("Forbidden", 403);
    }

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
    const auth = await requireAuth(request);
    if (auth.response) return auth.response;
    const userId = auth.user.userId;

    await connectDB();

    const { id } = await context.params;

    // IDOR+RBAC: write-capable member of the team's workspace
    const membership = await getMembershipForTeam(id, userId);
    if (!membership || !canWriteWorkspace(membership.role)) {
      return errorResponse("Forbidden", 403);
    }

    await deleteTeam(id);

    return successResponse(null, "Team deleted");
  } catch (error) {
    return errorResponse("Delete failed", 500);
  }
}
