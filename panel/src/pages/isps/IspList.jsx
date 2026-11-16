import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { Building2, ChevronRight, Search, Users, Wallet } from 'lucide-react';
import { api } from '../../api';
import { useAuth } from '../../context/AuthContext';
import { Card, Loaded, StatCard, StatusBadge, inputClass, useLoad } from '../../components/ui';
import { count, date, money } from '../../format';

const FILTERS = ['all', 'active', 'expired', 'blocked'];

const IspList = () => {
  const state = useLoad(() => api.isps().then((d) => d.isps), []);
  const [search, setSearch] = useState('');
  const [filter, setFilter] = useState('all');

  return (
    <Loaded state={state}>
      {(isps) => <List isps={isps} search={search} setSearch={setSearch} filter={filter} setFilter={setFilter} />}
    </Loaded>
  );
};

const List = ({ isps: rows, search, setSearch, filter, setFilter }) => {
  const { admin } = useAuth();
  // The creator's name shows only when a sub admin made the ISP
  const isps = useMemo(
    () => rows.map((i) => ({ ...i, sub_admin: i.created_by && i.created_by !== admin?.id ? i.created_by_name : null })),
    [rows, admin],
  );

  const totals = useMemo(() => ({
    isps: isps.length,
    active: isps.filter((i) => i.status === 'active').length,
    customers: isps.reduce((s, i) => s + Number(i.customers_total || 0), 0),
    month: isps.reduce((s, i) => s + Number(i.collected_month || 0), 0),
  }), [isps]);

  const shown = useMemo(() => {
    const q = search.trim().toLowerCase();
    return isps
      .filter((i) => filter === 'all' || i.status === filter)
      .filter((i) => !q || i.business_name?.toLowerCase().includes(q) || i.sub_admin?.toLowerCase().includes(q))
      .sort((a, b) => (a.business_name || '').localeCompare(b.business_name || ''));
  }, [isps, search, filter]);

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard icon={Building2} label="ISPs" value={count(totals.isps)} />
        <StatCard icon={Building2} label="Active ISPs" value={count(totals.active)} tone="blue" />
        <StatCard icon={Users} label="Customers" value={count(totals.customers)} tone="violet" />
        <StatCard icon={Wallet} label="ISP collection this month" value={money(totals.month)} tone="amber" />
      </div>

      <Card className="p-4 flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1">
          <Search size={18} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
          <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search ISP or sub admin" className={`${inputClass} pl-10`} />
        </div>
        <div className="tabs-scroll">
          {FILTERS.map((f) => (
            <button
              key={f}
              onClick={() => setFilter(f)}
              className={`px-4 py-2 rounded-xl text-sm font-semibold capitalize ${filter === f ? 'bg-emerald-500 text-white' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'}`}
            >
              {f}
            </button>
          ))}
        </div>
      </Card>

      <Card className="divide-y divide-slate-100">
        {shown.length === 0 && <p className="p-8 text-center text-slate-500">No ISP found.</p>}
        {shown.map((i) => (
          <Link key={i.isp_id} to={`/isps/${i.isp_id}/customers`} className="flex items-center gap-4 p-4 hover:bg-slate-50 transition-colors">
            <div className="w-11 h-11 rounded-xl bg-emerald-50 text-emerald-600 flex items-center justify-center font-bold">
              {i.business_name?.charAt(0) || '?'}
            </div>
            <div className="flex-1 min-w-0">
              <p className="font-semibold text-slate-800 truncate">
                {i.business_name}
                {i.sub_admin && <span className="text-slate-500 font-normal"> ({i.sub_admin})</span>}
              </p>
              <p className="text-sm text-slate-500">
                {count(i.customers_active)} / {count(i.customers_total)} active customers · Expiry {date(i.subscription_expiry)}
              </p>
            </div>
            <div className="hidden md:block text-right">
              <p className="text-sm font-semibold text-slate-700">{money(i.collected_month)}</p>
              <p className="text-xs text-slate-500">this month</p>
            </div>
            <StatusBadge status={i.status} />
            <ChevronRight size={18} className="text-slate-400" />
          </Link>
        ))}
      </Card>
    </div>
  );
};

export default IspList;
