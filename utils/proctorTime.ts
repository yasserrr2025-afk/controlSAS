import { Supervision } from '../types';

export const isPlaceholderProctorStart = (value?: string | null) => {
  if (!value) return true;
  const text = String(value).trim();
  if (!text) return true;
  if (/^\d{4}-\d{2}-\d{2}$/.test(text)) return true;
  if (/T00:00(?::00(?:\.000)?)?/.test(text)) return true;

  const date = new Date(text);
  if (Number.isNaN(date.getTime())) return true;

  return date.getHours() === 0 && date.getMinutes() === 0 && date.getSeconds() === 0;
};

export const formatActualProctorStart = (value?: string | null, fallback = '---') => {
  if (isPlaceholderProctorStart(value)) return fallback;
  const date = new Date(String(value));
  if (Number.isNaN(date.getTime())) return fallback;
  return date.toLocaleTimeString('ar-SA', { hour: '2-digit', minute: '2-digit' });
};

export const getActualSupervisionStart = (supervisions: Supervision[]) => {
  return supervisions
    .map(item => item.date)
    .filter((value): value is string => Boolean(value) && !isPlaceholderProctorStart(value))
    .sort()[0];
};
