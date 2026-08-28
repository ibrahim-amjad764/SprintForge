// services/calendar.service.ts

import Task from '@/models/Task';

/*
Calendar Data Service
Convert tasks into calendar events
*/

export async function getCalendarTasks(project: string) {
  return Task.find({
    project,
    dueDate: {
      $exists: true,
    },
  });
}
