// Live sub admin management test on tposadminfront: create (Argon2id from the API code), login, block with ISPs,
// unblock, password reset, delete with ISP move. Super admin parts run in the DB directly (panel needs Cloudflare).
import { createHash } from 'node:crypto';
import http from 'node:http';
import { db } from '../src/db.js';
import { hashPassword } from '../src/passwords.js';
import { generatePassword } from '../src/passwordGen.js';

const PORT = Number(process.env.PORT);
const APP_HOST = process.env.APP_HOST;
const KEY = process.env.APP_CLIENT_KEY;
const USERNAME = 't84_mgr_test';
const PASSWORD = generatePassword();
const DEVICE = 'device-mgr-1';

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
const login = (password) => call('POST', '/api/app/login', { body: { username: USERNAME, password, device_id: DEVICE } });
const [superAdmin] = await db.select('admins', { select: 'id', role: 'eq.super_admin', limit: '1' });
let subId = null;
let createdId = null;

try {
  let x = await db.rpc('admin_create_sub_admin', {
    p_super_id: superAdmin.id, p_name: 'T84 Manager', p_username: USERNAME, p_password_hash: await hashPassword(PASSWORD),
    p_city: 'Lahore', p_tpos_amount: 2000, p_trial_limit: 2,
  });
  subId = x.sub_admin_id;
  createdId = subId;
  step('create', x.result === 'ok');
  x = await db.rpc('admin_create_sub_admin', {
    p_super_id: superAdmin.id, p_name: 'T84 Again', p_username: USERNAME.toUpperCase(), p_password_hash: await hashPassword(PASSWORD),
    p_city: 'Lahore', p_tpos_amount: 2000, p_trial_limit: 2,
  });
  step('same username refused', x.result === 'USERNAME_EXISTS');
  const [row] = await db.select('admins', { select: 'role,city,tpos_amount,trial_limit,password_hash', id: `eq.${subId}` });
  step('fields', row.role === 'sub_admin' && row.city === 'Lahore' && Number(row.tpos_amount) === 2000 && row.trial_limit === 2
    && row.password_hash.startsWith('$argon2id$'));

  let r = await login(PASSWORD);
  const token = r.body?.token;
  step('login with generated password', r.status === 200 && token);

  r = await call('POST', '/api/app/isps', { token, body: {
    business_name: 'T84 Mgr Net', owner_name: 'T84 Owner', phone: `03${String(Math.floor(Math.random() * 1e9)).padStart(9, '0')}`,
    password: 'T84-owner-pass', monthly_charges: 2500, city: 'Lahore', trial: false } });
  const ispId = r.body?.isp_id;
  step('sub admin makes an ISP', r.status === 201);

  x = await db.rpc('admin_set_sub_admin_block', { p_super_id: superAdmin.id, p_sub_id: subId, p_block: true, p_isps: true });
  step('block with ISPs', x.result === 'ok' && x.isps === 1);
  r = await call('GET', '/api/app/me', { token });
  step('old token dead', r.status === 401);
  r = await login(PASSWORD);
  step('blocked login refused', r.status === 403);
  const [blockedIsp] = await db.select('isp_accounts', { select: 'status,block_reason', id: `eq.${ispId}` });
  const [owner] = await db.select('isp_users', { select: 'is_blocked', isp_id: `eq.${ispId}`, role: 'eq.owner' });
  step('ISP and owner blocked', blockedIsp.block_reason === 'sub_admin_blocked' && owner.is_blocked === true);

  x = await db.rpc('admin_set_sub_admin_block', { p_super_id: superAdmin.id, p_sub_id: subId, p_block: false, p_isps: true });
  const [openIsp] = await db.select('isp_accounts', { select: 'status', id: `eq.${ispId}` });
  r = await login(PASSWORD);
  step('unblock opens login and ISP', x.result === 'ok' && openIsp.status === 'active' && r.status === 200);

  const fresh = generatePassword();
  await db.update('admins', { id: `eq.${subId}`, role: 'eq.sub_admin' }, { password_hash: await hashPassword(fresh) });
  await db.remove('admin_sessions', { admin_id: `eq.${subId}` });
  r = await login(PASSWORD);
  step('old password refused after reset', r.status === 401);
  r = await login(fresh);
  step('new password works', r.status === 200);

  x = await db.rpc('admin_delete_sub_admin', { p_super_id: subId, p_sub_id: subId });
  step('sub admin cannot delete', x.result === 'NOT_ALLOWED');
  x = await db.rpc('admin_delete_sub_admin', { p_super_id: superAdmin.id, p_sub_id: subId });
  const [moved] = await db.select('isp_accounts', { select: 'created_by,transferred_from_name', id: `eq.${ispId}` });
  step('delete moves ISP', x.result === 'ok' && x.isps_moved === 1 && moved.created_by === superAdmin.id && moved.transferred_from_name === 'T84 Manager');
  if (x.result === 'ok') subId = null;
} finally {
  await db.remove('isp_accounts', { business_name: 'eq.T84 Mgr Net' });
  if (subId) {
    await db.remove('admin_sessions', { admin_id: `eq.${subId}` });
    await db.remove('admins', { id: `eq.${subId}` });
  }
  if (createdId) await db.remove('activity_logs', { user_id: `eq.${createdId}` });
  const left = await db.select('admins', { select: 'id', username: `eq.${USERNAME}` });
  const isps = await db.select('isp_accounts', { select: 'id', business_name: 'eq.T84 Mgr Net' });
  console.log(left.length === 0 && isps.length === 0 ? 'CLEANUP OK' : 'CLEANUP CHECK FAILED');
}
