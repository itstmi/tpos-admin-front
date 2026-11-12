import { z } from 'zod';
import { db } from './db.js';

const page = z.coerce.number().int().min(1).max(10000).optional();

const ispActivityQuery = z.object({
  user: z.union([z.literal('system'), z.uuid()]).optional(),
  search: z.string().trim().max(60).optional(),
  page,
});
const loginQuery = z.object({ isp: z.uuid().optional(), page });
const staffQuery = z.object({ admin: z.uuid().optional(), page });

async function loginLogs(req, res) {
  const parsed = loginQuery.safeParse(req.query);
  if (!parsed.success) return res.status(400).json({ error: 'invalid_input' });
  const logs = await db.rpc('admin_login_logs', {
    p_viewer: req.admin.id,
    p_isp_id: parsed.data.isp ?? null,
    p_page: parsed.data.page ?? 1,
  });
  if (!logs) return res.status(400).json({ error: 'invalid_input' });
  res.json(logs);
}

// Panel (super admin): ISP activity tab, all login logs, staff actions
export function panelLogRoutes(router) {
  router.get('/isps/:id/activity', async (req, res) => {
    const id = z.uuid().safeParse(req.params.id);
    const parsed = ispActivityQuery.safeParse(req.query);
    if (!id.success || !parsed.success) return res.status(400).json({ error: 'invalid_input' });
    const q = parsed.data;
    const result = await db.rpc('admin_isp_activity', {
      p_isp_id: id.data,
      p_user: q.user ?? null,
      p_search: q.search || null,
      p_page: q.page ?? 1,
    });
    if (!result) return res.status(400).json({ error: 'invalid_input' });
    if (!result.found) return res.status(404).json({ error: 'not_found' });
    const { found, ...rest } = result;
    res.json(rest);
  });

  router.get('/logs/logins', loginLogs);

  router.get('/logs/staff', async (req, res) => {
    const parsed = staffQuery.safeParse(req.query);
    if (!parsed.success) return res.status(400).json({ error: 'invalid_input' });
    const logs = await db.rpc('admin_staff_logs', { p_admin_id: parsed.data.admin ?? null, p_page: parsed.data.page ?? 1 });
    if (!logs) return res.status(400).json({ error: 'invalid_input' });
    res.json(logs);
  });
}

// App (sub admin): login/logout of his own ISPs and himself only; the DB function checks the viewer.
export function appLogRoutes(router) {
  router.get('/logs/logins', loginLogs);
}
