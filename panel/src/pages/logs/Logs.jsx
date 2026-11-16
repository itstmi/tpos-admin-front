import { useState } from 'react';
import { api } from '../../api';
import { useAuth } from '../../context/AuthContext';
import { Badge, Card, Loaded, Pager, inputClass, useLoad } from '../../components/ui';

// Filter options load once, only when the filter is first opened
function useOptions(loader) {
  const [opts, setOpts] = useState(null);
  const open = () => {
    if (opts) return;
    setOpts([]);
    loader().then(setOpts).catch(() => setOpts(null));
  };
  return [opts || [], open];
}

const ROLE = { super_admin: 'Super admin', sub_admin: 'Sub admin', isp_owner: 'Owner', collector: 'Collector' };

const words = (s) => String(s || '').replace(/_/g, ' ');

export const StaffLogs = () => {
  const { admin } = useAuth();
  const [filter, setFilter] = useState({ admin: '', page: 1 });
  const state = useLoad(() => api.staffLogs(filter.admin, filter.page), [filter.admin, filter.page]);
  const [subs, openSubs] = useOptions(() => api.subAdmins().then((d) => d.sub_admins.map((s) => ({ id: s.id, name: s.name }))));

  return (
    <Card className="p-4 space-y-4">
      <select value={filter.admin} onFocus={openSubs} onMouseDown={openSubs} onChange={(e) => setFilter({ admin: e.target.value, page: 1 })} className={`${inputClass} sm:w-72`}>
        <option value="">Everyone</option>
        <option value={admin?.id}>Me ({admin?.name})</option>
        {subs.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
      </select>
      <Loaded state={state}>
        {(d) => (
          <>
            {d.items.length === 0 && <p className="py-8 text-center text-slate-500">No activity found.</p>}
            <ul className="divide-y divide-slate-100">
              {d.items.map((r) => (
                <li key={r.id} className="py-3 flex flex-col sm:flex-row sm:items-center gap-2">
                  <Badge tone={/failed|delete|block/.test(r.action) ? 'red' : 'blue'}>{words(r.action)}</Badge>
                  <span className="flex-1 text-sm text-slate-700">{r.isp_name || ''}</span>
                  <span className="text-xs text-slate-500 whitespace-nowrap">{r.by} · {ROLE[r.role] || words(r.role)} · {r.time}</span>
                </li>
              ))}
            </ul>
            <Pager page={d.page} pages={d.pages} total={d.total} perPage={d.per_page} onPage={(page) => setFilter((f) => ({ ...f, page }))} />
          </>
        )}
      </Loaded>
    </Card>
  );
};
