import { Router } from 'express';
import { rateLimit } from 'express-rate-limit';
import { z } from 'zod';
import { db } from '../db.js';
import { logActivity } from '../logs.js';
import { fakeVerify, hashPassword, verifyPassword } from '../passwords.js';
import { newToken } from '../tokens.js';
import { requireAppKey, requireSubAdmin, sessionExpiry } from '../auth/app.js';

const router = Router();

const LOCK_AFTER = 5;
const LOCK_MS = 15 * 60 * 1000;
const failures = new Map();

function isLocked(username) {
  const f = failures.get(username);
  if (!f) return false;
  if (Date.now() - f.first > LOCK_MS) {
    failures.delete(username);
    return false;
  }
  return f.count >= LOCK_AFTER;
}

function addFailure(username) {
  const f = failures.get(username);
  if (!f || Date.now() - f.first > LOCK_MS) failures.set(username, { count: 1, first: Date.now() });
  else f.count += 1;
}

const loginLimit = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 10,
  standardHeaders: 'draft-8',
  legacyHeaders: false,
  message: { error: 'too_many_attempts' },
});

const apiLimit = rateLimit({
  windowMs: 60 * 1000,
  limit: 120,
  standardHeaders: 'draft-8',
  legacyHeaders: false,
  message: { error: 'too_many_requests' },
});

const loginBody = z.object({
  username: z.string().trim().regex(/^[A-Za-z0-9._@-]{3,64}$/),
  password: z.string().min(1).max(128),
  device_id: z.string().min(8).max(128).regex(/^[A-Za-z0-9._:-]+$/),
});

router.use(requireAppKey, apiLimit);

router.post('/login', loginLimit, async (req, res) => {
  const parsed = loginBody.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: 'invalid_input' });
  const { username, password, device_id: deviceId } = parsed.data;

  if (isLocked(username)) return res.status(429).json({ error: 'too_many_attempts' });

  const [admin] = await db.select('admins', {
    select: 'id,name,username,role,password_hash,is_active,is_blocked',
    username: `eq.${username}`,
    role: 'eq.sub_admin',
    limit: '1',
  });

  const check = admin ? await verifyPassword(password, admin.password_hash) : await fakeVerify(password);
  if (!check.ok) {
    addFailure(username);
    if (admin) await logActivity(admin, 'login_failed', { ip: req.ip });
    return res.status(401).json({ error: 'invalid_login' });
  }
  failures.delete(username);

  if (admin.is_active === false || admin.is_blocked) {
    return res.status(403).json({ error: 'account_blocked' });
  }

  if (check.needsRehash) {
    await db.update('admins', { id: `eq.${admin.id}` }, { password_hash: await hashPassword(password) });
  }

  const { token, hash } = newToken();
  const expiresAt = sessionExpiry();
  await db.remove('admin_sessions', { admin_id: `eq.${admin.id}` });
  await db.insert('admin_sessions', {
    admin_id: admin.id,
    device_id: deviceId,
    session_token_hash: hash,
    session_expires_at: expiresAt,
    last_active: new Date().toISOString(),
    is_active: true,
  });

  await logActivity(admin, 'login', { ip: req.ip, device_id: deviceId });
  res.json({
    token,
    expires_at: expiresAt,
    admin: { id: admin.id, name: admin.name, username: admin.username },
  });
});

router.use(requireSubAdmin);

router.get('/me', (req, res) => {
  res.json({ admin: req.admin });
});

router.post('/logout', async (req, res) => {
  await db.remove('admin_sessions', { id: `eq.${req.sessionId}` });
  await logActivity(req.admin, 'logout', { ip: req.ip });
  res.json({ ok: true });
});

export default router;
