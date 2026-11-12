import { Router } from 'express';
import { rateLimit } from 'express-rate-limit';
import { z } from 'zod';
import { requireSuperAdmin } from '../auth/panel.js';
import { cnicReady } from '../cnic.js';
import { chargeRoutes } from '../charges.js';
import { controlRoutes } from '../controls.js';
import { collectExport, pkToday } from '../export.js';
import { ispRoutes } from '../isps.js';
import { logActivity } from '../logs.js';
import { whatsappRoutes } from '../whatsapp.js';

const router = Router();

router.use(rateLimit({
  windowMs: 60 * 1000,
  limit: 300,
  standardHeaders: 'draft-8',
  legacyHeaders: false,
  message: { error: 'too_many_requests' },
}));

router.use(requireSuperAdmin);

router.get('/me', (req, res) => {
  res.json({ admin: req.admin });
});

ispRoutes(router);
controlRoutes(router, { superAdmin: true });
chargeRoutes(router, { superAdmin: true });
whatsappRoutes(router, { logActivity });

const exportLimit = rateLimit({
  windowMs: 60 * 60 * 1000,
  limit: 10,
  standardHeaders: 'draft-8',
  legacyHeaders: false,
  message: { error: 'too_many_requests' },
});

router.get('/export', exportLimit, async (req, res) => {
  const parsed = z.uuid().optional().safeParse(req.query.isp || undefined);
  if (!parsed.success) return res.status(400).json({ error: 'invalid_input' });
  const ispId = parsed.data ?? null;

  const { text, stats } = await collectExport(ispId);
  if (ispId && stats.isps === 0) return res.status(404).json({ error: 'not_found' });

  await logActivity(req.admin, 'export_customers', { scope: ispId ?? 'all', ip: req.ip, cnic_key: cnicReady, ...stats });

  res.set({
    'Content-Type': 'text/plain; charset=utf-8',
    'Content-Disposition': `attachment; filename="tpos-customers-${ispId ? 'isp' : 'all'}-${pkToday()}.txt"`,
    'Cache-Control': 'no-store',
  });
  res.send(text);
});

export default router;
