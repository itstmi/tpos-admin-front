import { createRemoteJWKSet, jwtVerify } from 'jose';
import { config } from '../config.js';
import { db } from '../db.js';
import { TOKEN_PATTERN, hashToken } from '../tokens.js';

const jwks = config.panelReady
  ? createRemoteJWKSet(new URL('/cdn-cgi/access/certs', config.cfTeamDomain))
  : null;

export const PANEL_DEVICE = 'panel';
export const SESSION_DAYS = 7;
const DAY = 24 * 60 * 60 * 1000;
const EXTEND_AFTER = 60 * 60 * 1000;

// __Host- cookies must be Secure, Path=/ and have no Domain, so no subdomain can set or read it
export const COOKIE = '__Host-tpos_panel';

export function sessionExpiry(from = Date.now()) {
  return new Date(from + SESSION_DAYS * DAY).toISOString();
}

export function setSessionCookie(res, token) {
  res.cookie(COOKIE, token, {
    httpOnly: true,
    secure: true,
    sameSite: 'strict',
    path: '/',
    maxAge: SESSION_DAYS * DAY,
  });
}

export function clearSessionCookie(res) {
  res.clearCookie(COOKIE, { httpOnly: true, secure: true, sameSite: 'strict', path: '/' });
}

function readCookie(req, name) {
  for (const part of (req.get('cookie') || '').split(';')) {
    const i = part.indexOf('=');
    if (i > 0 && part.slice(0, i).trim() === name) return part.slice(i + 1).trim();
  }
  return '';
}

// First gate: Cloudflare Access email OTP, only the super admin's email
export async function requireCfAccess(req, res, next) {
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
  next();
}

// Requests that change data must carry this header. A page on another site cannot add it
// without a CORS preflight, and the panel allows no cross-site CORS.
export function requirePanelHeader(req, res, next) {
  if (req.method === 'GET' || req.method === 'HEAD') return next();
  if (req.get('x-tpos-panel') !== '1') return res.status(403).json({ error: 'forbidden' });
  next();
}

// Second gate: the super admin's own username and password session
export async function requireSuperAdmin(req, res, next) {
  const token = readCookie(req, COOKIE);
  if (!TOKEN_PATTERN.test(token)) return res.status(401).json({ error: 'login_required' });

  const [session] = await db.select('admin_sessions', {
    select: 'id,admin_id,device_id,session_expires_at',
    session_token_hash: `eq.${hashToken(token)}`,
    limit: '1',
  });
  if (!session || session.device_id !== PANEL_DEVICE || !session.session_expires_at) {
    clearSessionCookie(res);
    return res.status(401).json({ error: 'login_required' });
  }

  const expiresAt = Date.parse(session.session_expires_at);
  if (!(expiresAt > Date.now())) {
    await db.remove('admin_sessions', { id: `eq.${session.id}` });
    clearSessionCookie(res);
    return res.status(401).json({ error: 'login_required' });
  }

  const [admin] = await db.select('admins', {
    select: 'id,name,username,role,is_active,is_blocked',
    id: `eq.${session.admin_id}`,
    limit: '1',
  });
  if (!admin || admin.role !== 'super_admin' || admin.is_active === false || admin.is_blocked) {
    await db.remove('admin_sessions', { id: `eq.${session.id}` });
    clearSessionCookie(res);
    return res.status(401).json({ error: 'login_required' });
  }

  if (expiresAt - Date.now() < SESSION_DAYS * DAY - EXTEND_AFTER) {
    await db.update('admin_sessions', { id: `eq.${session.id}` }, {
      session_expires_at: sessionExpiry(),
      last_active: new Date().toISOString(),
    });
    setSessionCookie(res, token);
  }

  req.admin = { id: admin.id, name: admin.name, username: admin.username, role: admin.role };
  req.sessionId = session.id;
  next();
}
