import { useState } from 'react';
import { Link } from 'react-router-dom';
import toast from 'react-hot-toast';
import { api, errorText } from '../api';
import ConfirmButton from '../components/ConfirmButton';
import { Card, Loaded, useLoad } from '../components/ui';
import { date, dateTime, money, monthYear } from '../format';

const WHATSAPP = { sent: 'Approved. WhatsApp message sent.', failed: 'Approved, but the WhatsApp message failed.', skipped: 'Approved. No valid phone for WhatsApp.' };

const period = (c) => (c.period_start ? `${date(c.period_start)} to ${date(c.period_end)}` : monthYear(c.month, c.year));

// Bills a sub admin has collected, waiting for the super admin
const Approvals = () => {
  const state = useLoad(() => api.approvals().then((d) => d.approvals), []);
  const [busy, setBusy] = useState(null);

  const act = async (charge, action) => {
    setBusy(charge.id);
    try {
      const r = await api[action](charge.id);
      toast.success(action === 'chargeApprove' ? WHATSAPP[r.whatsapp] || 'Approved' : 'Rejected');
      state.setData((rows) => rows.filter((c) => c.id !== charge.id));
    } catch (err) {
      toast.error(errorText(err));
      if (err.code === 'bad_state') state.reload();
    } finally {
      setBusy(null);
    }
  };

  return (
    <Loaded state={state}>
      {(rows) => (
        <Card className="overflow-x-auto">
          {rows.length === 0 && <p className="p-8 text-center text-slate-500">Nothing waiting for approval.</p>}
          {rows.length > 0 && (
            <table className="w-full text-sm">
              <thead className="bg-slate-50 text-slate-500 text-left">
                <tr>
                  <th className="px-4 py-3 font-semibold">ISP</th>
                  <th className="px-4 py-3 font-semibold">Period</th>
                  <th className="px-4 py-3 font-semibold">Amount</th>
                  <th className="px-4 py-3 font-semibold">TPOS share</th>
                  <th className="px-4 py-3 font-semibold">Collected by</th>
                  <th className="px-4 py-3 font-semibold">Collected</th>
                  <th className="px-4 py-3" />
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {rows.map((c) => (
                  <tr key={c.id}>
                    <td className="px-4 py-3">
                      <Link to={`/isps/${c.isp_id}/bills`} className="font-semibold text-slate-800 hover:text-emerald-600">{c.isp?.business_name}</Link>
                    </td>
                    <td className="px-4 py-3 text-slate-700 whitespace-nowrap">{period(c)}</td>
                    <td className="px-4 py-3 text-slate-700">{money(c.amount)}</td>
                    <td className="px-4 py-3 text-slate-700">{money(c.tpos_amount)}</td>
                    <td className="px-4 py-3 text-slate-600">{c.collected_by || '-'}</td>
                    <td className="px-4 py-3 text-slate-600 whitespace-nowrap">{dateTime(c.collected_at)}</td>
                    <td className="px-4 py-3">
                      <div className="flex justify-end gap-2">
                        <ConfirmButton busy={busy === c.id} onConfirm={() => act(c, 'chargeApprove')}>Approve</ConfirmButton>
                        <ConfirmButton tone="slate" busy={busy === c.id} onConfirm={() => act(c, 'chargeReject')}>Reject</ConfirmButton>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </Card>
      )}
    </Loaded>
  );
};

export default Approvals;
