// Panel dashboard: everything the page shows comes back in one request (super admin only).
import { db } from './db.js';
import { pkToday } from './export.js';
import { tposWhatsappStatus } from './whatsapp.js';

const sum = (rows, key) => rows.reduce((s, r) => s + Number(r[key] || 0), 0);

export function dashboardRoutes(router) {
  router.get('/dashboard', async (req, res) => {
    const today = pkToday();
    const monthStart = `${today.slice(0, 8)}01`;

    const [isps, report, subs, pending, whatsapp] = await Promise.all([
      db.rpc('admin_isp_stats', { p_isp_id: null, p_created_by: null }),
      db.rpc('admin_money_report', { p_start: monthStart, p_end: today }),
      db.rpc('admin_sub_admin_status', { p_sub_admin_id: null }),
      db.select('isp_charges_history', { select: 'isp_id,amount', status: 'eq.pending' }),
      tposWhatsappStatus(),
    ]);

    // TPOS's own ISPs: not made by a sub admin (a deleted sub admin's ISPs move to the super admin)
    const subIds = new Set(subs.map((s) => s.subAdminId));
    const own = new Set(isps.filter((i) => !subIds.has(i.created_by)).map((i) => i.isp_id));
    const ownPending = pending.filter((c) => own.has(c.isp_id));

    res.json({
      isps: {
        total: isps.length,
        active: isps.filter((i) => i.status === 'active').length,
        customers: sum(isps, 'customers_total'),
        collected_month: sum(isps, 'collected_month'),
      },
      whatsapp,
      messages: {
        sent_total: sum(isps, 'wa_sent_total'),
        sent_today: sum(isps, 'wa_sent_today'),
        failed_total: sum(isps, 'wa_failed_total'),
      },
      collection: {
        tpos_direct: Number(report?.tposDirect || 0),
        from_sub_admins: Number(report?.handoversReceived || 0),
      },
      pending: {
        own_amount: sum(ownPending, 'amount'),
        own_bills: ownPending.length,
        sub_admins_due: sum(subs, 'totalDue'),
      },
      money: {
        expenses: Number(report?.expenses || 0),
        sub_admin_share: Number(report?.tposBySubAdmins || 0),
      },
    });
  });
}
