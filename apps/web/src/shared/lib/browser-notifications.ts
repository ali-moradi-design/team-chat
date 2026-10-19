import { usePrefs } from './prefs';

export function notificationPermission(): NotificationPermission | 'unsupported' {
  return typeof Notification === 'undefined' ? 'unsupported' : Notification.permission;
}

export async function enableBrowserNotifications(): Promise<boolean> {
  if (typeof Notification === 'undefined') return false;
  const result =
    Notification.permission === 'default'
      ? await Notification.requestPermission()
      : Notification.permission;
  const ok = result === 'granted';
  usePrefs.getState().set({ browserNotifications: ok });
  return ok;
}
