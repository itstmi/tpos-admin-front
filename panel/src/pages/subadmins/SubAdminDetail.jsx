import { useState } from 'react';
import { Link, NavLink, Navigate, Route, Routes, useNavigate, useParams } from 'react-router-dom';
import toast from 'react-hot-toast';
import { ArrowLeft, CalendarClock, Coins, HandCoins, Wallet } from 'lucide-react';
import { api, errorText } from '../../api';
import ConfirmButton from '../../components/ConfirmButton';
import PasswordInput, { passwordOk } from '../../components/PasswordInput';
import { Badge, Button, Card, Loaded, StatCard, inputClass, useLoad } from '../../components/ui';
import { count, date, dateTime, money, monthYear } from '../../format';

const TABS = [
  { path: 'account', label: 'Account' },
  { path: 'collections', label: 'Collections' },
  { path: 'handovers', label: 'Handovers' },
  { path: 'settings', label: 'Settings' },
];

// Detail and the sub admin's own row come together; tabs read from them without new calls
const SubAdminDetail = () => {
  const { id } = useParams();
  const state = useLoad(
    () => Promise.all([api.subAdmin(id), api.subAdmins()]).then(([d, list]) => {
      const profile = list.sub_admins.find((s) => s.id === id);
      if (!profile) throw Object.assign(new Error('not_found'), { code: 'not_found' });
      return { ...d, profile };
    }),
    [id],
  );

  return (
    <div className="space-y-5">
      <Link to="/sub-admins" className="inline-flex items-center gap-2 text-sm font-semibold text-slate-500 hover:text-emerald-600">
        <ArrowLeft size={16} /> All sub admins
      </Link>
      <Loaded state={state}>
        {(d) => {
          const blocked = d.profile.is_blocked || d.profile.is_active === false;
          const props = { data: d, subId: id, setData: state.setData, reload: state.reload };
          return (
            <>
              <Card className="p-5 flex flex-wrap items-center gap-3">
                <div className="flex-1">
                  <h3 className="text-xl font-bold text-slate-800">{d.profile.name}</h3>
                  <p className="text-sm text-slate-500">@{d.profile.username} · {d.profile.city || '-'}</p>
                </div>
                <Badge tone={blocked ? 'red' : 'emerald'}>{blocked ? 'Blocked' : 'Active'}</Badge>
              </Card>
              <div className="tabs-scroll">
                {TABS.map((t) => (
                  <NavLink
                    key={t.path}
                    to={`/sub-admins/${id}/${t.path}`}
                    className={({ isActive }) => `px-4 py-2 rounded-xl text-sm font-semibold transition-colors ${isActive ? 'bg-emerald-500 text-white' : 'bg-white border border-slate-200 text-slate-600 hover:bg-slate-50'}`}
                  >
                    {t.label}
                  </NavLink>
                ))}
              </div>
              <Routes>
                <Route path="account" element={<Account {...props} />} />
                <Route path="collections" element={<Collections {...props} />} />
                <Route path="handovers" element={<Handovers {...props} />} />
                <Route path="settings" element={<Settings {...props} />} />
                <Route path="*" element={<Navigate to="account" replace />} />
              </Routes>
            </>
          );
        }}
      </Loaded>
    </div>
  );
};

const Account = ({ data, subId, reload }) => {
  const a = data.account;
  const [received, setReceived] = useState('');
  const [note, setNote] = useState('');
  const [busy, setBusy] = useState(false);
  const amount = Number(received);
  const valid = amount > 0 && amount <= Number(a.totalDue);

  const save = async () => {
    setBusy(true);
    try {
      const r = await api.handover(subId, {
        expected_tpos: Number(a.pendingTpos),
        expected_count: Number(a.pendingCount),
        received: amount,
        ...(note.trim() ? { note: note.trim() } : {}),
      });
      toast.success(`Handover saved. Remaining ${money(r.remaining_balance)}`);
      setReceived('');
      setNote('');
      reload();
    } catch (err) {
      toast.error(errorText(err));
      if (err.code === 'HANDOVER_CHANGED') reload();
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="space-y-5">
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard icon={Wallet} label="Total due" value={money(a.totalDue)} tone="red" />
        <StatCard icon={Coins} label="New collections (TPOS share)" value={money(a.pendingTpos)} />
        <StatCard icon={CalendarClock} label="Previous balance" value={money(a.previousBalance)} tone="amber" />
        <StatCard icon={HandCoins} label="Handed over (all time)" value={money(a.handedOver)} tone="blue" />
      </div>

      <Card className="p-6 max-w-xl space-y-4">
        <div>
          <h3 className="font-bold text-slate-800">Receive handover</h3>
          <p className="text-sm text-slate-500 mt-1">
            {count(a.pendingCount)} bills since {a.firstChargeAt ? date(a.firstChargeAt) : '-'} ({count(a.pendingDays)} days). TPOS rate {money(a.tposRate)}.
          </p>
        </div>
        <input type="number" min="1" value={received} onChange={(e) => setReceived(e.target.value)} placeholder="Amount received" className={inputClass} />
        <input value={note} maxLength={500} onChange={(e) => setNote(e.target.value)} placeholder="Note (optional)" className={inputClass} />
        {received && !valid && <p className="text-xs text-red-500">More than 0 and not above {money(a.totalDue)}.</p>}
        <ConfirmButton busy={busy} disabled={!valid} onConfirm={save}>Save handover</ConfirmButton>
      </Card>
    </div>
  );
};

const period = (c) => (c.period_start ? `${date(c.period_start)} to ${date(c.period_end)}` : monthYear(c.month, c.year));

const Table = ({ head, empty, children, rows }) => (
  <Card className="overflow-x-auto">
    {rows === 0 ? <p className="p-8 text-center text-slate-500">{empty}</p> : (
      <table className="w-full text-sm">
        <thead className="bg-slate-50 text-slate-500 text-left">
          <tr>{head.map((h) => <th key={h} className="px-4 py-3 font-semibold whitespace-nowrap">{h}</th>)}</tr>
        </thead>
        <tbody className="divide-y divide-slate-100">{children}</tbody>
      </table>
    )}
  </Card>
);

const Collections = ({ data }) => (
  <Table head={['ISP', 'Period', 'ISP paid', 'TPOS share', 'Profit', 'Status', 'Collected', 'Handover']} empty="No collections yet." rows={data.collections.length}>
    {data.collections.map((c) => (
      <tr key={c.id}>
        <td className="px-4 py-3 font-semibold text-slate-800">{c.business_name || '-'}</td>
        <td className="px-4 py-3 text-slate-700 whitespace-nowrap">{period(c)}</td>
        <td className="px-4 py-3 text-slate-700">{money(c.amount)}</td>
        <td className="px-4 py-3 text-slate-700">{money(c.tpos_amount)}</td>
        <td className="px-4 py-3 text-slate-700">{money(c.profit)}</td>
        <td className="px-4 py-3"><Badge tone={c.status === 'paid' ? 'emerald' : 'blue'}>{c.status === 'paid' ? 'Approved' : 'Waiting'}</Badge></td>
        <td className="px-4 py-3 text-slate-600 whitespace-nowrap">{dateTime(c.collected_at)}</td>
        <td className="px-4 py-3 text-slate-600">{c.handed_over ? 'Done' : '-'}</td>
      </tr>
    ))}
  </Table>
);

const Handovers = ({ data }) => (
  <Table head={['Received', 'Bills', 'Previous', 'TPOS share', 'Received amount', 'Remaining', 'Note']} empty="No handovers yet." rows={data.handovers.length}>
    {data.handovers.map((h) => (
      <tr key={h.id}>
        <td className="px-4 py-3 text-slate-700 whitespace-nowrap">{dateTime(h.received_at)}</td>
        <td className="px-4 py-3 text-slate-700">{count(h.charges_count)}</td>
        <td className="px-4 py-3 text-slate-700">{money(h.previous_balance)}</td>
        <td className="px-4 py-3 text-slate-700">{money(h.tpos_total)}</td>
        <td className="px-4 py-3 font-semibold text-slate-800">{money(h.amount)}</td>
        <td className="px-4 py-3 text-slate-700">{money(h.remaining_balance)}</td>
        <td className="px-4 py-3 text-slate-600">{h.note || '-'}</td>
      </tr>
    ))}
  </Table>
);

const Box = ({ title, note, children }) => (
  <Card className="p-5 space-y-3">
    <div>
      <p className="font-semibold text-slate-800">{title}</p>
      {note && <p className="text-xs text-slate-500 mt-0.5">{note}</p>}
    </div>
    {children}
  </Card>
);

const Settings = ({ data, subId, setData }) => {
  const p = data.profile;
  const [rate, setRate] = useState(String(p.tpos_amount ?? ''));
  const [limit, setLimit] = useState(String(p.trial_limit ?? ''));
  const [name, setName] = useState(p.name || '');
  const [city, setCity] = useState(p.city || '');
  const [password, setPassword] = useState('');
  const [withIsps, setWithIsps] = useState(false);
  const [busy, setBusy] = useState(null);
  const navigate = useNavigate();
  const blocked = p.is_blocked || p.is_active === false;

  const run = async (key, call, after) => {
    setBusy(key);
    try {
      const r = await call();
      toast.success('Saved', { id: 'saved' });
      after?.(r);
    } catch (err) {
      toast.error(errorText(err));
    } finally {
      setBusy(null);
    }
  };
  const patchProfile = (patch) => setData((d) => ({ ...d, profile: { ...d.profile, ...patch } }));

  const rateOk = rate !== '' && Number(rate) >= 0;
  const limitOk = limit !== '' && Number.isInteger(Number(limit)) && Number(limit) >= 0 && Number(limit) <= 1000;
  const profileOk = name.trim().length >= 2 && city.trim().length >= 2;

  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
      <Box title="TPOS amount per ISP" note="Applies to ISPs he makes from now on.">
        <div className="flex gap-2">
          <input type="number" min="0" value={rate} onChange={(e) => setRate(e.target.value)} className={inputClass} />
          <Button busy={busy === 'rate'} disabled={!rateOk} onClick={() => run('rate', () => api.setTposRate(subId, Number(rate)), (r) => {
            patchProfile({ tpos_amount: Number(rate) });
            if (r.account) setData((d) => ({ ...d, account: r.account }));
          })}
          >
            Save
          </Button>
        </div>
      </Box>

      <Box title="Trial ISPs per month" note="Resets every month.">
        <div className="flex gap-2">
          <input type="number" min="0" max="1000" value={limit} onChange={(e) => setLimit(e.target.value)} className={inputClass} />
          <Button busy={busy === 'limit'} disabled={!limitOk} onClick={() => run('limit', () => api.setTrialLimit(subId, Number(limit)), () => patchProfile({ trial_limit: Number(limit) }))}>
            Save
          </Button>
        </div>
      </Box>

      <Box title="Name and city" note="The name shows in &quot;Collected by&quot; messages.">
        <input value={name} maxLength={100} onChange={(e) => setName(e.target.value)} placeholder="Name" className={inputClass} />
        <input value={city} maxLength={60} onChange={(e) => setCity(e.target.value)} placeholder="City" className={inputClass} />
        <Button busy={busy === 'profile'} disabled={!profileOk} onClick={() => run('profile', () => api.setSubProfile(subId, name.trim(), city.trim()), () => patchProfile({ name: name.trim(), city: city.trim() }))}>
          Save
        </Button>
      </Box>

      <Box title="Reset password" note="He is signed out and must use the new password.">
        <PasswordInput value={password} onChange={setPassword} />
        <ConfirmButton busy={busy === 'password'} disabled={!passwordOk(password)} onConfirm={() => run('password', () => api.resetSubPassword(subId, password), () => toast.success('Share the new password with him now.'))}>
          Reset password
        </ConfirmButton>
      </Box>

      <Box title={blocked ? 'Blocked' : 'Block'} note={blocked ? 'He cannot sign in.' : 'Sign in stops at once.'}>
        <label className="flex items-center gap-2 text-sm text-slate-700">
          <input type="checkbox" checked={withIsps} onChange={(e) => setWithIsps(e.target.checked)} className="w-4 h-4 accent-emerald-500" />
          {blocked ? 'Also open the ISPs this block closed' : 'Also block his ISPs'}
        </label>
        <ConfirmButton
          tone={blocked ? 'emerald' : 'red'}
          busy={busy === 'block'}
          onConfirm={() => run('block', () => api.blockSubAdmin(subId, !blocked, withIsps), (r) => {
            patchProfile({ is_blocked: !blocked });
            if (withIsps) toast.success(`${count(r.isps)} ISPs ${blocked ? 'opened' : 'blocked'}`);
          })}
        >
          {blocked ? 'Unblock' : 'Block'}
        </ConfirmButton>
      </Box>

      <Box title="Delete" note="Only when he has no money records. His ISPs move to you.">
        <ConfirmButton tone="red" busy={busy === 'delete'} onConfirm={() => run('delete', () => api.deleteSubAdmin(subId), (r) => {
          toast.success(`Deleted. ${count(r.isps_moved)} ISPs moved to you.`);
          navigate('/sub-admins');
        })}
        >
          Delete sub admin
        </ConfirmButton>
      </Box>
    </div>
  );
};

export default SubAdminDetail;
