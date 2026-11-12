import { randomInt } from 'node:crypto';
import { z } from 'zod';
import { db } from './db.js';
import { logActivity } from './logs.js';
import { hashPassword } from './passwords.js';

const uuid = z.uuid();

// Sub admin password: at least 15, with upper, lower, digit and a special character (user rule)
const password = z.string().min(15).max(128)
  .regex(/[A-Z]/).regex(/[a-z]/).regex(/[0-9]/).regex(/[^A-Za-z0-9]/);
const name = z.string().trim().min(2).max(100);
const city = z.string().trim().min(2).max(60);

const createBody = z.object({
  name,
  username: z.string().trim().regex(/^[A-Za-z0-9._@-]{3,64}$/),
  password,
  city,
  tpos_amount: z.number().finite().nonnegative().max(10000000),
  trial_limit: z.number().int().min(0).max(1000),
}).strict();
const blockBody = z.object({ blocked: z.boolean(), isps: z.boolean() }).strict();
const passwordBody = z.object({ password }).strict();
const profileBody = z.object({ name, city }).strict();

const ERROR_STATUS = { NOT_ALLOWED: 403, INVALID_INPUT: 400, USERNAME_EXISTS: 409, NOT_FOUND: 404, HAS_HISTORY: 409 };

const LIST_FIELDS = 'id,name,username,city,tpos_amount,trial_limit,is_active,is_blocked,created_at';

const SETS = ['ABCDEFGHJKLMNPQRSTUVWXYZ', 'abcdefghijkmnopqrstuvwxyz', '23456789', '!@#$%&*?-_=+'];

// 18 characters, at least one from each set, shuffled
export function generatePassword(length = 18) {
  const all = SETS.join('');
  const chars = SETS.map((s) => s[randomInt(s.length)]);
  while (chars.length < length) chars.push(all[randomInt(all.length)]);
  for (let i = chars.length - 1; i > 0; i -= 1) {
    const j = randomInt(i + 1);
    [chars[i], chars[j]] = [chars[j], chars[i]];
  }
  return chars.join('');
}

function idFrom(req, res) {
  const parsed = uuid.safeParse(req.params.id);
  if (!parsed.success) res.status(400).json({ error: 'invalid_input' });
  return parsed.success ? parsed.data : null;
}

function failed(res, result) {
  if (result.result === 'ok') return false;
  res.status(ERROR_STATUS[result.result] ?? 500).json({ error: result.result });
  return true;
}

// Panel (super admin) only
export function adminManageRoutes(router) {
  router.get('/admins', async (req, res) => {
    const rows = await db.select('admins', { select: LIST_FIELDS, role: 'eq.sub_admin', order: 'name.asc' });
    res.json({ sub_admins: rows });
  });

  router.get('/admins/new-password', (req, res) => {
    res.set('Cache-Control', 'no-store');
    res.json({ password: generatePassword() });
  });

  router.post('/admins', async (req, res) => {
    const parsed = createBody.safeParse(req.body);
    if (!parsed.success) return res.status(400).json({ error: 'invalid_input' });
    const b = parsed.data;
    const result = await db.rpc('admin_create_sub_admin', {
      p_super_id: req.admin.id,
      p_name: b.name,
      p_username: b.username,
      p_password_hash: await hashPassword(b.password),
      p_city: b.city,
      p_tpos_amount: b.tpos_amount,
      p_trial_limit: b.trial_limit,
    });
    if (failed(res, result)) return;
    await logActivity(req.admin, 'sub_admin_create', {
      sub_admin_id: result.sub_admin_id, username: b.username, city: b.city, tpos_amount: b.tpos_amount, trial_limit: b.trial_limit,
    });
    res.status(201).json({ sub_admin_id: result.sub_admin_id });
  });

  router.post('/admins/:id/block', async (req, res) => {
    const parsed = blockBody.safeParse(req.body);
    if (!parsed.success) return res.status(400).json({ error: 'invalid_input' });
    const id = idFrom(req, res);
    if (!id) return;
    const result = await db.rpc('admin_set_sub_admin_block', {
      p_super_id: req.admin.id, p_sub_id: id, p_block: parsed.data.blocked, p_isps: parsed.data.isps,
    });
    if (failed(res, result)) return;
    await logActivity(req.admin, parsed.data.blocked ? 'sub_admin_block' : 'sub_admin_unblock', {
      sub_admin_id: id, with_isps: parsed.data.isps, isps: result.isps,
    });
    res.json({ blocked: parsed.data.blocked, isps: result.isps });
  });

  router.post('/admins/:id/password', async (req, res) => {
    const parsed = passwordBody.safeParse(req.body);
    if (!parsed.success) return res.status(400).json({ error: 'invalid_input' });
    const id = idFrom(req, res);
    if (!id) return;
    const rows = await db.update('admins', { id: `eq.${id}`, role: 'eq.sub_admin' }, {
      password_hash: await hashPassword(parsed.data.password),
    });
    if (!rows.length) return res.status(404).json({ error: 'not_found' });
    // Old logins end; the sub admin signs in again with the new password
    await db.remove('admin_sessions', { admin_id: `eq.${id}` });
    await logActivity(req.admin, 'sub_admin_password_reset', { sub_admin_id: id });
    res.json({ ok: true });
  });

  router.post('/admins/:id/profile', async (req, res) => {
    const parsed = profileBody.safeParse(req.body);
    if (!parsed.success) return res.status(400).json({ error: 'invalid_input' });
    const id = idFrom(req, res);
    if (!id) return;
    const rows = await db.update('admins', { id: `eq.${id}`, role: 'eq.sub_admin' }, parsed.data);
    if (!rows.length) return res.status(404).json({ error: 'not_found' });
    await logActivity(req.admin, 'sub_admin_update', { sub_admin_id: id, ...parsed.data });
    res.json({ ok: true });
  });

  router.delete('/admins/:id', async (req, res) => {
    const id = idFrom(req, res);
    if (!id) return;
    const result = await db.rpc('admin_delete_sub_admin', { p_super_id: req.admin.id, p_sub_id: id });
    if (failed(res, result)) return;
    await logActivity(req.admin, 'sub_admin_delete', { sub_admin_id: id, name: result.name, isps_moved: result.isps_moved });
    res.json({ isps_moved: result.isps_moved });
  });
}
