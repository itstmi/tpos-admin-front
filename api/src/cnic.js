import { createDecipheriv } from 'node:crypto';

const PREFIX = 'v1:';
const key = process.env.CNIC_KEY ? Buffer.from(process.env.CNIC_KEY, 'base64') : null;

export const cnicReady = key?.length === 32;

// Same format as the backend's utils/cnic_crypto.js; null when empty, changed or from another ISP
export function decryptCnic(value, ispId) {
  if (!cnicReady || !value || !value.startsWith(PREFIX)) return null;
  try {
    const raw = Buffer.from(value.slice(PREFIX.length), 'base64');
    const decipher = createDecipheriv('aes-256-gcm', key, raw.subarray(0, 12));
    decipher.setAAD(Buffer.from(String(ispId)));
    decipher.setAuthTag(raw.subarray(12, 28));
    const digits = Buffer.concat([decipher.update(raw.subarray(28)), decipher.final()]).toString('utf8');
    return `${digits.slice(0, 5)}-${digits.slice(5, 12)}-${digits.slice(12)}`;
  } catch {
    return null;
  }
}
