import { useState } from 'react';
import { HandCoins, Landmark, Receipt, Users, Wallet } from 'lucide-react';
import { api } from '../../api';
import DateRange, { monthStart, pkToday } from '../../components/DateRange';
import { Card, Loaded, StatCard, useLoad } from '../../components/ui';
import { count, money } from '../../format';

// TPOS share only: bills TPOS collected itself + handovers from sub admins - expenses
const Report = () => {
  const [range, setRange] = useState({ start: monthStart(), end: pkToday() });
  const state = useLoad(() => api.report(range.start, range.end).then((d) => d.report), [range.start, range.end]);

  return (
    <div className="space-y-5">
      <DateRange value={range} onChange={setRange} />
      <Loaded state={state}>
        {(r) => (
          <>
            <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-5 gap-4">
              <StatCard icon={Wallet} label="Money in hand" value={money(r.cashIn)} />
              <StatCard icon={Landmark} label={`Collected by TPOS (${count(r.directBills)} bills)`} value={money(r.tposDirect)} tone="blue" />
              <StatCard icon={HandCoins} label="Handovers received" value={money(r.handoversReceived)} tone="violet" />
              <StatCard icon={Users} label={`TPOS share by sub admins (${count(r.subAdminBills)} bills)`} value={money(r.tposBySubAdmins)} tone="amber" />
              <StatCard icon={Receipt} label={`Expenses (${count(r.expenseCount)})`} value={money(r.expenses)} tone="red" />
            </div>

            <Card className="overflow-x-auto">
              {r.subAdmins.length === 0 ? <p className="p-8 text-center text-slate-500">No sub admin activity in this range.</p> : (
                <table className="w-full text-sm">
                  <thead className="bg-slate-50 text-slate-500 text-left">
                    <tr>
                      {['Sub admin', 'Bills', 'ISP paid', 'TPOS share', 'Handed over', 'Handovers'].map((h) => (
                        <th key={h} className="px-4 py-3 font-semibold">{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {r.subAdmins.map((s) => (
                      <tr key={s.subAdminId || s.name}>
                        <td className="px-4 py-3 font-semibold text-slate-800">{s.name}</td>
                        <td className="px-4 py-3 text-slate-700">{count(s.bills)}</td>
                        <td className="px-4 py-3 text-slate-700">{money(s.ispTotal)}</td>
                        <td className="px-4 py-3 text-slate-700">{money(s.tposTotal)}</td>
                        <td className="px-4 py-3 text-slate-700">{money(s.received)}</td>
                        <td className="px-4 py-3 text-slate-700">{count(s.handovers)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </Card>
          </>
        )}
      </Loaded>
    </div>
  );
};

export default Report;
