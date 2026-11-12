// TPOS's own WhatsApp session, same steps as an ISP session on the backend (whatsapp.service.js).
// WAHA is reached through the local tunnel (wa-tunnel-1). Not stored in whatsapp_sessions (that table is per ISP).
import { config } from './config.js';

const SESSION = 'tpos_admin';
const TIMEOUT_MS = 20000;

const STATUS_MAP = {
  STARTING: 'connecting',
  SCAN_QR_CODE: 'scan_qr',
  WORKING: 'connected',
  FAILED: 'failed',
  STOPPED: 'disconnected',
};

export const whatsappReady = Boolean(config.wahaKey);

function toChatId(phone) {
  const digits = String(phone).replace(/\D/g, '');
  if (/^03\d{9}$/.test(digits)) return `92${digits.slice(1)}@c.us`;
  if (/^92\d{10}$/.test(digits)) return `${digits}@c.us`;
  return null;
}

async function request(method, path, { body, accept } = {}) {
  if (!whatsappReady) throw new Error('WhatsApp service is not configured');

  const headers = { 'X-Api-Key': config.wahaKey };
  if (accept) headers.Accept = accept;
  if (body !== undefined) headers['Content-Type'] = 'application/json';

  let res;
  try {
    res = await fetch(`${config.wahaUrl}${path}`, {
      method,
      headers,
      body: body === undefined ? undefined : JSON.stringify(body),
      signal: AbortSignal.timeout(TIMEOUT_MS),
    });
  } catch (err) {
    const error = new Error('WhatsApp service is not responding');
    error.code = err.name === 'TimeoutError' ? 'timeout' : 'unreachable';
    throw error;
  }

  if (!res.ok) {
    const text = await res.text();
    const error = new Error('WhatsApp request failed');
    error.status = res.status;
    // Detail stays in the server log only
    error.detail = text.slice(0, 300);
    throw error;
  }
  return res;
}

async function json(method, path, body) {
  const res = await request(method, path, { body });
  const text = await res.text();
  return text ? JSON.parse(text) : null;
}

async function getSession() {
  try {
    return await json('GET', `/api/sessions/${SESSION}`);
  } catch (err) {
    if (err.status === 404) return null;
    throw err;
  }
}

async function getConnectedNumber() {
  try {
    const me = await json('GET', `/api/sessions/${SESSION}/me`);
    const digits = (me?.id || '').split('@')[0];
    return digits ? `+${digits}` : null;
  } catch (err) {
    if (err.status === 404 || err.status === 422) return null;
    throw err;
  }
}

// Logout, then delete: a leftover session would block a new one
async function removeSession() {
  try {
    await json('POST', `/api/sessions/${SESSION}/logout`);
  } catch {
    // Already gone or not linked
  }
  try {
    await json('DELETE', `/api/sessions/${SESSION}`);
  } catch (err) {
    if (err.status !== 404) throw err;
  }
}

async function numberExists(chatId) {
  const params = new URLSearchParams({ session: SESSION, phone: chatId.split('@')[0] });
  try {
    const result = await json('GET', `/api/contacts/check-exists?${params}`);
    return result?.numberExists === true;
  } catch {
    // A failed lookup should not block the message
    return true;
  }
}

export async function sendTposMessage(phone, text) {
  const chatId = toChatId(phone);
  if (!chatId) throw new Error('Invalid phone number');

  const live = await getSession();
  if (live?.status !== 'WORKING') throw new Error('TPOS WhatsApp is not connected');
  if (!(await numberExists(chatId))) throw new Error('Number is not on WhatsApp');

  await json('POST', '/api/sendText', { session: SESSION, chatId, text });
}

function logError(what, err) {
  console.error(`whatsapp ${what} failed`, err.code || err.status || err.message, err.detail || '');
}

export function whatsappRoutes(router, { logActivity }) {
  router.get('/whatsapp/status', async (req, res) => {
    if (!whatsappReady) return res.json({ status: 'not_configured' });
    try {
      const live = await getSession();
      const status = live ? STATUS_MAP[live.status] || 'disconnected' : 'disconnected';
      const phone = status === 'connected' ? await getConnectedNumber() : null;
      res.json({ status, phone_number: phone, server_reachable: true });
    } catch (err) {
      logError('status', err);
      res.json({ status: 'unknown', phone_number: null, server_reachable: false });
    }
  });

  router.post('/whatsapp/connect', async (req, res) => {
    try {
      await removeSession();
      await json('POST', '/api/sessions', { name: SESSION, start: true, config: { debug: false } });
      await logActivity(req.admin, 'whatsapp_connect', { session: SESSION });
      res.json({ status: 'connecting' });
    } catch (err) {
      logError('connect', err);
      res.status(502).json({ error: 'whatsapp_unavailable' });
    }
  });

  router.get('/whatsapp/qr', async (req, res) => {
    try {
      const live = await getSession();
      if (!live) return res.status(404).json({ error: 'not_started' });
      if (live.status === 'WORKING') return res.json({ status: 'connected', qr: null });

      let qr = null;
      try {
        const r = await request('GET', `/api/${SESSION}/auth/qr`, { accept: 'image/png' });
        qr = `data:image/png;base64,${Buffer.from(await r.arrayBuffer()).toString('base64')}`;
      } catch (err) {
        if (err.status !== 404 && err.status !== 422) throw err;
      }
      res.set('Cache-Control', 'no-store');
      res.json({ status: qr ? 'scan_qr' : STATUS_MAP[live.status] || 'connecting', qr });
    } catch (err) {
      logError('qr', err);
      res.status(502).json({ error: 'whatsapp_unavailable' });
    }
  });

  router.post('/whatsapp/disconnect', async (req, res) => {
    try {
      await removeSession();
      await logActivity(req.admin, 'whatsapp_disconnect', { session: SESSION });
      res.json({ status: 'disconnected' });
    } catch (err) {
      logError('disconnect', err);
      res.status(502).json({ error: 'whatsapp_unavailable' });
    }
  });
}
