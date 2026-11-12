import { z } from 'zod';
import { db } from './db.js';
import { logActivity } from './logs.js';
import { chargeMessage } from './messages.js';
import { sendTposMessage } from './whatsapp.js';

const uuid = z.uuid();

const CHARGE_FIELDS = 'id,isp_id,month,year,amount,tpos_amount,status,period_start,period_end,paid_at,collected_at,approved_at,collector:admins!isp_charges_history_collected_by_fkey(name,role)';

const RESULT_STATUS = { forbidden: 403, not_found: 404, bad_state: 409 };

function showCollector(charge) {
  const { collector, ...rest } = charge;
  let collectedBy = null;
  if (collector) collectedBy = collector.role === 'sub_admin' ? collector.name : 'TPOS';
  return { ...rest, collected_by: collectedBy };
}

async function notify(result) {
  if (!/^03[0-9]{9}$/.test(result.phone || '')) return 'skipped';
  try {
    await sendTposMessage(result.phone, chargeMessage(result));
    return 'sent';
  } catch (err) {
    console.error(`whatsapp send failed: ${err.message}`);
    return 'failed';
  }
}

async function runAction(req, res, action) {
  const parsed = uuid.safeParse(req.params.id);
  if (!parsed.success) return res.status(400).json({ error: 'invalid_input' });

  const result = await db.rpc('admin_isp_charge_action', {
    p_charge_id: parsed.data,
    p_action: action,
    p_admin_id: req.admin.id,
  });
  if (result.result !== 'ok') {
    return res.status(RESULT_STATUS[result.result] ?? 500).json({ error: result.result, status: result.status });
  }

  // The bill is already saved; a WhatsApp failure never undoes it.
  const whatsapp = result.status === 'paid' ? await notify(result) : null;

  await logActivity(req.admin, `isp_charge_${action}`, {
    charge_id: parsed.data,
    isp_id: result.isp_id,
    amount: result.amount,
    whatsapp,
  });
  res.json({
    status: result.status,
    whatsapp,
    subscription_expiry: result.subscription_expiry ?? null,
  });
}

// createdBy limits the list to the sub admin's own ISPs.
export function chargeRoutes(router, { createdBy, superAdmin = false } = {}) {
  router.get('/isps/:id/charges', async (req, res) => {
    const parsed = uuid.safeParse(req.params.id);
    if (!parsed.success) return res.status(400).json({ error: 'invalid_input' });

    const query = { select: 'id', id: `eq.${parsed.data}`, limit: '1' };
    if (createdBy) query.created_by = `eq.${createdBy(req)}`;
    const [isp] = await db.select('isp_accounts', query);
    if (!isp) return res.status(404).json({ error: 'not_found' });

    const charges = await db.select('isp_charges_history', {
      select: CHARGE_FIELDS,
      isp_id: `eq.${isp.id}`,
      order: 'year.desc,month.desc,period_start.desc.nullslast',
      limit: '120',
    });
    res.json({ charges: charges.map(showCollector) });
  });

  if (!superAdmin) {
    router.post('/charges/:id/collect', (req, res) => runAction(req, res, 'collect'));
    return;
  }

  router.get('/approvals', async (req, res) => {
    const rows = await db.select('isp_charges_history', {
      select: `${CHARGE_FIELDS},isp:isp_accounts(business_name,phone)`,
      status: 'eq.pending_approval',
      order: 'collected_at.asc',
      limit: '200',
    });
    res.json({ approvals: rows.map(showCollector) });
  });

  router.post('/charges/:id/approve', (req, res) => runAction(req, res, 'approve'));
  router.post('/charges/:id/reject', (req, res) => runAction(req, res, 'reject'));
  router.post('/charges/:id/paid', (req, res) => runAction(req, res, 'paid_direct'));
}
