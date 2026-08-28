// services/project.service.ts

import Project from "@/models/Project";
import Task from "@/models/Task";

/*
 Project Service
 Database logic layer.
*/

export async function createProject(data: {
  name: string;
  description?: string;
  workspace: string;
}) {
  return Project.create({
    name: data.name,
    description: data.description,
    workspace: data.workspace,
  });
}

export async function getProjects(workspace: string) {
  return Project.find({ workspace });
}

export async function getProjectsWithProgress(workspace: string) {
  const projects = await Project.find({ workspace });
  
  // Calculate progress for each project
  const projectsWithProgress = await Promise.all(
    projects.map(async (project) => {
      const totalTasks = await Task.countDocuments({ project: project._id });
      const completedTasks = await Task.countDocuments({ 
        project: project._id, 
        status: 'COMPLETED' 
      });
      
      const progressPercentage = totalTasks > 0 
        ? Math.round((completedTasks / totalTasks) * 100) 
        : 0;
      
      const status = progressPercentage === 100 ? 'COMPLETED' : 'ACTIVE';

      return {
        ...project.toObject(),
        progress: progressPercentage,
        status: status,
      };
    })
  );

  return projectsWithProgress;
}

export async function getProjectById(id: string) {
  return Project.findById(id);
}

export async function getProjectWithProgress(id: string) {
  const project = await Project.findById(id);
  if (!project) return null;

  // Step A: Count all tasks for this project
  const totalTasks = await Task.countDocuments({ project: id });

  // Step B: Count completed tasks
  const completedTasks = await Task.countDocuments({ 
    project: id, 
    status: 'COMPLETED' 
  });

  // Step C: Calculate progress percentage
  const progressPercentage = totalTasks > 0 
    ? Math.round((completedTasks / totalTasks) * 100) 
    : 0;

  // Step D: Determine status based on progress
  const status = progressPercentage === 100 ? 'COMPLETED' : 'ACTIVE';

  return {
    ...project.toObject(),
    progress: progressPercentage,
    status: status,
  };
}

export async function updateProject(id: string, data: any) {
  return Project.findByIdAndUpdate(id, data, { new: true });
}

export async function unarchiveProject(id: string) {
  const project = await Project.findById(id);
  if (!project) return null;

  // Calculate progress to determine correct status
  const totalTasks = await Task.countDocuments({ project: id });
  const completedTasks = await Task.countDocuments({ 
    project: id, 
    status: 'COMPLETED' 
  });
  
  const progressPercentage = totalTasks > 0 
    ? Math.round((completedTasks / totalTasks) * 100) 
    : 0;
  
  // Set status based on progress
  const status = progressPercentage === 100 ? 'COMPLETED' : 'ACTIVE';

  return Project.findByIdAndUpdate(
    id, 
    { status }, 
    { new: true }
  );
}

export async function deleteProject(id: string) {
  return Project.findByIdAndDelete(id);
}
