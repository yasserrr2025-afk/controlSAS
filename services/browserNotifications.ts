export type BrowserNotificationPermission = NotificationPermission | 'unsupported';

export const getBrowserNotificationPermission = (): BrowserNotificationPermission => {
  if (typeof window === 'undefined' || !('Notification' in window)) return 'unsupported';
  return Notification.permission;
};

export const registerAppServiceWorker = async () => {
  if (typeof navigator === 'undefined' || !('serviceWorker' in navigator)) return null;

  try {
    return await navigator.serviceWorker.register('/sw.js');
  } catch {
    return null;
  }
};

export const requestBrowserNotificationPermission = async (): Promise<BrowserNotificationPermission> => {
  if (typeof window === 'undefined' || !('Notification' in window)) return 'unsupported';
  return Notification.requestPermission();
};

export const showBrowserNotification = async (title: string, body: string) => {
  if (getBrowserNotificationPermission() !== 'granted') return;

  const options: NotificationOptions = {
    body,
    icon: 'https://www.raed.net/img?id=1488645',
    badge: 'https://www.raed.net/img?id=1488645',
    dir: 'rtl',
    lang: 'ar',
    tag: `control-${Date.now()}`,
  };

  try {
    const registration = await navigator.serviceWorker?.ready;
    if (registration?.showNotification) {
      await registration.showNotification(title, options);
      return;
    }
  } catch {
    // Fall back to the page-level Notification API.
  }

  try {
    new Notification(title, options);
  } catch {
    // Ignore unsupported browser edge cases.
  }
};
