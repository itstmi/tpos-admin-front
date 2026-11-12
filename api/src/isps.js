import { z } from 'zod';
import { db } from './db.js';

const ispId = z.uuid();

// createdBy limits the result to ISPs made by that admin (sub admin app).
export function ispRoutes(router, { createdBy } = {}) {
  router.get('/isps', async (req, res) => {
    const rows = await db.rpc('admin_isp_stats', {
      p_isp_id: null,
      p_created_by: createdBy ? createdBy(req) : null,
    });
    res.json({ isps: rows });
  });

  router.get('/isps/:id', async (req, res) => {
    const parsed = ispId.safeParse(req.params.id);
    if (!parsed.success) return res.status(400).json({ error: 'invalid_input' });
    const [isp] = await db.rpc('admin_isp_stats', {
      p_isp_id: parsed.data,
      p_created_by: createdBy ? createdBy(req) : null,
    });
    if (!isp) return res.status(404).json({ error: 'not_found' });
    res.json({ isp });
  });
}
