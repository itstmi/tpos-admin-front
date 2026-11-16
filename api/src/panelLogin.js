// Super admin username/password login for the panel. Cloudflare Access is checked before these routes.
import { rateLimit } from 'express-rate-limit';
import { z } from 'zod';
import { db } from './db.js';
import { raiseAlert } from './alerts.js';
import { logActivity } from './logs.js';
import { fakeVerify, hashPassword, verifyPassword } from './passwords.js';
import { newToken } from './tokens.js';
import { PANEL_DEVICE, clearSessionCookie, sessionExpiry, setSessionCookie } from './auth/panel.js';

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

const passwordLimit = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 5,
  standardHeaders: 'draft-8',
  legacyHeaders: false,
  message: { error: 'too_many_attempts' },
});

// Same rule as the sub admin password: at least 15, with upper, lower, digit and a special character
const newPassword = z.string().min(15).max(128)
  .regex(/[A-Z]/).regex(/[a-z]/).regex(/[0-9]/).regex(/[^A-Za-z0-9]/);

const loginBody = z.object({
  username: z.string().trim().regex(/^[A-Za-z0-9._@-]{3,64}$/),
  password: z.string().min(1).max(128),
}).strict();

const passwordBody = z.object({
  current: z.string().min(1).max(128),
  password: newPassword,
}).strict();

async function startSession(res, adminId) {
  const { token, hash } = newToken();
  await db.remove('admin_sessions', { admin_id: `eq.${adminId}` });
  await db.insert('admin_sessions', {
    admin_id: adminId,
    device_id: PANEL_DEVICE,
    session_token_hash: hash,
    session_expires_at: sessionExpiry(),
    last_active: new Date().toISOString(),
    is_active: true,
  });
  setSessionCookie(res, token);
}

// Before the session check
export function panelLoginRoutes(router) {
  router.post('/login', loginLimit, async (req, res) => {
    const parsed = loginBody.safeParse(req.body);
    if (!parsed.success) return res.status(400).json({ error: 'invalid_input' });
    const { username, password } = parsed.data;
    const key = username.toLowerCase();

    if (isLocked(key)) return res.status(429).json({ error: 'too_many_attempts' });

    const [admin] = await db.select('admins', {
      select: 'id,name,username,role,password_hash,is_active,is_blocked',
      username: `eq.${username}`,
      role: 'eq.super_admin',
      limit: '1',
    });

    const check = admin ? await verifyPassword(password, admin.password_hash) : await fakeVerify(password);
    if (!check.ok) {
      addFailure(key);
      if (admin) await logActivity(admin, 'login_failed', { ip: req.ip, device: 'web' });
      if (isLocked(key)) {
        raiseAlert('panel_login_lock', `Super admin panel login locked for 15 minutes after ${LOCK_AFTER} wrong passwords. IP: ${req.ip}.`);
      }
      return res.status(401).json({ error: 'invalid_login' });
    }
    failures.delete(key);

    if (admin.is_active === false || admin.is_blocked) {
      return res.status(403).json({ error: 'account_blocked' });
    }

    if (check.needsRehash) {
      await db.update('admins', { id: `eq.${admin.id}` }, { password_hash: await hashPassword(password) });
    }

    await startSession(res, admin.id);
    await logActivity(admin, 'login', { ip: req.ip, device: 'web' });
    res.json({ admin: { id: admin.id, name: admin.name, username: admin.username } });
  });
}

// After the session check
export function panelAccountRoutes(router) {
  router.post('/logout', async (req, res) => {
    await db.remove('admin_sessions', { id: `eq.${req.sessionId}` });
    clearSessionCookie(res);
    await logActivity(req.admin, 'logout', { ip: req.ip, device: 'web' });
    res.json({ ok: true });
  });

  router.post('/password', passwordLimit, async (req, res) => {
    const parsed = passwordBody.safeParse(req.body);
    if (!parsed.success) return res.status(400).json({ error: 'invalid_input' });
    const { current, password } = parsed.data;

    const [admin] = await db.select('admins', {
      select: 'id,password_hash',
      id: `eq.${req.admin.id}`,
      limit: '1',
    });
    const check = admin ? await verifyPassword(current, admin.password_hash) : { ok: false };
    if (!check.ok) {
      await logActivity(req.admin, 'password_change_failed', { ip: req.ip });
      return res.status(400).json({ error: 'wrong_password' });
    }
    if (current === password) return res.status(400).json({ error: 'same_password' });

    await db.update('admins', { id: `eq.${req.admin.id}` }, { password_hash: await hashPassword(password) });
    // Every other session ends; this browser gets a fresh one
    await startSession(res, req.admin.id);
    await logActivity(req.admin, 'password_change', { ip: req.ip });
    raiseAlert('super_password_change', 'Super admin password was changed from the panel.');
    res.json({ ok: true });
  });
}
