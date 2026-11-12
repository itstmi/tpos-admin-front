import { db } from './db.js';

export async function logActivity(admin, action, details = {}) {
  try {
    await db.insert('activity_logs', {
      user_type: admin.role,
      user_id: admin.id,
      action,
      details,
    });
  } catch (err) {
    console.error(`activity log failed: ${action} ${err.message}`);
  }
}
