import { useCallback, useEffect, useRef, useState } from 'react';
import { AlertCircle, Loader2, RefreshCw } from 'lucide-react';
import { errorText } from '../api';

// Loads once when the page opens (and again only when `deps` change or reload() is called).
export function useLoad(loader, deps) {
  const [state, setState] = useState({ loading: true, error: null, data: null });
  const run = useRef(0);

  // eslint-disable-next-line react-hooks/exhaustive-deps
  const load = useCallback(loader, deps);

  const reload = useCallback(() => {
    const n = ++run.current;
    setState((s) => ({ ...s, loading: true, error: null }));
    load()
      .then((data) => { if (n === run.current) setState({ loading: false, error: null, data }); })
      .catch((error) => { if (n === run.current) setState({ loading: false, error, data: null }); });
  }, [load]);

  useEffect(() => {
    reload();
  }, [reload]);

  const setData = useCallback((fn) => setState((s) => ({ ...s, data: typeof fn === 'function' ? fn(s.data) : fn })), []);
  return { ...state, reload, setData };
}

export const Spinner = () => (
  <div className="flex justify-center py-16">
    <Loader2 size={28} className="animate-spin text-emerald-500" />
  </div>
);

export const ErrorBox = ({ error, onRetry }) => (
  <div className="flex flex-col items-center gap-3 py-12 text-center">
    <AlertCircle size={28} className="text-red-400" />
    <p className="text-slate-600">{errorText(error)}</p>
    {onRetry && (
      <button onClick={onRetry} className="flex items-center gap-2 px-4 py-2 rounded-xl bg-slate-100 text-slate-700 hover:bg-slate-200 text-sm font-semibold">
        <RefreshCw size={16} /> Try again
      </button>
    )}
  </div>
);

// Shows the spinner or the error until the data is there
export const Loaded = ({ state, children }) => {
  if (state.loading && !state.data) return <Spinner />;
  if (state.error) return <ErrorBox error={state.error} onRetry={state.reload} />;
  return children(state.data);
};

export const Card = ({ className = '', children }) => (
  <div className={`bg-white rounded-2xl border border-slate-200 shadow-sm ${className}`}>{children}</div>
);

const TONES = {
  emerald: 'bg-emerald-50 text-emerald-600',
  blue: 'bg-blue-50 text-blue-600',
  amber: 'bg-amber-50 text-amber-600',
  red: 'bg-red-50 text-red-600',
  violet: 'bg-violet-50 text-violet-600',
  slate: 'bg-slate-100 text-slate-600',
};

export const StatCard = ({ icon: Icon, label, value, tone = 'emerald' }) => (
  <Card className="p-5 flex items-center gap-4">
    <div className={`w-12 h-12 rounded-xl flex items-center justify-center ${TONES[tone]}`}>
      <Icon size={22} />
    </div>
    <div>
      <p className="text-sm text-slate-500">{label}</p>
      <p className="text-2xl font-bold text-slate-800">{value}</p>
    </div>
  </Card>
);

export const Badge = ({ tone = 'slate', children }) => (
  <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold ${TONES[tone]}`}>{children}</span>
);

const STATUS_TONE = { active: 'emerald', expired: 'amber', blocked: 'red' };
export const StatusBadge = ({ status }) => <Badge tone={STATUS_TONE[status] || 'slate'}>{status || '-'}</Badge>;

export const Button = ({ tone = 'emerald', busy, className = '', children, ...props }) => {
  const tones = {
    emerald: 'bg-gradient-to-r from-emerald-500 to-teal-500 text-white hover:from-emerald-400 hover:to-teal-400',
    red: 'bg-red-500 text-white hover:bg-red-400',
    slate: 'bg-slate-100 text-slate-700 hover:bg-slate-200',
  };
  return (
    <button
      {...props}
      disabled={busy || props.disabled}
      className={`inline-flex items-center justify-center gap-2 px-4 py-2 rounded-xl text-sm font-semibold transition-all disabled:opacity-50 disabled:cursor-not-allowed ${tones[tone]} ${className}`}
    >
      {busy && <Loader2 size={16} className="animate-spin" />}
      {children}
    </button>
  );
};

export const inputClass = 'w-full px-4 py-2.5 bg-white border-2 border-slate-200 rounded-xl focus:border-emerald-500 outline-none transition-all text-slate-800';

// Numbers, first/prev/next/last and "Showing x-y of N", like the ISP panel's WhatsApp logs
export const Pager = ({ page, pages, total, perPage, onPage }) => {
  if (!total) return null;
  const from = (page - 1) * perPage + 1;
  const to = Math.min(page * perPage, total);
  const start = Math.max(1, Math.min(page - 2, pages - 4));
  const nums = [];
  for (let n = start; n <= Math.min(pages, start + 4); n += 1) nums.push(n);
  const btn = (label, target, active = false) => (
    <button
      key={label}
      onClick={() => onPage(target)}
      disabled={target < 1 || target > pages || target === page}
      className={`min-w-9 h-9 px-2 rounded-lg text-sm font-semibold transition-colors disabled:cursor-default ${active ? 'bg-emerald-500 text-white' : 'text-slate-600 hover:bg-slate-100 disabled:opacity-40'}`}
    >
      {label}
    </button>
  );
  return (
    <div className="flex flex-col sm:flex-row items-center justify-between gap-3 pt-4">
      <p className="text-sm text-slate-500">Showing {from}-{to} of {total.toLocaleString()}</p>
      <div className="flex items-center gap-1">
        {btn('«', 1)}
        {btn('‹', page - 1)}
        {nums.map((n) => btn(String(n), n, n === page))}
        {btn('›', page + 1)}
        {btn('»', pages)}
      </div>
    </div>
  );
};
