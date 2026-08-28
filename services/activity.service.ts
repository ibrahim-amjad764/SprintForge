// services/activity.service.ts

import Activity from '@/models/Activity';

export async function createActivity(data: any) {
  return Activity.create(data);
}

export async function getActivities(task: string) {
  return Activity.find({ task }).populate('user').sort({ createdAt: -1 });
}

