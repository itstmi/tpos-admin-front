import { useState } from 'react';
import { api } from '../../api';
import { Badge, Card, Loaded, Pager, inputClass, useLoad } from '../../components/ui';
import { count, date, money, monthYear } from '../../format';

const period = (c) => (c.period_start ? `${date(c.period_start)} to ${date(c.period_end)}` : monthYear(c.month, c.year));

// Every paid bill in the range, for everyone, TPOS itself or one sub admin. 50 per page.
// The report mounts it again for a new date range, so it starts from page 1 with one call.
const CollectionList = ({ range, subAdmins }) => {
  const [by, setBy] = useState('');
  const [page, setPage] = useState(1);

  const state = useLoad(
    () => api.collections(range.start, range.end, by, page),
    [range.start, range.end, by, page],
  );

  return (
    <Card className="p-4 space-y-4">
      <div className="flex flex-col sm:flex-row sm:items-center gap-3">
        <h3 className="font-bold text-slate-800 flex-1">Collected bills</h3>
        <select value={by} onChange={(e) => { setBy(e.target.value); setPage(1); }} className={`${inputClass} sm:w-64`}>
          <option value="">Everyone</option>
          <option value="tpos">TPOS (own)</option>
          {subAdmins.map((s) => <option key={s.subAdminId} value={s.subAdminId}>{s.name} (sub admin)</option>)}
        </select>
      </div>

      <Loaded state={state}>
        {(d) => (
          <>
            <div className="flex flex-wrap gap-4 text-sm text-slate-600">
              <span>Bills: <b className="text-slate-800">{count(d.total)}</b></span>
              <span>ISP paid: <b className="text-slate-800">{money(d.sum_amount)}</b></span>
              <span>TPOS share: <b className="text-slate-800">{money(d.sum_tpos)}</b></span>
            </div>
            {d.items.length === 0 ? <p className="py-8 text-center text-slate-500">No bills in this range.</p> : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead className="bg-slate-50 text-slate-500 text-left">
                    <tr>
                      {['Paid', 'ISP', 'Period', 'ISP paid', 'TPOS share', 'Collected by', 'Handover'].map((h) => (
                        <th key={h} className="px-4 py-2.5 font-semibold whitespace-nowrap">{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {d.items.map((c) => (
                      <tr key={c.id}>
                        <td className="px-4 py-2.5 text-slate-600 whitespace-nowrap">{c.time}</td>
                        <td className="px-4 py-2.5 font-semibold text-slate-800">{c.isp_name}</td>
                        <td className="px-4 py-2.5 text-slate-600 whitespace-nowrap">{period(c)}</td>
                        <td className="px-4 py-2.5 text-slate-700">{money(c.amount)}</td>
                        <td className="px-4 py-2.5 text-slate-700">{money(c.tpos_amount)}</td>
                        <td className="px-4 py-2.5 text-slate-700">{c.by_name}</td>
                        <td className="px-4 py-2.5">
                          {c.by_role === 'sub_admin'
                            ? <Badge tone={c.handed_over ? 'emerald' : 'amber'}>{c.handed_over ? 'Done' : 'Pending'}</Badge>
                            : <span className="text-slate-400">-</span>}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
            <Pager page={d.page} pages={d.pages} total={d.total} perPage={d.per_page} onPage={setPage} />
          </>
        )}
      </Loaded>
    </Card>
  );
};

export default CollectionList;
