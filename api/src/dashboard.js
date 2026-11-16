// Panel dashboard: everything the page shows comes back in one request (super admin only).
import { db } from './db.js';
import { pkToday } from './export.js';
import { tposWhatsappStatus } from './whatsapp.js';

const sum = (rows, key) => rows.reduce((s, r) => s + Number(r[key] || 0), 0);

// Bills sub admins collected this month, approved, and not handed over yet
async function monthPendingHandover(subIds, monthStart) {
  if (!subIds.length) return [];
  const rows = await db.select('isp_charges_history', {
    select: 'tpos_amount,handover:admin_handover_charges(handover_id)',
    status: 'eq.paid',
    paid_at: `gte.${monthStart}T00:00:00+05:00`,
    collected_by: `in.(${subIds.join(',')})`,
  });
  return rows.filter((r) => !(Array.isArray(r.handover) ? r.handover.length : r.handover));
}

export function dashboardRoutes(router) {
  router.get('/dashboard', async (req, res) => {
    const today = pkToday();
    const monthStart = `${today.slice(0, 8)}01`;

    const [isps, report, subs, pending, whatsapp, messages] = await Promise.all([
      db.rpc('admin_isp_stats', { p_isp_id: null, p_created_by: null }),
      db.rpc('admin_money_report', { p_start: monthStart, p_end: today }),
      db.rpc('admin_sub_admin_status', { p_sub_admin_id: null }),
      db.select('isp_charges_history', { select: 'isp_id,amount', status: 'eq.pending' }),
      tposWhatsappStatus(),
      db.rpc('admin_tpos_message_counts', {}),
    ]);

    // TPOS's own ISPs: not made by a sub admin (a deleted sub admin's ISPs move to the super admin)
    const subIds = subs.map((s) => s.subAdminId);
    const subSet = new Set(subIds);
    const own = new Set(isps.filter((i) => !subSet.has(i.created_by)).map((i) => i.isp_id));
    const ownPending = pending.filter((c) => own.has(c.isp_id));
    const handoverDue = await monthPendingHandover(subIds, monthStart);

    res.json({
      isps: {
        total: isps.length,
        active: isps.filter((i) => i.status === 'active').length,
      },
      whatsapp,
      messages: {
        sent_total: Number(messages?.sent_total || 0),
        sent_today: Number(messages?.sent_today || 0),
        failed_total: Number(messages?.failed_total || 0),
      },
      collection: {
        // TPOS's own bills + sub admin bills approved this month (TPOS share)
        month_total: Number(report?.tposDirect || 0) + Number(report?.tposBySubAdmins || 0),
        from_sub_admins: Number(report?.handoversReceived || 0),
      },
      pending: {
        own_amount: sum(ownPending, 'amount'),
        own_bills: ownPending.length,
        sub_admins_due: sum(subs, 'totalDue'),
        sub_admins_bills: sum(subs, 'pendingCount'),
      },
      money: {
        expenses: Number(report?.expenses || 0),
        pending_handover: sum(handoverDue, 'tpos_amount'),
        pending_handover_bills: handoverDue.length,
      },
    });
  });
}
