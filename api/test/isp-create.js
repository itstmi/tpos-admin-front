// Live ISP create and trial test on tposadminfront. A throwaway sub admin makes a paid ISP and trial ISPs;
// every ISP it made, its logs and the admin are removed at the end. Super admin parts run in the DB directly.
import { createHash } from 'node:crypto';
import http from 'node:http';
import { db } from '../src/db.js';

const PORT = Number(process.env.PORT);
const APP_HOST = process.env.APP_HOST;
const KEY = process.env.APP_CLIENT_KEY;
const USERNAME = 't84_isp_test';
const PASSWORD = 'T84-isp-test-only';
const DEVICE = 'device-isp-1';

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
const rnd = () => `03${String(Math.floor(Math.random() * 1e9)).padStart(9, '0')}`;
const isp = (trial, phone = rnd(), extra = {}) => ({
  business_name: 'T84 Test Net', owner_name: 'T84 Owner', phone, password: 'T84-owner-pass', monthly_charges: 2500, city: 'Lahore', trial, ...extra,
});
const [superAdmin] = await db.select('admins', { select: 'id', role: 'eq.super_admin', limit: '1' });

const [admin] = await db.insert('admins', {
  name: 'T84 Isp',
  username: USERNAME,
  password_hash: createHash('sha256').update(PASSWORD).digest('hex'),
  role: 'sub_admin',
  is_active: true,
  trial_limit: 1,
});

try {
  let r = await call('POST', '/api/app/login', { body: { username: USERNAME, password: PASSWORD, device_id: DEVICE } });
  const token = r.body?.token;
  step('login', r.status === 200 && token);

  r = await call('POST', '/api/app/isps', { token, body: isp(false) });
  step('no rate refused', r.status === 409 && r.body.error === 'RATE_NOT_SET');
  await db.update('admins', { id: `eq.${admin.id}` }, { tpos_amount: 2000 });

  r = await call('GET', '/api/app/isps-new', { token });
  step('new ISP info', r.body.tpos_amount == 2000 && r.body.trial_days === 7 && r.body.trial_limit === 1 && r.body.trials_used === 0);

  r = await call('POST', '/api/app/isps', { token, body: isp(false, rnd(), { tpos_amount: 1 }) });
  step('tpos amount from app refused', r.status === 400);
  r = await call('POST', '/api/app/isps', { token, body: isp(false, rnd(), { monthly_charges: 1500 }) });
  step('charges below tpos refused', r.body?.error === 'CHARGES_BELOW_TPOS');
  r = await call('POST', '/api/app/isps', { token, body: isp(false, '0300') });
  step('bad phone refused', r.status === 400);

  const paidPhone = rnd();
  r = await call('POST', '/api/app/isps', { token, body: isp(false, paidPhone) });
  const paidId = r.body?.isp_id;
  step('paid ISP made', r.status === 201 && r.body.trial === false && r.body.tpos_amount == 2000);
  const [paid] = await db.select('isp_accounts', { select: 'city,bill_start,connection_date,trial_ends_at,created_by,password_hash', id: `eq.${paidId}` });
  const bills = await db.select('isp_charges_history', { select: 'amount,tpos_amount,status', isp_id: `eq.${paidId}` });
  const [owner] = await db.select('isp_users', { select: 'role,password_hash', isp_id: `eq.${paidId}` });
  step('paid ISP fields', paid.city === 'Lahore' && paid.bill_start === paid.connection_date && !paid.trial_ends_at
    && paid.created_by === admin.id && bills.length === 1 && Number(bills[0].tpos_amount) === 2000
    && owner?.role === 'owner' && owner.password_hash === createHash('sha256').update('T84-owner-pass').digest('hex'));

  r = await call('POST', '/api/app/isps', { token, body: isp(false, paidPhone) });
  step('same phone refused', r.body?.error === 'PHONE_EXISTS');

  r = await call('POST', '/api/app/isps', { token, body: isp(true) });
  const trialId = r.body?.isp_id;
  step('trial ISP made (7 days)', r.status === 201 && r.body.trial === true && r.body.trial_ends_at);
  r = await call('POST', '/api/app/isps', { token, body: isp(true) });
  step('trial limit', r.body?.error === 'TRIAL_LIMIT');

  // what the nightly job does when the trial runs out
  await db.update('isp_accounts', { id: `eq.${trialId}` }, {
    status: 'blocked', blocked_by: 'super_admin', block_reason: 'trial', blocked_by_role: 'super_admin', blocked_by_name: 'Trial ended',
  });
  r = await call('POST', `/api/app/isps/${trialId}/block`, { token, body: { blocked: false } });
  step('plain unblock of trial refused', r.status === 409 && r.body.error === 'trial_ended');

  let x = await db.rpc('admin_isp_extend_trial', { p_isp_id: trialId, p_admin_id: admin.id, p_days: 5 });
  step('sub admin cannot extend', x.result === 'NOT_ALLOWED');

  r = await call('POST', `/api/app/isps/${trialId}/make-paid`, { token });
  const [made] = await db.select('isp_accounts', { select: 'status,bill_start,trial_ends_at', id: `eq.${trialId}` });
  step('make paid opens and bills', r.status === 200 && made.status === 'active' && made.bill_start && !made.trial_ends_at);
  r = await call('POST', `/api/app/isps/${trialId}/make-paid`, { token });
  step('paid again refused', r.body?.error === 'NOT_TRIAL');

  const [other] = await db.select('isp_accounts', { select: 'id', created_by: `neq.${admin.id}`, limit: '1' });
  r = await call('POST', `/api/app/isps/${other.id}/make-paid`, { token });
  step('other ISP refused', r.status === 404);

  x = await db.rpc('admin_create_isp', {
    p_admin_id: superAdmin.id, p_business_name: 'T84 Super Trial', p_owner_name: 'T84 Owner', p_phone: rnd(),
    p_password_hash: createHash('sha256').update('x').digest('hex'), p_monthly_charges: 3000, p_city: 'Multan',
    p_trial: true, p_trial_days: 15, p_tpos_amount: 2500,
  });
  step('super trial with own days', x.result === 'ok');
  const superTrial = x.isp_id;
  x = await db.rpc('admin_isp_extend_trial', { p_isp_id: superTrial, p_admin_id: superAdmin.id, p_days: 10 });
  step('super extend', x.result === 'ok');

  const logs = await db.select('activity_logs', { select: 'action', user_id: `eq.${admin.id}`, action: 'in.(isp_create,isp_make_paid)' });
  step(`logs ${logs.length}`, logs.length === 3);
} finally {
  await db.remove('isp_accounts', { created_by: `eq.${admin.id}` });
  await db.remove('isp_accounts', { business_name: 'eq.T84 Super Trial' });
  await db.remove('admin_sessions', { admin_id: `eq.${admin.id}` });
  await db.remove('activity_logs', { user_id: `eq.${admin.id}` });
  await db.remove('admins', { id: `eq.${admin.id}` });
  const left = await db.select('isp_accounts', { select: 'id', business_name: 'in.("T84 Test Net","T84 Super Trial")' });
  const gone = await db.select('admins', { select: 'id', username: `eq.${USERNAME}` });
  console.log(left.length === 0 && gone.length === 0 ? 'CLEANUP OK' : 'CLEANUP CHECK FAILED');
}
