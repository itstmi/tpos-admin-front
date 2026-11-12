import { z } from 'zod';
import { db } from './db.js';
import { logActivity } from './logs.js';

const uuid = z.uuid();
const money = z.number().finite().nonnegative().max(10000000);
const handoverBody = z.object({
  expected_tpos: money,
  expected_count: z.number().int().nonnegative().max(100000),
  received: money.positive(),
  note: z.string().trim().max(500).optional(),
});
const rateBody = z.object({ tpos_amount: money });

const HANDOVER_FIELDS = 'id,sub_admin_name,previous_balance,tpos_total,isp_total,charges_count,first_charge_at,last_charge_at,amount,remaining_balance,note,received_at';
const COLLECTION_FIELDS = 'id,month,year,period_start,period_end,amount,tpos_amount,status,collected_at,approved_at,isp:isp_accounts(business_name),handover:admin_handover_charges(handover_id)';

const ERROR_STATUS = {
  INVALID_AMOUNT: 400,
  NOT_ALLOWED: 403,
  SUB_ADMIN_NOT_FOUND: 404,
  HANDOVER_CHANGED: 409,
  NOTHING_TO_HANDOVER: 409,
  AMOUNT_EXCEEDS_DUE: 409,
};

async function status(subAdminId) {
  const rows = await db.rpc('admin_sub_admin_status', { p_sub_admin_id: subAdminId });
  return subAdminId ? rows[0] ?? null : rows;
}

const handovers = (subAdminId) => db.select('admin_handovers', {
  select: HANDOVER_FIELDS,
  sub_admin_id: `eq.${subAdminId}`,
  order: 'received_at.desc,created_at.desc',
  limit: '100',
});

// Lena = ISP charge, dena = TPOS amount, profit = difference
async function collections(subAdminId) {
  const rows = await db.select('isp_charges_history', {
    select: COLLECTION_FIELDS,
    collected_by: `eq.${subAdminId}`,
    status: 'in.(pending_approval,paid)',
    order: 'collected_at.desc',
    limit: '200',
  });
  return rows.map(({ isp, handover, ...c }) => ({
    ...c,
    business_name: isp?.business_name ?? null,
    profit: Number(c.amount) - Number(c.tpos_amount ?? 0),
    handed_over: Boolean(handover),
  }));
}

async function loadSubAdmin(req, res) {
  const parsed = uuid.safeParse(req.params.id);
  if (!parsed.success) {
    res.status(400).json({ error: 'invalid_input' });
    return null;
  }
  const [sub] = await db.select('admins', { select: 'id,name', id: `eq.${parsed.data}`, role: 'eq.sub_admin' });
  if (!sub) res.status(404).json({ error: 'not_found' });
  return sub ?? null;
}

// Sub admin app: only his own record
export function myAccountRoutes(router) {
  router.get('/account', async (req, res) => {
    res.json({ account: await status(req.admin.id) });
  });
  router.get('/account/handovers', async (req, res) => {
    res.json({ handovers: await handovers(req.admin.id) });
  });
  router.get('/account/collections', async (req, res) => {
    res.json({ collections: await collections(req.admin.id) });
  });
}

// Panel: every sub admin
export function subAdminRoutes(router) {
  router.get('/sub-admins', async (req, res) => {
    res.json({ sub_admins: await status(null) });
  });

  router.get('/sub-admins/:id', async (req, res) => {
    const sub = await loadSubAdmin(req, res);
    if (!sub) return;
    res.json({
      account: await status(sub.id),
      handovers: await handovers(sub.id),
      collections: await collections(sub.id),
    });
  });

  router.post('/sub-admins/:id/handover', async (req, res) => {
    const parsed = handoverBody.safeParse(req.body);
    if (!parsed.success) return res.status(400).json({ error: 'invalid_input' });
    const sub = await loadSubAdmin(req, res);
    if (!sub) return;
    const b = parsed.data;

    const result = await db.rpc('admin_create_handover', {
      p_sub_admin_id: sub.id,
      p_received_by: req.admin.id,
      p_expected_tpos: b.expected_tpos,
      p_expected_count: b.expected_count,
      p_received: b.received,
      p_note: b.note || null,
    });
    if (result.result !== 'ok') {
      return res.status(ERROR_STATUS[result.result] ?? 500).json({ error: result.result });
    }

    await logActivity(req.admin, 'handover_receive', {
      sub_admin_id: sub.id,
      handover_id: result.handoverId,
      received: b.received,
      remaining: result.remainingBalance,
    });
    res.json({ handover_id: result.handoverId, remaining_balance: result.remainingBalance });
  });

  router.post('/sub-admins/:id/tpos-rate', async (req, res) => {
    const parsed = rateBody.safeParse(req.body);
    if (!parsed.success) return res.status(400).json({ error: 'invalid_input' });
    const sub = await loadSubAdmin(req, res);
    if (!sub) return;

    await db.update('admins', { id: `eq.${sub.id}`, role: 'eq.sub_admin' }, { tpos_amount: parsed.data.tpos_amount });
    await logActivity(req.admin, 'sub_admin_rate', { sub_admin_id: sub.id, tpos_amount: parsed.data.tpos_amount });
    res.json({ account: await status(sub.id) });
  });
}
