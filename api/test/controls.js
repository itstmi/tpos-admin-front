// Live controls test on tposadminfront. A throwaway sub admin is given one active ISP for the test;
// the ISP's owner, block fields and wrong attempts are put back at the end.
import { createHash } from 'node:crypto';
import http from 'node:http';
import { db } from '../src/db.js';

const PORT = Number(process.env.PORT);
const APP_HOST = process.env.APP_HOST;
const KEY = process.env.APP_CLIENT_KEY;
const USERNAME = 't83_ctl_test';
const PASSWORD = 'T83-controls-test-only';
const DEVICE = 'device-ctl-1';

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

const [isp] = await db.select('isp_accounts', {
  select: 'id,created_by,status,auto_bill,blocked_by,block_reason,blocked_by_role,blocked_by_name',
  status: 'eq.active',
  order: 'created_at.desc',
  limit: '1',
});
const owners = await db.select('isp_users', {
  select: 'id,is_blocked,block_reason,blocked_at,wrong_attempts',
  isp_id: `eq.${isp.id}`,
  role: 'eq.owner',
});

const [admin] = await db.insert('admins', {
  name: 'T83 Controls',
  username: USERNAME,
  password_hash: createHash('sha256').update(PASSWORD).digest('hex'),
  role: 'sub_admin',
  is_active: true,
});

try {
  let r = await call('POST', '/api/app/login', { body: { username: USERNAME, password: PASSWORD, device_id: DEVICE } });
  const token = r.body?.token;
  step('login', r.status === 200 && token);

  r = await call('GET', `/api/app/isps/${isp.id}/controls`, { token });
  step('other admin ISP controls refused', r.status === 404);
  r = await call('POST', `/api/app/isps/${isp.id}/block`, { token, body: { blocked: true } });
  step('other admin ISP block refused', r.status === 404);

  await db.update('isp_accounts', { id: `eq.${isp.id}` }, { created_by: admin.id });

  r = await call('GET', `/api/app/isps/${isp.id}/controls`, { token });
  step('own ISP controls', r.status === 200 && r.body.controls.status === 'active');

  r = await call('POST', `/api/app/isps/${isp.id}/block`, { token, body: { blocked: true } });
  step('sub admin block', r.status === 200 && r.body.controls.status === 'blocked' && r.body.controls.blocked_by_role === 'sub_admin');
  const [owner] = await db.select('isp_users', { select: 'is_blocked', isp_id: `eq.${isp.id}`, role: 'eq.owner' });
  step('owner blocked too', owner?.is_blocked === true);

  r = await call('POST', `/api/app/isps/${isp.id}/block`, { token, body: { blocked: false } });
  step('sub admin unblock', r.status === 200 && r.body.controls.status === 'active');

  await db.rpc('admin_set_isp_block', { p_isp_id: isp.id, p_block: true, p_role: 'super_admin', p_name: 'test' });
  r = await call('POST', `/api/app/isps/${isp.id}/block`, { token, body: { blocked: false } });
  step('sub admin cannot open super admin block', r.status === 403);
  await db.rpc('admin_set_isp_block', { p_isp_id: isp.id, p_block: false, p_role: 'super_admin', p_name: 'test' });

  r = await call('POST', `/api/app/isps/${isp.id}/controls`, { token, body: { control: 'whatsapp', enabled: true } });
  step('sub admin cannot use toggles', r.status === 404);
  r = await call('POST', `/api/app/isps/${isp.id}/block`, { token, body: { blocked: 'yes' } });
  step('bad input refused', r.status === 400);

  await db.rpc('set_auto_bill', { p_isp_id: isp.id, p_on: isp.auto_bill });
  step('set_auto_bill reachable (same value)', true);

  const logs = await db.select('activity_logs', { select: 'action', user_id: `eq.${admin.id}` });
  const n = (a) => logs.filter((l) => l.action === a).length;
  step(`logs (block ${n('isp_block')}, unblock ${n('isp_unblock')})`, n('isp_block') === 1 && n('isp_unblock') === 1);
} finally {
  await db.update('isp_accounts', { id: `eq.${isp.id}` }, {
    created_by: isp.created_by,
    status: isp.status,
    blocked_by: isp.blocked_by,
    block_reason: isp.block_reason,
    blocked_by_role: isp.blocked_by_role,
    blocked_by_name: isp.blocked_by_name,
  });
  for (const o of owners) {
    await db.update('isp_users', { id: `eq.${o.id}` }, {
      is_blocked: o.is_blocked,
      block_reason: o.block_reason,
      blocked_at: o.blocked_at,
      wrong_attempts: o.wrong_attempts,
    });
  }
  await db.remove('admin_sessions', { admin_id: `eq.${admin.id}` });
  await db.remove('activity_logs', { user_id: `eq.${admin.id}` });
  await db.remove('admins', { id: `eq.${admin.id}` });
  const [back] = await db.select('isp_accounts', { select: 'created_by,status', id: `eq.${isp.id}` });
  const left = await db.select('admins', { select: 'id', username: `eq.${USERNAME}` });
  console.log(back.created_by === isp.created_by && back.status === isp.status && left.length === 0 ? 'RESTORE OK' : 'RESTORE CHECK FAILED');
}
