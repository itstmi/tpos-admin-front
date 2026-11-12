import { createRemoteJWKSet, jwtVerify } from 'jose';
import { config } from '../config.js';
import { db } from '../db.js';

const jwks = config.panelReady
  ? createRemoteJWKSet(new URL('/cdn-cgi/access/certs', config.cfTeamDomain))
  : null;

let cached = null;

async function superAdmin() {
  if (cached && cached.until > Date.now()) return cached.admin;
  const rows = await db.select('admins', {
    select: 'id,name,username,role',
    role: 'eq.super_admin',
    is_active: 'is.true',
    limit: '2',
  });
  if (rows.length !== 1) throw new Error(`expected 1 super admin, found ${rows.length}`);
  cached = { admin: rows[0], until: Date.now() + 60_000 };
  return rows[0];
}

export async function requireSuperAdmin(req, res, next) {
  if (!jwks) return res.status(503).json({ error: 'panel_not_ready' });

  const token = req.get('cf-access-jwt-assertion');
  if (!token) return res.status(401).json({ error: 'unauthorized' });

  let payload;
  try {
    ({ payload } = await jwtVerify(token, jwks, {
      issuer: config.cfTeamDomain,
      audience: config.cfAud,
      algorithms: ['RS256'],
    }));
  } catch {
    return res.status(401).json({ error: 'unauthorized' });
  }

  if (String(payload.email || '').toLowerCase() !== config.superAdminEmail) {
    return res.status(403).json({ error: 'forbidden' });
  }

  req.admin = await superAdmin();
  next();
}
