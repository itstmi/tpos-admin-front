import { useState } from 'react';
import { Search } from 'lucide-react';
import { api } from '../../../api';
import { TONE_CLASSES, describeActivity } from '../../../activityText';
import { Button, Card, Loaded, Pager, inputClass, useLoad } from '../../../components/ui';

const ROLE = { isp_owner: 'Owner', collector: 'Collector', system: 'System' };

// Everything the ISP's owner, collectors and the system did. Search runs on the button, not on each key.
const Activity = ({ ispId }) => {
  const [filter, setFilter] = useState({ user: '', search: '', page: 1 });
  const [typed, setTyped] = useState('');
  const state = useLoad(
    () => api.ispActivity(ispId, filter),
    [ispId, filter.user, filter.search, filter.page],
  );

  const change = (patch) => setFilter((f) => ({ ...f, page: 1, ...patch }));

  return (
    <Card className="p-4 space-y-4">
      <form
        className="flex flex-col sm:flex-row gap-3"
        onSubmit={(e) => {
          e.preventDefault();
          change({ search: typed.trim().slice(0, 60) });
        }}
      >
        <select value={filter.user} onChange={(e) => change({ user: e.target.value })} className={`${inputClass} sm:w-64`}>
          <option value="">Everyone</option>
          {(state.data?.users || []).map((u) => (
            <option key={u.id} value={u.id}>
              {u.name} ({ROLE[u.role] || u.role}{u.deleted ? ', deleted' : ''})
            </option>
          ))}
          <option value="system">System</option>
        </select>
        <div className="relative flex-1">
          <Search size={18} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
          <input value={typed} maxLength={60} onChange={(e) => setTyped(e.target.value)} placeholder="Customer or user name" className={`${inputClass} pl-10`} />
        </div>
        <Button type="submit">Search</Button>
      </form>

      <Loaded state={state}>
        {(data) => (
          <>
            {data.items.length === 0 && <p className="py-8 text-center text-slate-500">No activity found.</p>}
            <ul className="divide-y divide-slate-100">
              {data.items.map((row) => {
                const a = describeActivity(row.action, row.details, { createdAt: row.created_at });
                return (
                  <li key={row.id} className="py-3 flex flex-col sm:flex-row sm:items-center gap-2">
                    <span className={`self-start px-2.5 py-0.5 rounded-lg border text-xs font-semibold ${TONE_CLASSES[a.tone]}`}>{a.label}</span>
                    <span className="flex-1 text-sm text-slate-700">{a.text}</span>
                    <span className="text-xs text-slate-500 whitespace-nowrap">
                      {row.by}{row.deleted_user ? ' (deleted)' : ''} · {ROLE[row.role] || row.role} · {row.time}
                    </span>
                  </li>
                );
              })}
            </ul>
            <Pager page={data.page} pages={data.pages} total={data.total} perPage={data.per_page} onPage={(page) => setFilter((f) => ({ ...f, page }))} />
          </>
        )}
      </Loaded>
    </Card>
  );
};

export default Activity;
