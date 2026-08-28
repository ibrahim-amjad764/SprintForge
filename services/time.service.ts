// services/time.service.ts

import TimeEntry from '@/models/TimeEntry';

export async function startTimer(data: any) {
  return TimeEntry.create({
    task: data.task,
    user: data.user,
    startTime: new Date(),
    duration: 0,
  });
}

export async function stopTimer(id: string) {
  const entry = await TimeEntry.findById(id);

  if (!entry) return null;

  const end = new Date();

  const duration = Math.floor(
    (end.getTime() - entry.startTime.getTime()) / 1000
  );

  entry.endTime = end;

  entry.duration = duration;

  await entry.save();

  return entry;
}

export async function getTaskTime(task: string) {
  return TimeEntry.find({ task })

    .populate('user');
}