import { User } from '../types';
import { db } from '../supabase';

const getVapidPublicKey = () =>
  (import.meta as any).env?.VITE_VAPID_PUBLIC_KEY || localStorage.getItem('vapid_public_key') || '';

const urlBase64ToUint8Array = (base64String: string) => {
  const padding = '='.repeat((4 - base64String.length % 4) % 4);
  const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/');
  const rawData = window.atob(base64);
  const outputArray = new Uint8Array(rawData.length);
  for (let i = 0; i < rawData.length; i += 1) outputArray[i] = rawData.charCodeAt(i);
  return outputArray;
};

export const isPushSupported = () =>
  typeof window !== 'undefined'
  && 'Notification' in window
  && 'serviceWorker' in navigator
  && 'PushManager' in window;

export const registerExternalPush = async (user: User) => {
  if (!isPushSupported()) {
    throw new Error('هذا المتصفح لا يدعم إشعارات Web Push الخارجية.');
  }

  const publicKey = getVapidPublicKey();
  if (!publicKey) {
    throw new Error('لم يتم ضبط مفتاح VAPID العام. أضف VITE_VAPID_PUBLIC_KEY ثم أعد النشر.');
  }

  const permission = await Notification.requestPermission();
  if (permission !== 'granted') {
    throw new Error('لم يتم السماح بإشعارات المتصفح من إعدادات الجهاز.');
  }

  const registration = await navigator.serviceWorker.ready;
  const existing = await registration.pushManager.getSubscription();
  const subscription = existing || await registration.pushManager.subscribe({
    userVisibleOnly: true,
    applicationServerKey: urlBase64ToUint8Array(publicKey),
  });

  await db.pushSubscriptions.upsert(user, subscription.toJSON());
  return subscription;
};
