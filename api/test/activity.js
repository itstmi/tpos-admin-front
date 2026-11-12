// Live logs test on tposadminfront: ISP activity, login logs and staff logs read the real data (nothing changed),
// and a throwaway sub admin checks the app route shows him only himself. Panel routes need Cloudflare, so their
// DB functions are called directly; the route code is the same.
import http from 'node:http';
import { db } from '../src/db.js';
import { hashPassword } from '../src/passwords.js';
import { generatePassword } from '../src/passwordGen.js';

const PORT = Number(process.env.PORT);
const APP_HOST = process.env.APP_HOST;
const KEY = process.env.APP_CLIENT_KEY;
const USERNAME = 't85_logs_test';
const PASSWORD = generatePassword();
const DEVICE = 'device-logs-1';

function call(method, path, { token, body } = {}) {
  const data = body ? JSON.stringify(body) : '';
  const headers = { Host: APP_HOST, 'X-App-Key': KEY, 'X-Device-Id': DEVICE };
  if (token) headers.Authorization = `Bearer ${token}`;
  if (body) Object.assign(headers, { 'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(data) });
  return new Promise((resolve, reject) => {
    const req = http.request({ host: '127.0.0.1', port: PORT, method, path, headers }, (res) => {
      let text = '';
      res.on('data', (c) => (text += c));
      res.on('end', () => {
        let body = null;
        try { body = text ? JSON.parse(text) : null; } catch { body = text; }
        resolve({ status: res.statusCode, body });
      });
    });
    req.on('error', reject);
    req.end(data);
  });
}

const step = (name, ok, extra = '') => console.log(`${ok ? 'PASS' : 'FAIL'} ${name}${extra ? ` (${extra})` : ''}`);
const activity = (isp, user, search, page) =>
  db.rpc('admin_isp_activity', { p_isp_id: isp, p_user: user, p_search: search, p_page: page });

const [superAdmin] = await db.select('admins', { select: 'id', role: 'eq.super_admin', limit: '1' });
let subId = null;

try {
  // ISP with the most owner/collector logs is picked by trying each ISP's first page
  const isps = await db.select('isp_accounts', { select: 'id,business_name', order: 'created_at.asc' });
  let best = null;
  for (const isp of isps) {
    const a = await activity(isp.id, null, null, 1);
    if (!best || a.total > best.total) best = { ...a, isp };
  }
  step('isp activity page 1', best && best.found && best.items.length === Math.min(50, best.total)
    && best.pages === Math.max(1, Math.ceil(best.total / 50)), `${best.total} logs, ${best.pages} pages`);
  const times = best.items.map((i) => i.created_at);
  step('newest first', times.every((t, i) => i === 0 || times[i - 1] >= t));

  let sum = (await activity(best.isp.id, 'system', null, 1)).total;
  for (const u of best.users) sum += (await activity(best.isp.id, u.id, null, 1)).total;
  step('users + system add up to total', sum === best.total, `${best.users.length} users`);

  const last = await activity(best.isp.id, null, null, best.pages);
  step('last page size', last.items.length === best.total - (best.pages - 1) * 50 || best.total === 0);

  const name = best.items.map((i) => i.details?.customer_name).find(Boolean);
  if (name) {
    const s = await activity(best.isp.id, null, name.slice(0, 4), 1);
    step('customer name search', s.total > 0 && s.total <= best.total, `${s.total}`);
  }
  step('search nothing found', (await activity(best.isp.id, null, 'zz%_no_such_name_zz', 1)).total === 0);
  step('unknown ISP', (await activity('00000000-0000-0000-0000-000000000000', null, null, 1)).found === false);
  step('bad user refused', (await activity(best.isp.id, 'owner', null, 1)) === null);

  const logins = await db.rpc('admin_login_logs', { p_viewer: superAdmin.id, p_isp_id: null, p_page: 1 });
  step('super login logs only login/logout', logins.items.every((i) => ['login', 'logout'].includes(i.event)), `${logins.total}`);
  const staff = await db.rpc('admin_staff_logs', { p_admin_id: superAdmin.id, p_page: 1 });
  step('staff logs super only', staff.items.every((i) => i.role === 'super_admin'), `${staff.total}`);

  const x = await db.rpc('admin_create_sub_admin', {
    p_super_id: superAdmin.id, p_name: 'T85 Logs', p_username: USERNAME, p_password_hash: await hashPassword(PASSWORD),
    p_city: 'Lahore', p_tpos_amount: 2000, p_trial_limit: 0,
  });
  subId = x.sub_admin_id;
  const r1 = await call('POST', '/api/app/login', { body: { username: USERNAME, password: PASSWORD, device_id: DEVICE } });
  const token = r1.body?.token;
  step('sub admin login', r1.status === 200 && token);
  const r2 = await call('GET', '/api/app/logs/logins', { token });
  step('app logs: only himself', r2.status === 200 && r2.body.total === 1 && r2.body.items[0].name === 'T85 Logs'
    && r2.body.items[0].event === 'login', `${r2.body?.total}`);
  const r3 = await call('GET', `/api/app/logs/logins?isp=${best.isp.id}`, { token });
  step('app logs: other ISP empty', r3.status === 200 && r3.body.total === 0);
  const r4 = await call('GET', `/api/app/isps/${best.isp.id}/activity`, { token });
  step('app has no ISP activity route', r4.status === 404);
  const r5 = await call('GET', '/api/app/logs/logins?page=0', { token });
  step('bad page 400', r5.status === 400);
} finally {
  if (subId) {
    await db.remove('admin_sessions', { admin_id: `eq.${subId}` });
    await db.remove('activity_logs', { user_id: `eq.${subId}` });
    await db.remove('admins', { id: `eq.${subId}` });
  }
  const left = await db.select('admins', { select: 'id', username: `eq.${USERNAME}` });
  console.log(left.length === 0 ? 'CLEANUP OK' : 'CLEANUP CHECK FAILED');
}
