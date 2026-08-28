// services/notification.service.ts

import Notification from '@/models/Notification';

/*
  Central Notification Engine

  All application events use this service.
*/

interface CreateNotificationData {
  user: string;
  type?: string;
  title: string;
  message: string;
  link?: string;
}

export async function createNotification(data: CreateNotificationData) {
  return Notification.create({
    user: data.user,
    type: data.type || 'GENERAL',
    title: data.title,
    message: data.message,
    link: data.link,
  });
}

export async function getUserNotifications(user: string) {
  return Notification.find({ user }).sort({ createdAt: -1 });
}

export async function markRead(id: string) {
  return Notification.findByIdAndUpdate(id, { read: true }, { new: true });
}

export async function markAllAsRead(user: string) {
  return Notification.updateMany(
    { user, read: false },
    { read: true }
  );
}

export async function getUnreadCount(user: string) {
  return Notification.countDocuments({ user, read: false });
}
