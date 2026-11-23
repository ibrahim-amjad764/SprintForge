// components/notification/NotificationDropdown.tsx

'use client';

import { useEffect, useRef, useState } from 'react';
import { Bell } from 'lucide-react';
import { apiRequest } from '@/lib/api';

const PAGE_SIZE = 20;

interface AppNotification {
  _id: string;
  read?: boolean;
  title?: string;
  message?: string;
  createdAt?: string;
}

export default function NotificationDropdown({ userId }: { userId: string }) {
  const [notifications, setNotifications] = useState<AppNotification[]>([]);
  const [isOpen, setIsOpen] = useState(false);
  const [markingAllRead, setMarkingAllRead] = useState(false);
  const [page, setPage] = useState(1);
  const [hasMore, setHasMore] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);

  useEffect(() => {
    async function load() {
      const response = await apiRequest(
        `/api/notifications?user=${userId}&page=1&limit=${PAGE_SIZE}`
      );
      const data = response.data;
      setNotifications(data?.items || []);
      setPage(1);
      setHasMore(data?.hasMore || false);
    }
    load();
  }, [userId]);

  async function loadMore() {
    if (loadingMore || !hasMore) return;
    setLoadingMore(true);
    try {
      const nextPage = page + 1;
      const response = await apiRequest(
        `/api/notifications?user=${userId}&page=${nextPage}&limit=${PAGE_SIZE}`
      );
      const data = response.data;
      const newItems: AppNotification[] = data?.items || [];
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
  const containerRef = useRef<HTMLDivElement>(null);

  // Close on outside click / Escape — standard popover behavior.
  useEffect(() => {
    if (!isOpen) return;
    function onPointerDown(e: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setIsOpen(false);
      }
    }
    function onKeyDown(e: KeyboardEvent) {
      if (e.key === 'Escape') setIsOpen(false);
    }
    document.addEventListener('mousedown', onPointerDown);
    document.addEventListener('keydown', onKeyDown);
    return () => {
      document.removeEventListener('mousedown', onPointerDown);
      document.removeEventListener('keydown', onKeyDown);
    };
  }, [isOpen]);

  return (
    <div className="relative inline-block" ref={containerRef}>
      <button
        onClick={() => setIsOpen(!isOpen)}
        aria-haspopup="true"
        aria-expanded={isOpen}
        aria-label={`Notifications${unreadCount > 0 ? `, ${unreadCount} unread` : ''}`}
        className="relative flex h-9 w-9 items-center justify-center rounded-lg border border-border bg-card text-muted-foreground transition-colors hover:bg-muted hover:text-foreground focus-visible:outline-2 focus-visible:outline-ring"
      >
        <Bell className="h-4 w-4" aria-hidden="true" />
        {unreadCount > 0 && (
          <span className="absolute -right-1.5 -top-1.5 flex h-4.5 min-w-4.5 items-center justify-center rounded-full bg-destructive px-1 text-[10px] font-bold text-white">
            {unreadCount > 9 ? '9+' : unreadCount}
          </span>
        )}
      </button>

      {isOpen && (
        <div className="animate-scale-in absolute right-0 top-full z-50 mt-2 w-80 overflow-hidden rounded-xl border border-border bg-popover shadow-popover">
          <div className="flex items-center justify-between border-b p-3">
            <h3 className="font-semibold">Notifications</h3>
            {notifications.length > 0 && (
              <button
                onClick={markAllAsRead}
                disabled={markingAllRead || unreadCount === 0}
                className="text-xs font-medium text-primary hover:underline disabled:opacity-50"
              >
                {markingAllRead ? 'Marking...' : 'Mark all as read'}
              </button>
            )}
          </div>
          
          {notifications.length === 0 ? (
            <p className="p-4 text-center text-muted-foreground">No notifications</p>
          ) : (
            <div className="max-h-96 overflow-y-auto">
              {notifications.map((notification) => (
                <div 
                  key={notification._id} 
                  className={`border-b border-border/60 p-3 transition-colors hover:bg-muted/40 ${!notification.read ? 'bg-primary/5' : ''}`}
                >
                  <div className="flex items-start gap-2">
                    {!notification.read && (
                      <div className="mt-1 h-2 w-2 rounded-full bg-primary"></div>
                    )}
                    <div className="flex-1">
                      <p className="font-semibold text-sm">{notification.title}</p>
                      <p className="text-sm text-muted-foreground">{notification.message}</p>
                      <p className="mt-1 font-mono text-[11px] text-muted-foreground">
                        {notification.createdAt ? new Date(notification.createdAt).toLocaleDateString() : ''}
                      </p>
                    </div>
                  </div>
                </div>
              ))}
              {hasMore && (
                <button
                  onClick={loadMore}
                  disabled={loadingMore}
                  className="w-full border-t border-border/60 p-3 text-sm font-medium text-primary transition-colors hover:bg-muted disabled:opacity-50"
                >
                  {loadingMore ? 'Loading...' : 'Load more'}
                </button>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
