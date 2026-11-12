import { rateLimit } from 'express-rate-limit';
import { z } from 'zod';
import { db } from './db.js';
import { logActivity } from './logs.js';

// Same limits as the owner panel bulk import (backend customers.validator bulkImportSchema)
const row = z.object({
  name: z.string().trim().min(1).max(100),
  username: z.string().trim().max(50).nullable().optional(),
  phone: z.union([z.literal(''), z.string().trim().regex(/^03[0-9]{9}$/)]).nullable().optional(),
}).strict();

const importBody = z.object({
  area_id: z.uuid().nullable().optional(),
  customers: z.array(row).min(1).max(5000),
}).strict();

const importLimit = rateLimit({
  windowMs: 60 * 60 * 1000,
  limit: 20,
  standardHeaders: 'draft-8',
  legacyHeaders: false,
  message: { error: 'too_many_requests' },
});

const ERRORS = {
  NOT_ALLOWED: [403, 'forbidden'],
  NOT_FOUND: [404, 'not_found'],
  INVALID_AREA: [400, 'invalid_area'],
  INVALID_INPUT: [400, 'invalid_input'],
};

// Panel (super admin) only
export function importRoutes(router) {
  router.get('/isps/:id/areas', async (req, res) => {
    const id = z.uuid().safeParse(req.params.id);
    if (!id.success) return res.status(400).json({ error: 'invalid_input' });
    const areas = await db.select('areas', {
      select: 'id,area_name,assigned_collector_id',
      isp_id: `eq.${id.data}`,
      order: 'area_name.asc',
    });
    res.json({ areas: areas.map((a) => ({ id: a.id, name: a.area_name, has_collector: !!a.assigned_collector_id })) });
  });

  router.post('/isps/:id/import', importLimit, async (req, res) => {
    const id = z.uuid().safeParse(req.params.id);
    const parsed = importBody.safeParse(req.body);
    if (!id.success || !parsed.success) return res.status(400).json({ error: 'invalid_input' });
    const { area_id: areaId, customers } = parsed.data;

    const result = await db.rpc('admin_import_customers', {
      p_isp_id: id.data,
      p_admin_id: req.admin.id,
      p_area_id: areaId ?? null,
      p_rows: customers.map((c) => ({ name: c.name, username: c.username || null, phone: c.phone || null })),
    });

    const err = ERRORS[result?.result];
    if (err) return res.status(err[0]).json({ error: err[1], ...(result.bad_rows ? { bad_rows: result.bad_rows } : {}) });
    if (result?.result !== 'ok') return res.status(500).json({ error: 'server_error' });

    await logActivity(req.admin, 'customer_import', {
      isp_id: id.data,
      area_id: areaId ?? null,
      imported: result.imported,
      skipped: result.skipped,
    });
    res.json({
      imported: result.imported,
      skipped: result.skipped,
      existing_usernames: result.existing_usernames ?? [],
      repeated_usernames: result.repeated_usernames ?? [],
      area_collector: result.area_collector,
    });
  });
}
