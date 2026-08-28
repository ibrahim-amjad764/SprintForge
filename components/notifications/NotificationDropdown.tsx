// components/notification/NotificationDropdown.tsx

'use client';

import { useEffect, useState } from 'react';
import { apiRequest } from '@/lib/api';

export default function NotificationDropdown({ userId }: { userId: string }) {
  const [notifications, setNotifications] = useState<any[]>([]);
  const [isOpen, setIsOpen] = useState(false);
  const [markingAllRead, setMarkingAllRead] = useState(false);

  useEffect(() => {
    async function load() {
      const response = await apiRequest(`/api/notifications?user=${userId}`);
      setNotifications(response.data);
    }
    load();
  }, [userId]);

  async function markAllAsRead() {
    setMarkingAllRead(true);
    try {
      await apiRequest(`/api/notifications/mark-all-read`, {
        method: 'POST',
        body: JSON.stringify({ userId }),
      });
      setNotifications(notifications.map((n) => ({ ...n, read: true })));
    } catch (error) {
      console.error('Failed to mark all as read:', error);
    } finally {
      setMarkingAllRead(false);
    }
  }

  const unreadCount = notifications.filter((n) => !n.read).length;

  return (
    <div className="relative inline-block">
      <button 
        onClick={() => setIsOpen(!isOpen)}
        className="relative rounded border px-4 py-2"
      >
        🔔 Notifications
        {unreadCount > 0 && (
          <span className="absolute -right-1 -top-1 flex h-5 w-5 items-center justify-center rounded-full bg-red-500 text-xs text-white">
            {unreadCount}
          </span>
        )}
      </button>

      {isOpen && (
        <div className="absolute right-0 top-full mt-2 z-50 w-80 rounded border bg-white shadow-lg">
          <div className="flex items-center justify-between border-b p-3">
            <h3 className="font-semibold">Notifications</h3>
            {notifications.length > 0 && (
              <button
                onClick={markAllAsRead}
                disabled={markingAllRead || unreadCount === 0}
                className="text-xs text-blue-600 hover:underline disabled:opacity-50"
              >
                {markingAllRead ? 'Marking...' : 'Mark all as read'}
              </button>
            )}
          </div>
          
          {notifications.length === 0 ? (
            <p className="p-4 text-center text-gray-500">No notifications</p>
          ) : (
            <div className="max-h-96 overflow-y-auto">
              {notifications.map((notification) => (
                <div 
                  key={notification._id} 
                  className={`border-b p-3 ${!notification.read ? 'bg-blue-50' : ''}`}
                >
                  <div className="flex items-start gap-2">
                    {!notification.read && (
                      <div className="mt-1 h-2 w-2 rounded-full bg-blue-500"></div>
                    )}
                    <div className="flex-1">
                      <p className="font-semibold text-sm">{notification.title}</p>
                      <p className="text-sm text-gray-600">{notification.message}</p>
                      <p className="mt-1 text-xs text-gray-400">
                        {new Date(notification.createdAt).toLocaleDateString()}
                      </p>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
