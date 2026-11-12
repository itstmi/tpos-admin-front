// Admin alerts on WhatsApp from TPOS's own session to the number the super admin saved in the panel.
// One alert of a kind per 30 minutes; an alert never slows or breaks the request that raised it.
import { z } from 'zod';
import { db } from './db.js';
import { logActivity } from './logs.js';
import { sendTposMessage, whatsappReady } from './whatsapp.js';

const QUIET_MS = 30 * 60 * 1000;
const PHONE_TTL_MS = 10 * 60 * 1000;
const ERROR_WINDOW_MS = 5 * 60 * 1000;
const ERROR_SPIKE = 10;

const lastSent = new Map();
const serverErrors = [];
let phoneCache = { value: null, at: 0 };

function pkTime() {
  return new Intl.DateTimeFormat('en-GB', {
    timeZone: 'Asia/Karachi', day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit', hour12: true,
  }).format(new Date());
}

async function readPhone() {
  const [row] = await db.select('admin_settings', { select: 'value', key: 'eq.alert_phone' });
  return row?.value || null;
}

// A stale number is kept if the DB cannot be read (the DB itself may be the alert)
async function alertPhone() {
  if (Date.now() - phoneCache.at < PHONE_TTL_MS) return phoneCache.value;
  try {
    phoneCache = { value: await readPhone(), at: Date.now() };
  } catch (err) {
    console.error(`alert phone read failed: ${err.message}`);
  }
  return phoneCache.value;
}

async function deliver(kind, text) {
  const phone = await alertPhone();
  if (!phone) {
    console.warn(`alert ${kind} not sent: no alert number saved`);
    return;
  }
  try {
    await sendTposMessage(phone, `TPOS Alert: ${text} (${pkTime()} PKT)`);
  } catch (err) {
    console.error(`alert ${kind} not sent: ${err.message}`);
  }
}

export function raiseAlert(kind, text) {
  const now = Date.now();
  if (now - (lastSent.get(kind) ?? 0) < QUIET_MS) return;
  lastSent.set(kind, now);
  deliver(kind, text).catch((err) => console.error(`alert ${kind} failed: ${err.message}`));
}

// Called by the server's error handler for every 500
export function noteServerError(err) {
  const now = Date.now();
  serverErrors.push(now);
  while (serverErrors.length && now - serverErrors[0] > ERROR_WINDOW_MS) serverErrors.shift();
  if (serverErrors.length >= ERROR_SPIKE) {
    raiseAlert('server_errors', `${serverErrors.length} server errors in the admin API in the last 5 minutes.`);
  }
  const unreachable = err?.name === 'TimeoutError' || (err?.name === 'TypeError' && /fetch failed/i.test(err.message));
  if (unreachable) raiseAlert('db_unreachable', 'Admin API cannot reach the database (.80).');
}

const phoneBody = z.object({
  phone: z.union([z.literal(''), z.string().trim().regex(/^03[0-9]{9}$/)]),
}).strict();

// Panel (super admin) only
export function alertRoutes(router) {
  router.get('/alerts', async (req, res) => {
    res.json({ phone: await readPhone(), whatsapp_ready: whatsappReady });
  });

  router.post('/alerts/phone', async (req, res) => {
    const parsed = phoneBody.safeParse(req.body);
    if (!parsed.success) return res.status(400).json({ error: 'invalid_input' });
    const value = parsed.data.phone || null;
    const patch = { value, updated_by: req.admin.id, updated_at: new Date().toISOString() };
    const rows = await db.update('admin_settings', { key: 'eq.alert_phone' }, patch);
    if (!rows.length) await db.insert('admin_settings', { key: 'alert_phone', ...patch });
    phoneCache = { value, at: Date.now() };
    await logActivity(req.admin, 'alert_phone_update', { set: Boolean(value), last4: value ? value.slice(-4) : null });
    res.json({ phone: value });
  });

  // Sends at once (no 30 minute rule) so the number can be checked
  router.post('/alerts/test', async (req, res) => {
    const phone = await readPhone();
    if (!phone) return res.status(409).json({ error: 'no_alert_phone' });
    try {
      await sendTposMessage(phone, `TPOS Alert: test message from the admin panel (${pkTime()} PKT)`);
      res.json({ sent: true });
    } catch (err) {
      res.json({ sent: false, reason: err.message });
    }
  });
}
