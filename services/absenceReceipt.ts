import { Absence } from '../types';

export interface AbsenceReceiptInfo {
  by: string;
  role: string;
  at: string;
  contactStatus?: 'CONTACTED' | 'NO_ANSWER' | 'CUSTOM';
  contactNote?: string;
  contactBy?: string;
  contactAt?: string;
}

const RECEIPT_PREFIX = '[ABSENCE_RECEIPT]';

export const getAbsenceReceipt = (absence?: Pick<Absence, 'note'> | null): AbsenceReceiptInfo | null => {
  if (!absence?.note?.startsWith(RECEIPT_PREFIX)) return null;

  try {
    return JSON.parse(absence.note.slice(RECEIPT_PREFIX.length)) as AbsenceReceiptInfo;
  } catch {
    return null;
  }
};

export const buildAbsenceReceiptNote = (by: string, role: string) =>
  `${RECEIPT_PREFIX}${JSON.stringify({ by, role, at: new Date().toISOString() })}`;

export const buildAbsenceContactNote = (
  absence: Pick<Absence, 'note'>,
  contact: { status: AbsenceReceiptInfo['contactStatus']; note: string; by: string },
) => {
  const receipt = getAbsenceReceipt(absence) || { by: contact.by, role: 'الموجه الطلابي', at: new Date().toISOString() };
  return `${RECEIPT_PREFIX}${JSON.stringify({
    ...receipt,
    contactStatus: contact.status,
    contactNote: contact.note,
    contactBy: contact.by,
    contactAt: new Date().toISOString(),
  })}`;
};

export const isAbsenceReceived = (absence?: Pick<Absence, 'note'> | null) => Boolean(getAbsenceReceipt(absence));

export const getAbsenceKindLabel = (type?: Absence['type']) => (type === 'LATE' ? 'التأخير' : 'الغياب');
