import { argon2, createHash, randomBytes, timingSafeEqual } from 'node:crypto';
import { promisify } from 'node:util';

const argon2Async = promisify(argon2);

const PARAMS = { memory: 19456, passes: 2, parallelism: 1, tagLength: 32 };
const PHC = /^\$argon2id\$v=19\$m=(\d+),t=(\d+),p=(\d+)\$([A-Za-z0-9+/]+)\$([A-Za-z0-9+/]+)$/;
const LEGACY = /^[0-9a-f]{64}$/;

const b64 = (buf) => buf.toString('base64').replace(/=+$/, '');

function same(a, b) {
  return a.length === b.length && timingSafeEqual(a, b);
}

export async function hashPassword(password) {
  const nonce = randomBytes(16);
  const tag = await argon2Async('argon2id', { message: password, nonce, ...PARAMS });
  const { memory, passes, parallelism } = PARAMS;
  return `$argon2id$v=19$m=${memory},t=${passes},p=${parallelism}$${b64(nonce)}$${b64(tag)}`;
}

// Returns { ok, needsRehash }. Old admin hashes are plain SHA-256 hex.
export async function verifyPassword(password, stored) {
  const m = PHC.exec(stored || '');
  if (m) {
    const [memory, passes, parallelism] = [m[1], m[2], m[3]].map(Number);
    if (memory > 262144 || passes > 10 || parallelism > 8) return { ok: false, needsRehash: false };
    const nonce = Buffer.from(m[4], 'base64');
    const expected = Buffer.from(m[5], 'base64');
    const tag = await argon2Async('argon2id', {
      message: password,
      nonce,
      memory,
      passes,
      parallelism,
      tagLength: expected.length,
    });
    const ok = same(tag, expected);
    const current = memory === PARAMS.memory && passes === PARAMS.passes && parallelism === PARAMS.parallelism;
    return { ok, needsRehash: ok && !current };
  }

  if (LEGACY.test(stored || '')) {
    const digest = createHash('sha256').update(password, 'utf8').digest();
    const ok = same(digest, Buffer.from(stored, 'hex'));
    return { ok, needsRehash: ok };
  }

  return { ok: false, needsRehash: false };
}

const dummy = hashPassword(randomBytes(16).toString('hex'));

// Spends the same time as a real check so unknown usernames are not easy to spot.
export async function fakeVerify(password) {
  await verifyPassword(password, await dummy);
  return { ok: false, needsRehash: false };
}
