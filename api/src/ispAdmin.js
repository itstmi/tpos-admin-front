// Super admin only: bill wise collection list for the report, and ISP delete.
import { z } from 'zod';
import { db } from './db.js';
import { raiseAlert } from './alerts.js';

const day = z.string().regex(/^\d{4}-\d{2}-\d{2}$/);

const listQuery = z.object({
  start: day,
  end: day,
  by: z.union([z.literal(''), z.literal('tpos'), z.uuid()]).optional(),
  page: z.coerce.number().int().min(1).max(100000).optional(),
}).strict();

const deleteBody = z.object({ confirm_name: z.string().min(1).max(100) }).strict();

const DELETE_ERRORS = {
  NOT_ALLOWED: [403, 'forbidden'],
  NOT_FOUND: [404, 'not_found'],
  NAME_MISMATCH: [400, 'NAME_MISMATCH'],
  UNSETTLED: [409, 'UNSETTLED'],
  WHATSAPP_ON: [409, 'WHATSAPP_ON'],
};

export function ispAdminRoutes(router, { logActivity }) {
  router.get('/collections', async (req, res) => {
    const parsed = listQuery.safeParse(req.query);
    if (!parsed.success) return res.status(400).json({ error: 'invalid_input' });
    const { start, end, by = '', page = 1 } = parsed.data;
    const result = await db.rpc('admin_collection_list', { p_start: start, p_end: end, p_by: by, p_page: page });
    if (!result) return res.status(400).json({ error: 'invalid_input' });
    res.json(result);
  });

  router.post('/isps/:id/delete', async (req, res) => {
    const id = z.uuid().safeParse(req.params.id);
    const body = deleteBody.safeParse(req.body);
    if (!id.success || !body.success) return res.status(400).json({ error: 'invalid_input' });

    const r = await db.rpc('admin_delete_isp', { p_isp_id: id.data, p_admin_id: req.admin.id, p_confirm: body.data.confirm_name });
    if (r?.result !== 'ok') {
      const [status, error] = DELETE_ERRORS[r?.result] || [500, 'server_error'];
      return res.status(status).json({ error });
    }
    await logActivity(req.admin, 'isp_delete', { isp_id: id.data, business_name: r.business_name });
    raiseAlert('isp_delete', `ISP deleted from the panel: ${String(r.business_name).slice(0, 60)}.`);
    res.json({ ok: true });
  });
}
