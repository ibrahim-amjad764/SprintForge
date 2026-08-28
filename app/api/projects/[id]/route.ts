// app/api/projects/[id]/route.ts
import { NextRequest } from "next/server";
import { connectDB } from "@/lib/db";
import { updateProject, deleteProject, unarchiveProject } from "@/services/project.service";
import { successResponse, errorResponse } from "@/utils/response";
import { revalidatePath } from "next/cache";

export async function PUT(request: NextRequest, context: { params: Promise<{ id: string }> }) {
    try {
        await connectDB();

        const body = await request.json();
        const { id } = await context.params;
        
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
        return errorResponse("Update failed", 500);
    }
}

export async function DELETE(request: NextRequest, context: { params: Promise<{ id: string }> }) {
    try {
        await connectDB();
        const { id } = await context.params;
        await deleteProject(id);
        
        // Revalidate projects list
        revalidatePath('/workspace/*/projects');
        
        return successResponse(null, "Project deleted");
    }
    catch (error) {
        return errorResponse("Delete failed", 500);
    }
}