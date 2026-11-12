// Live sub admin account test on tposadminfront: collect, approve, account, collections, handover.
// A throwaway sub admin is given one ISP with a pending charge; everything is put back at the end.
// Super admin actions run through the DB functions directly (the panel needs a Cloudflare login).
import { createHash } from 'node:crypto';
import http from 'node:http';
import { db } from '../src/db.js';

const PORT = Number(process.env.PORT);
const APP_HOST = process.env.APP_HOST;
const KEY = process.env.APP_CLIENT_KEY;
const USERNAME = 't84_hand_test';
const PASSWORD = 'T84-hand-test-only';
const DEVICE = 'device-hand-1';

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
const n = (v) => Number(v ?? 0);

const CHARGE_COLS = 'id,isp_id,status,paid_at,marked_by,approved_by,approved_at,collected_by,collected_at';
const [charge] = await db.select('isp_charges_history', { select: `${CHARGE_COLS},amount,tpos_amount`, status: 'eq.pending', amount: 'gt.1', tpos_amount: 'gt.1', order: 'created_at.desc', limit: '1' });
if (!charge) throw new Error('no pending charge with an amount to test with');
const [isp] = await db.select('isp_accounts', { select: 'id,created_by,status,subscription_expiry', id: `eq.${charge.isp_id}` });
const [superAdmin] = await db.select('admins', { select: 'id', role: 'eq.super_admin', limit: '1' });

const [admin] = await db.insert('admins', {
  name: 'T84 Hand',
  username: USERNAME,
  password_hash: createHash('sha256').update(PASSWORD).digest('hex'),
  role: 'sub_admin',
  is_active: true,
  tpos_amount: 2000,
});

try {
  let r = await call('POST', '/api/app/login', { body: { username: USERNAME, password: PASSWORD, device_id: DEVICE } });
  const token = r.body?.token;
  step('login', r.status === 200 && token);

  r = await call('GET', '/api/app/account', { token });
  step('empty account', r.status === 200 && n(r.body.account.totalDue) === 0 && n(r.body.account.tposRate) === 2000);

  await db.update('isp_accounts', { id: `eq.${isp.id}` }, { created_by: admin.id });
  await call('POST', `/api/app/charges/${charge.id}/collect`, { token });

  r = await call('GET', '/api/app/account/collections', { token });
  const c1 = r.body?.collections?.find((c) => c.id === charge.id);
  step('collection waiting approval', c1?.status === 'pending_approval' && c1.handed_over === false && c1.business_name);
  r = await call('GET', '/api/app/account', { token });
  step('not due before approval', n(r.body.account.pendingCount) === 0);

  await db.rpc('admin_isp_charge_action', { p_charge_id: charge.id, p_action: 'approve', p_admin_id: superAdmin.id });
  r = await call('GET', '/api/app/account', { token });
  const acc = r.body.account;
  step(`due after approval ${acc.pendingTpos}/${acc.pendingIsp}/${acc.pendingProfit}`,
    n(acc.pendingCount) === 1 && n(acc.pendingTpos) === n(charge.tpos_amount) && n(acc.pendingIsp) === n(charge.amount)
    && n(acc.pendingProfit) === n(charge.amount) - n(charge.tpos_amount) && n(acc.totalDue) === n(charge.tpos_amount));

  const due = n(acc.totalDue);
  let h = await db.rpc('admin_create_handover', { p_sub_admin_id: admin.id, p_received_by: superAdmin.id, p_expected_tpos: due, p_expected_count: 1, p_received: due + 1, p_note: null });
  step('more than due refused', h.result === 'AMOUNT_EXCEEDS_DUE');
  const part = due > 1 ? due - 1 : due;
  h = await db.rpc('admin_create_handover', { p_sub_admin_id: admin.id, p_received_by: superAdmin.id, p_expected_tpos: due, p_expected_count: 1, p_received: part, p_note: 'test' });
  step('handover', h.result === 'ok' && n(h.remainingBalance) === due - part);

  r = await call('GET', '/api/app/account/handovers', { token });
  const ho = r.body?.handovers?.[0];
  step('handover history', r.status === 200 && ho && n(ho.amount) === part && n(ho.charges_count) === 1 && ho.sub_admin_name === 'T84 Hand');
  r = await call('GET', '/api/app/account/collections', { token });
  step('collection handed over', r.body.collections.find((c) => c.id === charge.id)?.handed_over === true);
  r = await call('GET', '/api/app/account', { token });
  step('account after handover', n(r.body.account.pendingCount) === 0 && n(r.body.account.previousBalance) === due - part
    && n(r.body.account.handedOver) === part);

  let locked = false;
  try {
    await db.update('isp_charges_history', { id: `eq.${charge.id}` }, { status: 'pending' });
  } catch {
    locked = true;
  }
  step('charge locked', locked);
} finally {
  await db.remove('admin_handovers', { sub_admin_id: `eq.${admin.id}` });
  const { id, isp_id: ignored, amount, tpos_amount, ...fields } = charge;
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
