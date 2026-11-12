// Live ISP bill test on tposadminfront. A throwaway sub admin is given one ISP that has a pending charge;
// the charge, the ISP (owner admin, expiry, status) and the admin are put back at the end.
// Super admin actions run through the DB function directly (the panel needs a Cloudflare login).
import { createHash } from 'node:crypto';
import http from 'node:http';
import { db } from '../src/db.js';

const PORT = Number(process.env.PORT);
const APP_HOST = process.env.APP_HOST;
const KEY = process.env.APP_CLIENT_KEY;
const USERNAME = 't84_bill_test';
const PASSWORD = 'T84-bill-test-only';
const DEVICE = 'device-bill-1';

function call(method, path, { token, body } = {}) {
  const data = body ? JSON.stringify(body) : '';
  const headers = { Host: APP_HOST, 'X-App-Key': KEY, 'X-Device-Id': DEVICE };
  if (token) headers.Authorization = `Bearer ${token}`;
  if (body) Object.assign(headers, { 'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(data) });
  return new Promise((resolve, reject) => {
    const req = http.request({ host: '127.0.0.1', port: PORT, method, path, headers }, (res) => {
      let text = '';
      res.on('data', (c) => (text += c));
      res.on('end', () => resolve({ status: res.statusCode, body: text ? JSON.parse(text) : null }));
    });
    req.on('error', reject);
    req.end(data);
  });
}

const step = (name, ok) => console.log(`${ok ? 'PASS' : 'FAIL'} ${name}`);
const action = (id, act, adminId) => db.rpc('admin_isp_charge_action', { p_charge_id: id, p_action: act, p_admin_id: adminId });

const CHARGE_COLS = 'id,isp_id,status,paid_at,marked_by,approved_by,approved_at,collected_by,collected_at';
const [charge] = await db.select('isp_charges_history', { select: CHARGE_COLS, status: 'eq.pending', order: 'created_at.desc', limit: '1' });
if (!charge) throw new Error('no pending charge to test with');
const [isp] = await db.select('isp_accounts', { select: 'id,created_by,status,subscription_expiry', id: `eq.${charge.isp_id}` });
const [superAdmin] = await db.select('admins', { select: 'id', role: 'eq.super_admin', limit: '1' });

const [admin] = await db.insert('admins', {
  name: 'T84 Bill',
  username: USERNAME,
  password_hash: createHash('sha256').update(PASSWORD).digest('hex'),
  role: 'sub_admin',
  is_active: true,
});

try {
  let r = await call('POST', '/api/app/login', { body: { username: USERNAME, password: PASSWORD, device_id: DEVICE } });
  const token = r.body?.token;
  step('login', r.status === 200 && token);

  r = await call('GET', `/api/app/isps/${isp.id}/charges`, { token });
  step('other admin ISP charges refused', r.status === 404);
  r = await call('POST', `/api/app/charges/${charge.id}/collect`, { token });
  step('other admin ISP collect refused', r.status === 404);
  r = await call('POST', '/api/app/charges/not-a-uuid/collect', { token });
  step('bad id refused', r.status === 400);

  await db.update('isp_accounts', { id: `eq.${isp.id}` }, { created_by: admin.id });

  r = await call('GET', `/api/app/isps/${isp.id}/charges`, { token });
  step('own ISP charges', r.status === 200 && r.body.charges.some((c) => c.id === charge.id));

  r = await call('POST', `/api/app/charges/${charge.id}/collect`, { token });
  step('collect', r.status === 200 && r.body.status === 'pending_approval' && r.body.whatsapp === null);
  r = await call('POST', `/api/app/charges/${charge.id}/collect`, { token });
  step('collect twice refused', r.status === 409);

  let a = await action(charge.id, 'approve', admin.id);
  step('sub admin cannot approve', a.result === 'forbidden');

  a = await action(charge.id, 'reject', superAdmin.id);
  const [rejected] = await db.select('isp_charges_history', { select: 'status,collected_by,marked_by', id: `eq.${charge.id}` });
  step('reject', a.result === 'ok' && rejected.status === 'pending' && !rejected.collected_by && !rejected.marked_by);

  await call('POST', `/api/app/charges/${charge.id}/collect`, { token });
  a = await action(charge.id, 'approve', superAdmin.id);
  step('approve', a.result === 'ok' && a.status === 'paid' && a.collected_by_name === 'T84 Bill');
  step(`expiry ${isp.subscription_expiry} -> ${a.subscription_expiry}`, a.subscription_expiry !== isp.subscription_expiry);

  r = await call('GET', `/api/app/isps/${isp.id}/charges`, { token });
  const shown = r.body.charges.find((c) => c.id === charge.id);
  step('list shows sub admin name', shown?.status === 'paid' && shown.collected_by === 'T84 Bill');

  a = await action(charge.id, 'paid_direct', superAdmin.id);
  step('paid twice refused', a.result === 'bad_state');

  const logs = await db.select('activity_logs', { select: 'action', user_id: `eq.${admin.id}`, action: 'eq.isp_charge_collect' });
  step(`collect logs ${logs.length}`, logs.length === 2);
} finally {
  const { id, isp_id: ignored, ...fields } = charge;
  await db.update('isp_charges_history', { id: `eq.${id}` }, fields);
  await db.update('isp_accounts', { id: `eq.${isp.id}` }, {
    created_by: isp.created_by,
    status: isp.status,
    subscription_expiry: isp.subscription_expiry,
  });
  await db.remove('admin_sessions', { admin_id: `eq.${admin.id}` });
  await db.remove('activity_logs', { user_id: `eq.${admin.id}` });
  await db.remove('admins', { id: `eq.${admin.id}` });
  const [c] = await db.select('isp_charges_history', { select: 'status,collected_by', id: `eq.${charge.id}` });
  const [back] = await db.select('isp_accounts', { select: 'created_by,status,subscription_expiry', id: `eq.${isp.id}` });
  const left = await db.select('admins', { select: 'id', username: `eq.${USERNAME}` });
  const same = c.status === charge.status && c.collected_by === charge.collected_by && back.created_by === isp.created_by
    && back.status === isp.status && back.subscription_expiry === isp.subscription_expiry && left.length === 0;
  console.log(same ? 'RESTORE OK' : 'RESTORE CHECK FAILED');
}
