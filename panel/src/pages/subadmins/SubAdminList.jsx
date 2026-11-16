import { Link } from 'react-router-dom';
import { ChevronRight } from 'lucide-react';
import { api } from '../../api';
import { Badge, Card, Loaded, useLoad } from '../../components/ui';
import { money } from '../../format';

// Sub admins with what each owes TPOS. The two calls go out together.
const SubAdminList = () => {
  const state = useLoad(
    () => Promise.all([api.subAdmins(), api.subAdminDues()]).then(([a, d]) => {
      const due = new Map(d.sub_admins.map((s) => [s.subAdminId, s]));
      return a.sub_admins.map((s) => ({ ...s, due: due.get(s.id) }));
    }),
    [],
  );

  return (
    <Loaded state={state}>
      {(rows) => (
        <Card className="divide-y divide-slate-100">
          {rows.length === 0 && <p className="p-8 text-center text-slate-500">No sub admin yet.</p>}
          {rows.map((s) => {
            const blocked = s.is_blocked || s.is_active === false;
            return (
              <Link key={s.id} to={`/sub-admins/${s.id}/account`} className="flex items-center gap-4 p-4 hover:bg-slate-50 transition-colors">
                <div className="w-11 h-11 rounded-xl bg-violet-50 text-violet-600 flex items-center justify-center font-bold">
                  {s.name?.charAt(0) || '?'}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="font-semibold text-slate-800 truncate">{s.name}</p>
                  <p className="text-sm text-slate-500">@{s.username} · {s.city || '-'} · TPOS rate {money(s.tpos_amount)}</p>
                </div>
                <div className="text-right">
                  <p className="text-sm font-semibold text-slate-700">{money(s.due?.totalDue)}</p>
                  <p className="text-xs text-slate-500">due</p>
                </div>
                <Badge tone={blocked ? 'red' : 'emerald'}>{blocked ? 'Blocked' : 'Active'}</Badge>
                <ChevronRight size={18} className="text-slate-400" />
              </Link>
            );
          })}
        </Card>
      )}
    </Loaded>
  );
};

export default SubAdminList;
