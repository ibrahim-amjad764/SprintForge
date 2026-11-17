// components/notifications/NotificationBell.tsx

'use client';

import { useState, useEffect } from 'react';
import { apiRequest } from '@/lib/api';
import useSocket from '@/hooks/useSocket';

const PAGE_SIZE = 20;

export default function NotificationBell({ userId }: { userId: string }) {
  const [notifications, setNotifications] = useState<any[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [isOpen, setIsOpen] = useState(false);
  const [page, setPage] = useState(1);
  const [hasMore, setHasMore] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  const socket = useSocket();

  useEffect(() => {
    fetchNotifications();
    fetchUnreadCount();
  }, [userId]);

  useEffect(() => {
    if (!socket) return;

    socket.on('notification:new', (data: any) => {
      setNotifications((prev) => [data, ...prev]);
      setUnreadCount((prev) => prev + 1);
    });

    socket.on('notification:read', (data: any) => {
      setNotifications((prev) =>
        prev.map((n) => (n._id === data._id ? { ...n, read: true } : n))
      );
      setUnreadCount((prev) => Math.max(0, prev - 1));
    });

    return () => {
      socket.off('notification:new');
      socket.off('notification:read');
    };
  }, [socket]);

  async function fetchNotifications() {
    try {
      const response = await apiRequest(
        `/api/notifications?user=${userId}&page=1&limit=${PAGE_SIZE}`
      );
      const data = response.data;
      setNotifications(data?.items || []);
      setPage(1);
      setHasMore(data?.hasMore || false);
    } catch (error) {
      console.error('Failed to fetch notifications:', error);
    }
  }

  async function loadMoreNotifications() {
    if (loadingMore || !hasMore) return;
    setLoadingMore(true);
    try {
      const nextPage = page + 1;
      const response = await apiRequest(
        `/api/notifications?user=${userId}&page=${nextPage}&limit=${PAGE_SIZE}`
      );
      const data = response.data;
      const newItems: { _id: string }[] = data?.items || [];
      // Dedupe by _id so socket-prepended or overlapping items
      // are never rendered twice.
      setNotifications((prev) => {
        const seen = new Set(prev.map((n) => n._id));
        return [...prev, ...newItems.filter((n) => !seen.has(n._id))];
      });
      setPage(nextPage);
      setHasMore(data?.hasMore || false);
    } catch (error) {
      console.error('Failed to load more notifications:', error);
    } finally {
      setLoadingMore(false);
    }
  }

  async function fetchUnreadCount() {
    try {
      const response = await apiRequest(`/api/notifications/unread-count?user=${userId}`);
      setUnreadCount(response.data?.count || 0);
    } catch (error) {
      console.error('Failed to fetch unread count:', error);
    }
  }

  async function markAsRead(notificationId: string) {
    try {
      await apiRequest(`/api/notifications/${notificationId}`, { method: 'PUT' });
      setNotifications((prev) =>
        prev.map((n) => (n._id === notificationId ? { ...n, read: true } : n))
      );
      setUnreadCount((prev) => Math.max(0, prev - 1));
    } catch (error) {
      console.error('Failed to mark as read:', error);
    }
  }

  async function markAllAsRead() {
    try {
      await apiRequest(`/api/notifications/read-all?user=${userId}`, { method: 'PATCH' });
      setNotifications((prev) => prev.map((n) => ({ ...n, read: true })));
      setUnreadCount(0);
    } catch (error) {
      console.error('Failed to mark all as read:', error);
    }
  }

  return (
    <div className="relative">
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="relative p-2 rounded hover:bg-gray-100"
      >
        🔔
        {unreadCount > 0 && (
          <span className="absolute -top-1 -right-1 bg-red-500 text-white text-xs rounded-full w-5 h-5 flex items-center justify-center">
            {unreadCount > 9 ? '9+' : unreadCount}
          </span>
        )}
      </button>

      {isOpen && (
        <>
          <div
            className="fixed inset-0 z-10"
            onClick={() => setIsOpen(false)}
          />
          <div className="absolute right-0 mt-2 w-80 bg-white rounded-lg shadow-lg z-20 border">
            <div className="p-4 border-b flex justify-between items-center">
              <h3 className="font-semibold">Notifications</h3>
              {unreadCount > 0 && (
                <button
                  onClick={markAllAsRead}
                  className="text-sm text-blue-600 hover:text-blue-800"
                >
                  Mark all as read
                </button>
              )}
            </div>

            <div className="max-h-96 overflow-y-auto">
              {notifications.length === 0 ? (
                <p className="p-4 text-gray-500 text-center">No notifications</p>
              ) : (
                notifications.map((notification) => (
                  <div
                    key={notification._id}
                    className={`p-4 border-b hover:bg-gray-50 cursor-pointer ${
                      !notification.read ? 'bg-blue-50' : ''
                    }`}
                    onClick={() => {
                      if (!notification.read) {
                        markAsRead(notification._id);
                      }
                      if (notification.link) {
                        window.location.href = notification.link;
                      }
                    }}
                  >
                    <p className="font-medium text-sm">{notification.title}</p>
                    <p className="text-gray-600 text-sm mt-1">{notification.message}</p>
                    <p className="text-gray-400 text-xs mt-2">
                      {new Date(notification.createdAt).toLocaleString()}
                    </p>
                  </div>
                ))
              )}
              {hasMore && (
                <button
                  onClick={loadMoreNotifications}
                  disabled={loadingMore}
                  className="w-full p-3 text-sm text-blue-600 hover:bg-gray-50 disabled:opacity-50"
                >
                  {loadingMore ? 'Loading...' : 'Load more'}
                </button>
              )}
            </div>
          </div>
        </>
      )}
    </div>
  );
}
