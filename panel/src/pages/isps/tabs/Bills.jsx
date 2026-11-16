import { useState } from 'react';
import toast from 'react-hot-toast';
import { api, errorText } from '../../../api';
import ConfirmButton from '../../../components/ConfirmButton';
import { Badge, Card, Loaded, useLoad } from '../../../components/ui';
import { date, dateTime, money, monthYear } from '../../../format';

const STATUS = {
  pending: ['amber', 'Unpaid'],
  pending_approval: ['blue', 'Waiting approval'],
  paid: ['emerald', 'Paid'],
};

const WHATSAPP = { sent: 'WhatsApp message sent.', failed: 'Bill saved, but the WhatsApp message failed.', skipped: 'Bill saved. No valid phone for WhatsApp.' };

const period = (c) => (c.period_start ? `${date(c.period_start)} to ${date(c.period_end)}` : monthYear(c.month, c.year));

const Bills = ({ ispId }) => {
  const state = useLoad(() => api.ispCharges(ispId).then((d) => d.charges), [ispId]);
  const [busy, setBusy] = useState(null);

  const act = async (charge, action) => {
    setBusy(charge.id);
    try {
      const r = await api[action](charge.id);
      // Only this row changes, so the list is not loaded again
      const changed = { status: r.status };
      if (action === 'chargePaid') Object.assign(changed, { collected_by: 'TPOS', paid_at: new Date().toISOString() });
      if (action === 'chargeApprove') changed.paid_at = new Date().toISOString();
      if (action === 'chargeReject') changed.collected_by = null;
      state.setData((rows) => rows.map((c) => (c.id === charge.id ? { ...c, ...changed } : c)));
      toast.success(r.whatsapp ? WHATSAPP[r.whatsapp] : 'Saved');
    } catch (err) {
      toast.error(errorText(err));
      if (err.code === 'bad_state') state.reload();
    } finally {
      setBusy(null);
    }
  };

  return (
    <Loaded state={state}>
      {(charges) => (
        <Card className="overflow-x-auto">
          {charges.length === 0 && <p className="p-8 text-center text-slate-500">No bills yet.</p>}
          {charges.length > 0 && (
            <table className="w-full text-sm">
              <thead className="bg-slate-50 text-slate-500 text-left">
                <tr>
                  <th className="px-4 py-3 font-semibold">Period</th>
                  <th className="px-4 py-3 font-semibold">Amount</th>
                  <th className="px-4 py-3 font-semibold">TPOS share</th>
                  <th className="px-4 py-3 font-semibold">Status</th>
                  <th className="px-4 py-3 font-semibold">Collected by</th>
                  <th className="px-4 py-3 font-semibold">Paid</th>
                  <th className="px-4 py-3" />
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {charges.map((c) => {
                  const [tone, label] = STATUS[c.status] || ['slate', c.status];
                  return (
                    <tr key={c.id}>
                      <td className="px-4 py-3 text-slate-700 whitespace-nowrap">{period(c)}</td>
                      <td className="px-4 py-3 text-slate-700">{money(c.amount)}</td>
                      <td className="px-4 py-3 text-slate-700">{money(c.tpos_amount)}</td>
                      <td className="px-4 py-3"><Badge tone={tone}>{label}</Badge></td>
                      <td className="px-4 py-3 text-slate-600">{c.collected_by || '-'}</td>
                      <td className="px-4 py-3 text-slate-600 whitespace-nowrap">{c.paid_at ? dateTime(c.paid_at) : '-'}</td>
                      <td className="px-4 py-3">
                        <div className="flex justify-end gap-2">
                          {c.status === 'pending' && (
                            <ConfirmButton busy={busy === c.id} onConfirm={() => act(c, 'chargePaid')}>Mark paid</ConfirmButton>
                          )}
                          {c.status === 'pending_approval' && (
                            <>
                              <ConfirmButton busy={busy === c.id} onConfirm={() => act(c, 'chargeApprove')}>Approve</ConfirmButton>
                              <ConfirmButton tone="slate" busy={busy === c.id} onConfirm={() => act(c, 'chargeReject')}>Reject</ConfirmButton>
                            </>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          )}
        </Card>
      )}
    </Loaded>
  );
};

export default Bills;
