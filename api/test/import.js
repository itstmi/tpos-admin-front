// Live customer import test on tposadminfront: a throwaway trial ISP with one area gets customers through the same
// DB function the panel route calls (panel needs Cloudflare); everything made here is removed at the end.
import { createHash } from 'node:crypto';
import { db } from '../src/db.js';

const step = (name, ok, extra = '') => console.log(`${ok ? 'PASS' : 'FAIL'} ${name}${extra ? ` (${extra})` : ''}`);
const rnd = () => `03${String(Math.floor(Math.random() * 1e9)).padStart(9, '0')}`;
const NAME = 'T85 Import Net';
const [superAdmin] = await db.select('admins', { select: 'id', role: 'eq.super_admin', limit: '1' });
let ispId = null;

const run = (rows, { admin = superAdmin.id, area = null, isp } = {}) =>
  db.rpc('admin_import_customers', { p_isp_id: isp ?? ispId, p_admin_id: admin, p_area_id: area, p_rows: rows });

try {
  const made = await db.rpc('admin_create_isp', {
    p_admin_id: superAdmin.id, p_business_name: NAME, p_owner_name: 'T85 Owner', p_phone: rnd(),
    p_password_hash: createHash('sha256').update('x').digest('hex'), p_monthly_charges: 3000, p_city: 'Lahore',
    p_trial: true, p_trial_days: 7, p_tpos_amount: 2500,
  });
  ispId = made.isp_id;
  step('throwaway ISP', made.result === 'ok');
  const [owner] = await db.select('isp_users', { select: 'id', isp_id: `eq.${ispId}`, role: 'eq.owner' });
  const [area] = await db.insert('areas', { isp_id: ispId, area_name: 'T85 Block', assigned_collector_id: owner.id });
  const [otherIsp] = await db.select('isp_accounts', { select: 'id', id: `neq.${ispId}`, limit: '1' });
  const [otherArea] = await db.select('areas', { select: 'id', isp_id: `eq.${otherIsp.id}`, limit: '1' });

  step('not super refused', (await run([{ name: 'x' }], { admin: owner.id })).result === 'NOT_ALLOWED');
  const bad = await run([{ name: 'ok' }, { name: 'p', phone: '0300' }, { name: '' }]);
  step('bad rows stop all', bad.result === 'INVALID_INPUT' && bad.bad_rows === 2);
  if (otherArea) step('other ISP area refused', (await run([{ name: 'x' }], { area: otherArea.id })).result === 'INVALID_AREA');

  let r = await run([
    { name: 'Imp One', username: 'imp1', phone: rnd() },
    { name: 'Imp Two', username: 'IMP1' },
    { name: 'Imp Three', username: null, phone: null },
  ], { area: area.id });
  step('import with area', r.result === 'ok' && r.imported === 2 && r.skipped === 1 && r.area_collector
    && r.repeated_usernames[0] === 'IMP1');
  r = await run([{ name: 'Imp Again', username: ' imp1 ' }, { name: 'Imp Four', username: 'imp4' }]);
  step('existing username skipped', r.imported === 1 && r.existing_usernames[0] === 'imp1');

  const rows = await db.select('customers', {
    select: 'name,status,balance,package_amount,connection_date,area_id,assigned_collector_id,created_by',
    isp_id: `eq.${ispId}`, order: 'name.asc',
  });
  step('3 customers', rows.length === 3, rows.map((c) => c.name).join(', '));
  step('same fields as owner import', rows.every((c) => c.status === 'inactive' && Number(c.balance) === 0
    && Number(c.package_amount) === 0 && c.connection_date === null && c.created_by === superAdmin.id));
  const one = rows.find((c) => c.name === 'Imp One');
  const four = rows.find((c) => c.name === 'Imp Four');
  step('area + collector', one.area_id === area.id && one.assigned_collector_id === owner.id && four.area_id === null);

  const big = Array.from({ length: 5000 }, (_, i) => ({ name: `Big ${i}`, username: `b${i}` }));
  const t = Date.now();
  r = await run(big);
  step('5000 rows', r.result === 'ok' && r.imported === 5000, `${Date.now() - t} ms`);
} finally {
  if (ispId) {
    await db.remove('isp_accounts', { id: `eq.${ispId}` });
    await db.remove('customer_deletions', { isp_id: `eq.${ispId}` });
  }
  const left = await db.select('isp_accounts', { select: 'id', business_name: `eq.${NAME}` });
  const customers = ispId ? await db.select('customers', { select: 'id', isp_id: `eq.${ispId}`, limit: '1' }) : [];
  console.log(left.length === 0 && customers.length === 0 ? 'CLEANUP OK' : 'CLEANUP CHECK FAILED');
}
