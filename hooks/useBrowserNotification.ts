// hooks/useBrowserNotification.ts
export function requestNotificationPermission() {
  if ('Notification' in window) {
    Notification.requestPermission();
  }
}

export function showNotification(title: string) {
  if (Notification.permission === 'granted') {
    new Notification(title);
  }
}
