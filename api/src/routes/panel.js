import { Router } from 'express';
import { rateLimit } from 'express-rate-limit';
import { requireSuperAdmin } from '../auth/panel.js';
import { ispRoutes } from '../isps.js';

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

export default router;
