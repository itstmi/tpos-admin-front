import { createHash, randomBytes } from 'node:crypto';

export const TOKEN_PATTERN = /^[A-Za-z0-9_-]{43}$/;

export function hashToken(token) {
  return createHash('sha256').update(token).digest('hex');
}

export function newToken() {
  const token = randomBytes(32).toString('base64url');
  return { token, hash: hashToken(token) };
}
