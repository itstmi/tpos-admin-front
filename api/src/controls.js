import { z } from 'zod';
import { db } from './db.js';
import { logActivity } from './logs.js';

const ispId = z.uuid();
const toggleBody = z.object({
  control: z.enum(['whatsapp', 'dealer', 'auto_bill']),
  enabled: z.boolean(),
});
const blockBody = z.object({ blocked: z.boolean() });

const COLUMNS = {
  whatsapp: 'whatsapp_enabled',
  dealer: 'dealer_enabled',
};

const FIELDS = 'id,business_name,city,status,whatsapp_enabled,dealer_enabled,auto_bill,blocked_by,block_reason,blocked_by_role,blocked_by_name,bill_start,trial_ends_at';

// Sub admin app: only own ISPs and only block/unblock. Panel: everything.
export function controlRoutes(router, { createdBy, superAdmin = false } = {}) {
  async function loadIsp(req, res) {
    const parsed = ispId.safeParse(req.params.id);
    if (!parsed.success) {
      res.status(400).json({ error: 'invalid_input' });
      return null;
    }
    const query = { select: FIELDS, id: `eq.${parsed.data}`, limit: '1' };
    if (createdBy) query.created_by = `eq.${createdBy(req)}`;
    const [isp] = await db.select('isp_accounts', query);
    if (!isp) res.status(404).json({ error: 'not_found' });
    return isp ?? null;
  }

  router.get('/isps/:id/controls', async (req, res) => {
    const isp = await loadIsp(req, res);
    if (isp) res.json({ controls: isp });
  });

  if (superAdmin) {
    router.post('/isps/:id/controls', async (req, res) => {
      const parsed = toggleBody.safeParse(req.body);
      if (!parsed.success) return res.status(400).json({ error: 'invalid_input' });
      const isp = await loadIsp(req, res);
      if (!isp) return;
      const { control, enabled } = parsed.data;

      if (control === 'auto_bill') {
        await db.rpc('set_auto_bill', { p_isp_id: isp.id, p_on: enabled });
      } else {
        await db.update('isp_accounts', { id: `eq.${isp.id}` }, { [COLUMNS[control]]: enabled });
      }

      await logActivity(req.admin, 'isp_control', { isp_id: isp.id, control, enabled });
      const [after] = await db.select('isp_accounts', { select: FIELDS, id: `eq.${isp.id}` });
      res.json({ controls: after });
    });
  }

  router.post('/isps/:id/block', async (req, res) => {
    const parsed = blockBody.safeParse(req.body);
    if (!parsed.success) return res.status(400).json({ error: 'invalid_input' });
    const isp = await loadIsp(req, res);
    if (!isp) return;

    const result = await db.rpc('admin_set_isp_block', {
      p_isp_id: isp.id,
      p_block: parsed.data.blocked,
      p_role: req.admin.role,
      p_name: req.admin.name,
    });
    if (result === 'blocked_by_super_admin') return res.status(403).json({ error: 'blocked_by_super_admin' });
    // A trial block opens only through make paid or extend trial
    if (result === 'trial_ended') return res.status(409).json({ error: 'trial_ended' });
    if (result !== 'ok') return res.status(404).json({ error: 'not_found' });

    await logActivity(req.admin, parsed.data.blocked ? 'isp_block' : 'isp_unblock', { isp_id: isp.id });
    const [after] = await db.select('isp_accounts', { select: FIELDS, id: `eq.${isp.id}` });
    res.json({ controls: after });
  });
}
