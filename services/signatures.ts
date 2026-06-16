import { ControlRequest } from '../types';

export type SignatureRole = 'receiver' | 'proctor';

export interface StoredSignature {
  role: SignatureRole;
  committee: string;
  grade?: string;
  name: string;
  time: string;
  signature: string;
}

export const SIGNATURE_PREFIX = '[SIGNATURE]';
export const SIGNATURE_REQUEST_PREFIX = '[SIGNATURE_REQUEST]';
export const ALL_GRADES_SIGNATURE = '__ALL__';

export const buildSignatureText = (signature: StoredSignature) => {
  return `${SIGNATURE_PREFIX}${JSON.stringify(signature)}`;
};

export const parseSignature = (request?: ControlRequest | null): StoredSignature | null => {
  if (!request?.text?.startsWith(SIGNATURE_PREFIX)) return null;
  try {
    return JSON.parse(request.text.slice(SIGNATURE_PREFIX.length)) as StoredSignature;
  } catch {
    return null;
  }
};

export const getStoredSignatures = (requests: ControlRequest[] = []) => {
  return requests
    .map(parseSignature)
    .filter((item): item is StoredSignature => Boolean(item));
};

export const findStoredSignature = (
  requests: ControlRequest[] = [],
  role: SignatureRole,
  committee: string | number,
  grade?: string,
) => {
  const committeeKey = String(committee).trim();
  const gradeKey = grade?.trim();
  return getStoredSignatures(requests)
    .filter(item =>
      item.role === role &&
      String(item.committee).trim() === committeeKey &&
      (!gradeKey || item.grade === gradeKey || item.grade === ALL_GRADES_SIGNATURE)
    )
    .sort((a, b) => b.time.localeCompare(a.time))[0] || null;
};

export const isSignatureRequest = (request: ControlRequest) => request.text?.startsWith(SIGNATURE_REQUEST_PREFIX);
export const cleanSignatureRequestText = (text?: string) => String(text || '').replace(SIGNATURE_REQUEST_PREFIX, '').trim();

export const isInternalSignatureRecord = (request: ControlRequest) => request.text?.startsWith(SIGNATURE_PREFIX);

export const cleanControlRequestText = (text?: string) => {
  const raw = String(text || '').trim();
  if (raw.startsWith(SIGNATURE_PREFIX)) return 'توقيع محفوظ';
  return raw
    .replace('[CALL_RECEIVER]', '')
    .replace(SIGNATURE_REQUEST_PREFIX, '')
    .trim();
};
