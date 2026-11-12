// Live login test on tposadminfront. Makes a throwaway sub admin, always removes it at the end.
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import http from 'node:http';
import { db } from '../src/db.js';

const PORT = Number(process.env.PORT);
const APP_HOST = process.env.APP_HOST;
const KEY = process.env.APP_CLIENT_KEY;
const USERNAME = 't83_sub_test';
const PASSWORD = 'T83-test-password-only';

function call(method, path, { token, device, body } = {}) {
  const data = body ? JSON.stringify(body) : '';
  const headers = { Host: APP_HOST, 'X-App-Key': KEY };
  if (token) headers.Authorization = `Bearer ${token}`;
  if (device) headers['X-Device-Id'] = device;
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

const login = (password, device) =>
  call('POST', '/api/app/login', { body: { username: USERNAME, password, device_id: device } });

const step = (name, ok) => console.log(`${ok ? 'PASS' : 'FAIL'} ${name}`);

const [existing] = await db.select('admins', { select: 'id', username: `eq.${USERNAME}` });
assert.equal(existing, undefined, 'test admin already exists');

const [admin] = await db.insert('admins', {
  name: 'T83 Test',
  username: USERNAME,
  password_hash: createHash('sha256').update(PASSWORD).digest('hex'),
  role: 'sub_admin',
  is_active: true,
});

try {
  let r = await login(PASSWORD, 'device-one-1');
  step('login (old SHA-256 password)', r.status === 200 && r.body.token);
  const tokenOne = r.body.token;

  const [after] = await db.select('admins', { select: 'password_hash', id: `eq.${admin.id}` });
  step('password moved to argon2id', after.password_hash.startsWith('$argon2id$'));

  r = await call('GET', '/api/app/me', { token: tokenOne, device: 'device-one-1' });
  step('me with token', r.status === 200 && r.body.admin.username === USERNAME);

  r = await call('GET', '/api/app/me', { token: tokenOne, device: 'device-other' });
  step('me from other device refused', r.status === 401);

  r = await login(PASSWORD, 'device-two-2');
  step('login again (argon2id)', r.status === 200);
  const tokenTwo = r.body.token;

  r = await call('GET', '/api/app/me', { token: tokenOne, device: 'device-one-1' });
  step('old device logged out', r.status === 401);

  r = await call('GET', '/api/app/isps', { token: tokenTwo, device: 'device-two-2' });
  step('own ISP list (none for test admin)', r.status === 200 && Array.isArray(r.body.isps) && r.body.isps.length === 0);
  const [someIsp] = await db.select('isp_accounts', { select: 'id', limit: '1' });
  r = await call('GET', `/api/app/isps/${someIsp.id}`, { token: tokenTwo, device: 'device-two-2' });
  step('other admin ISP refused', r.status === 404);
  r = await call('GET', '/api/app/isps/not-a-uuid', { token: tokenTwo, device: 'device-two-2' });
  step('bad ISP id refused', r.status === 400);

  r = await call('POST', '/api/app/logout', { token: tokenTwo, device: 'device-two-2' });
  step('logout', r.status === 200);
  r = await call('GET', '/api/app/me', { token: tokenTwo, device: 'device-two-2' });
  step('token dead after logout', r.status === 401);

  for (let i = 0; i < 5; i += 1) await login('wrong password', 'device-two-2');
  r = await login(PASSWORD, 'device-two-2');
  step('locked after 5 wrong passwords', r.status === 429);

  const logs = await db.select('activity_logs', { select: 'action,user_type', user_id: `eq.${admin.id}` });
  const count = (a) => logs.filter((l) => l.action === a).length;
  step(`activity logs (login ${count('login')}, failed ${count('login_failed')}, logout ${count('logout')})`,
    count('login') === 2 && count('login_failed') === 5 && count('logout') === 1);
} finally {
  await db.remove('admin_sessions', { admin_id: `eq.${admin.id}` });
  await db.remove('activity_logs', { user_id: `eq.${admin.id}` });
  await db.remove('admins', { id: `eq.${admin.id}` });
  const left = await db.select('admins', { select: 'id', username: `eq.${USERNAME}` });
  console.log(left.length === 0 ? 'CLEANUP OK' : 'CLEANUP FAILED');
}
