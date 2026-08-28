// services/search.service.ts
import Task from '@/models/Task';
import Project from '@/models/Project';
import User from '@/models/User';

/*
Global Search Service

Searches:
Tasks
Projects
Users
*/

export async function globalSearch(query: string) {
  const regex = new RegExp(query, 'i');

  const tasks = await Task.find({
    title: regex,
  }).limit(10);

  const projects = await Project.find({
    name: regex,
  }).limit(10);

  const users = await User.find({
    name: regex,
  }).limit(10);

  return {
    tasks,
    projects,
    users,
  };
}
