// app/api/projects/[id]/route.ts
import { NextRequest } from "next/server";
import { connectDB } from "@/lib/db";
import { updateProject, deleteProject, unarchiveProject } from "@/services/project.service";
import { successResponse, errorResponse } from "@/utils/response";
import { requireSession } from "@/lib/session";
import { getMembershipForProject, canWriteWorkspace } from "@/lib/authorization";
import { revalidatePath } from "next/cache";
import { apiError } from '@/utils/error-handler';

export async function PUT(request: NextRequest, context: { params: Promise<{ id: string }> }) {
    try {
        const auth = await requireSession(request);
        if (auth.response) return auth.response;
        const userId = auth.user.userId;

        await connectDB();

        const body = await request.json();
        const { id } = await context.params;

        // IDOR+RBAC: write-capable member of the project's workspace
        const membership = await getMembershipForProject(id, userId);
        if (!membership || !canWriteWorkspace(membership.role)) {
            return errorResponse("Forbidden", 403);
        }

        // Use unarchiveProject if unarchiving
        if (body.status === 'active' && body.unarchive) {
            const project = await unarchiveProject(id);
            
            // Revalidate projects list
            revalidatePath('/workspace/*/projects');
            
            return successResponse(project, "Project unarchived");
        }
        
        const project = await updateProject(id, body);
        
        // Revalidate projects list
        revalidatePath('/workspace/*/projects');

        return successResponse(project, "Project updated");
    }
    catch (error) {
    return apiError(error, 'Update failed');
  }
}

export async function DELETE(request: NextRequest, context: { params: Promise<{ id: string }> }) {
    try {
        const auth = await requireSession(request);
        if (auth.response) return auth.response;
        const userId = auth.user.userId;

        await connectDB();
        const { id } = await context.params;

        // IDOR+RBAC: write-capable member of the project's workspace
        const membership = await getMembershipForProject(id, userId);
        if (!membership || !canWriteWorkspace(membership.role)) {
            return errorResponse("Forbidden", 403);
        }

        await deleteProject(id);
        
        // Revalidate projects list
        revalidatePath('/workspace/*/projects');
        
        return successResponse(null, "Project deleted");
    }
    catch (error) {
    return apiError(error, 'Delete failed');
  }
}