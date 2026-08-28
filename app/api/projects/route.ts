// app/api/projects/route.ts
import { NextRequest } from "next/server";
import { connectDB } from "@/lib/db";
import { createProject, getProjects } from "@/services/project.service";
import { successResponse, errorResponse } from "@/utils/response";

/*
Projects API

.POST
Create project
.GET
Get workspace projects
*/

export async function POST(request: NextRequest) {
  try {
    await connectDB();
    const body = await request.json();
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
    await connectDB();
    const workspace = request.nextUrl.searchParams.get("workspace");

    if (!workspace) {
      return errorResponse("workspace required");
    }

    const projects = await getProjects(workspace);

    return successResponse(projects);
  } catch (error) {
    return errorResponse("Server error", 500);
  }
}
