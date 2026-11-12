import { createHash } from 'node:crypto';
import { z } from 'zod';
import { db } from './db.js';
import { logActivity } from './logs.js';

const uuid = z.uuid();
const name = z.string().trim().min(2).max(100);

const baseBody = {
  business_name: name,
  owner_name: name,
  phone: z.string().regex(/^03[0-9]{9}$/),
  // Same rule as the old admin app; the ISP login on the backend checks SHA-256
  password: z.string().min(8).max(128),
  monthly_charges: z.number().finite().positive().max(10000000),
  city: z.string().trim().min(2).max(60),
  trial: z.boolean(),
};
const subBody = z.object(baseBody).strict();
const superBody = z.object({
  ...baseBody,
  tpos_amount: z.number().finite().nonnegative().max(10000000),
  trial_days: z.number().int().min(1).max(365).optional(),
}).strict().refine((b) => !b.trial || b.trial_days, { message: 'trial_days needed' });

const daysBody = z.object({ days: z.number().int().min(1).max(365) }).strict();
const limitBody = z.object({ trial_limit: z.number().int().min(0).max(1000) }).strict();

const ERROR_STATUS = {
  NOT_ALLOWED: 403,
  INVALID_INPUT: 400,
  CHARGES_BELOW_TPOS: 400,
  RATE_NOT_SET: 409,
  TRIAL_LIMIT: 409,
  PHONE_EXISTS: 409,
  NOT_FOUND: 404,
  NOT_TRIAL: 409,
};

const sha256 = (text) => createHash('sha256').update(text).digest('hex');

function sendResult(res, result) {
  if (result.result === 'ok') return false;
  res.status(ERROR_STATUS[result.result] ?? 500).json({ error: result.result, limit: result.limit });
  return true;
}

function ispIdFrom(req, res) {
  const parsed = uuid.safeParse(req.params.id);
  if (!parsed.success) res.status(400).json({ error: 'invalid_input' });
  return parsed.success ? parsed.data : null;
}

async function createIsp(req, res, body) {
  const result = await db.rpc('admin_create_isp', {
    p_admin_id: req.admin.id,
    p_business_name: body.business_name,
    p_owner_name: body.owner_name,
    p_phone: body.phone,
    p_password_hash: sha256(body.password),
    p_monthly_charges: body.monthly_charges,
    p_city: body.city,
    p_trial: body.trial,
    p_trial_days: body.trial_days ?? null,
    p_tpos_amount: body.tpos_amount ?? null,
  });
  if (sendResult(res, result)) return;

  await logActivity(req.admin, 'isp_create', {
    isp_id: result.isp_id,
    trial: result.trial,
    trial_ends_at: result.trial_ends_at,
    monthly_charges: body.monthly_charges,
    tpos_amount: result.tpos_amount,
  });
  res.status(201).json({
    isp_id: result.isp_id,
    trial: result.trial,
    trial_ends_at: result.trial_ends_at,
    tpos_amount: result.tpos_amount,
  });
}

async function makePaid(req, res) {
  const id = ispIdFrom(req, res);
  if (!id) return;
  const result = await db.rpc('admin_isp_make_paid', { p_isp_id: id, p_admin_id: req.admin.id });
  if (sendResult(res, result)) return;
  await logActivity(req.admin, 'isp_make_paid', { isp_id: id, bill_start: result.bill_start });
  res.json({ bill_start: result.bill_start });
}

// Sub admin app. The TPOS amount and the trial days are never taken from the app.
export function subAdminIspRoutes(router) {
  router.get('/isps-new', async (req, res) => {
    const [me] = await db.select('admins', { select: 'tpos_amount,trial_limit', id: `eq.${req.admin.id}` });
    const monthStart = new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Karachi' }).format(new Date()).slice(0, 8) + '01';
    const used = await db.select('isp_accounts', {
      select: 'id',
      created_by: `eq.${req.admin.id}`,
      trial_started_on: `gte.${monthStart}`,
    });
    res.json({
      tpos_amount: me?.tpos_amount ?? null,
      trial_days: 7,
      trial_limit: me?.trial_limit ?? 0,
      trials_used: used.length,
    });
  });

  router.post('/isps', async (req, res) => {
    const parsed = subBody.safeParse(req.body);
    if (!parsed.success) return res.status(400).json({ error: 'invalid_input' });
    await createIsp(req, res, parsed.data);
  });

  router.post('/isps/:id/make-paid', makePaid);
}

// Panel (super admin)
export function superIspRoutes(router) {
  router.post('/isps', async (req, res) => {
    const parsed = superBody.safeParse(req.body);
    if (!parsed.success) return res.status(400).json({ error: 'invalid_input' });
    await createIsp(req, res, parsed.data);
  });

  router.post('/isps/:id/make-paid', makePaid);

  router.post('/isps/:id/extend-trial', async (req, res) => {
    const parsed = daysBody.safeParse(req.body);
    if (!parsed.success) return res.status(400).json({ error: 'invalid_input' });
    const id = ispIdFrom(req, res);
    if (!id) return;
    const result = await db.rpc('admin_isp_extend_trial', { p_isp_id: id, p_admin_id: req.admin.id, p_days: parsed.data.days });
    if (sendResult(res, result)) return;
    await logActivity(req.admin, 'isp_extend_trial', { isp_id: id, days: parsed.data.days, trial_ends_at: result.trial_ends_at });
    res.json({ trial_ends_at: result.trial_ends_at });
  });

  router.post('/sub-admins/:id/trial-limit', async (req, res) => {
    const parsed = limitBody.safeParse(req.body);
    if (!parsed.success) return res.status(400).json({ error: 'invalid_input' });
    const id = ispIdFrom(req, res);
    if (!id) return;
    const rows = await db.update('admins', { id: `eq.${id}`, role: 'eq.sub_admin' }, { trial_limit: parsed.data.trial_limit });
    if (!rows.length) return res.status(404).json({ error: 'not_found' });
    await logActivity(req.admin, 'sub_admin_trial_limit', { sub_admin_id: id, trial_limit: parsed.data.trial_limit });
    res.json({ trial_limit: parsed.data.trial_limit });
  });
}
