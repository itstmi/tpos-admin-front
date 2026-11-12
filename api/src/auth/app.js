import { timingSafeEqual } from 'node:crypto';
import { config } from '../config.js';
import { db } from '../db.js';
import { TOKEN_PATTERN, hashToken } from '../tokens.js';

export const SESSION_DAYS = 7;
const DAY = 24 * 60 * 60 * 1000;
const EXTEND_AFTER = 60 * 60 * 1000;

const appKey = Buffer.from(config.appClientKey);

export function sessionExpiry(from = Date.now()) {
  return new Date(from + SESSION_DAYS * DAY).toISOString();
}

export function requireAppKey(req, res, next) {
  const sent = Buffer.from(req.get('x-app-key') || '');
  if (sent.length !== appKey.length || !timingSafeEqual(sent, appKey)) {
    return res.status(404).json({ error: 'not_found' });
  }
  next();
}

export async function requireSubAdmin(req, res, next) {
  const m = /^Bearer (\S+)$/.exec(req.get('authorization') || '');
  const deviceId = req.get('x-device-id') || '';
  if (!m || !TOKEN_PATTERN.test(m[1]) || !deviceId) {
    return res.status(401).json({ error: 'unauthorized' });
  }

  const [session] = await db.select('admin_sessions', {
    select: 'id,admin_id,device_id,session_expires_at',
    session_token_hash: `eq.${hashToken(m[1])}`,
    limit: '1',
  });
  if (!session || session.device_id !== deviceId || !session.session_expires_at) {
    return res.status(401).json({ error: 'unauthorized' });
  }

  const expiresAt = Date.parse(session.session_expires_at);
  if (!(expiresAt > Date.now())) {
    await db.remove('admin_sessions', { id: `eq.${session.id}` });
    return res.status(401).json({ error: 'session_expired' });
  }

  const [admin] = await db.select('admins', {
    select: 'id,name,username,role,is_active,is_blocked',
    id: `eq.${session.admin_id}`,
    limit: '1',
  });
  if (!admin || admin.role !== 'sub_admin' || admin.is_active === false || admin.is_blocked) {
    await db.remove('admin_sessions', { id: `eq.${session.id}` });
    return res.status(401).json({ error: 'unauthorized' });
  }

  if (expiresAt - Date.now() < SESSION_DAYS * DAY - EXTEND_AFTER) {
    await db.update('admin_sessions', { id: `eq.${session.id}` }, {
      session_expires_at: sessionExpiry(),
      last_active: new Date().toISOString(),
    });
  }

  req.admin = { id: admin.id, name: admin.name, username: admin.username, role: admin.role };
  req.sessionId = session.id;
  next();
}
