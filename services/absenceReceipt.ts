import { Absence } from '../types';

export interface AbsenceReceiptInfo {
  by: string;
  role: string;
  at: string;
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

export const isAbsenceReceived = (absence?: Pick<Absence, 'note'> | null) => Boolean(getAbsenceReceipt(absence));

export const getAbsenceKindLabel = (type?: Absence['type']) => (type === 'LATE' ? 'التأخير' : 'الغياب');

