import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import toast from 'react-hot-toast';
import { UserPlus } from 'lucide-react';
import { api, errorText } from '../../api';
import PasswordInput, { passwordOk } from '../../components/PasswordInput';
import { Button, Card, inputClass } from '../../components/ui';

const EMPTY = { name: '', username: '', password: '', city: '', tpos_amount: '', trial_limit: '' };

function problems(f) {
  const p = [];
  if (f.name.trim().length < 2) p.push('name');
  if (!/^[A-Za-z0-9._@-]{3,64}$/.test(f.username.trim())) p.push('username');
  if (!passwordOk(f.password)) p.push('password');
  if (f.city.trim().length < 2) p.push('city');
  if (f.tpos_amount === '' || !(Number(f.tpos_amount) >= 0)) p.push('tpos_amount');
  const t = Number(f.trial_limit);
  if (f.trial_limit === '' || !(Number.isInteger(t) && t >= 0 && t <= 1000)) p.push('trial_limit');
  return p;
}

const Field = ({ label, hint, bad, children }) => (
  <div>
    <label className="block text-sm font-semibold text-slate-600 mb-2">{label}</label>
    {children}
    {bad && <p className="text-xs text-red-500 mt-1">{hint}</p>}
  </div>
);

const NewSubAdmin = () => {
  const [f, setF] = useState(EMPTY);
  const [touched, setTouched] = useState(false);
  const [busy, setBusy] = useState(false);
  const navigate = useNavigate();

  const set = (key) => (e) => setF((s) => ({ ...s, [key]: e.target.value }));
  const bad = problems(f);
  const show = (key) => touched && bad.includes(key);

  const submit = async (e) => {
    e.preventDefault();
    setTouched(true);
    if (bad.length) return;
    setBusy(true);
    try {
      const r = await api.createSubAdmin({
        name: f.name.trim(),
        username: f.username.trim(),
        password: f.password,
        city: f.city.trim(),
        tpos_amount: Number(f.tpos_amount),
        trial_limit: Number(f.trial_limit),
      });
      toast.success('Sub admin created. Share the password with him now.');
      navigate(`/sub-admins/${r.sub_admin_id}/account`);
    } catch (err) {
      toast.error(errorText(err));
    } finally {
      setBusy(false);
    }
  };

  return (
    <form onSubmit={submit} className="max-w-3xl">
      <Card className="p-6 space-y-5">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 bg-violet-50 rounded-xl flex items-center justify-center">
            <UserPlus size={20} className="text-violet-600" />
          </div>
          <div>
            <h3 className="font-bold text-slate-800">New Sub Admin</h3>
            <p className="text-sm text-slate-500">Signs in on the admin app only. His name shows in "Collected by" messages.</p>
          </div>
        </div>

        <div className="grid sm:grid-cols-2 gap-4">
          <Field label="Name" bad={show('name')} hint="2 to 100 letters">
            <input value={f.name} maxLength={100} onChange={set('name')} className={inputClass} />
          </Field>
          <Field label="Username" bad={show('username')} hint="3 to 64: letters, numbers, . _ @ -">
            <input value={f.username} maxLength={64} autoComplete="off" onChange={set('username')} className={inputClass} />
          </Field>
          <Field label="City" bad={show('city')} hint="2 to 60 letters">
            <input value={f.city} maxLength={60} onChange={set('city')} className={inputClass} />
          </Field>
          <Field label="TPOS amount per ISP (Rs.)" bad={show('tpos_amount')} hint="0 or more">
            <input type="number" min="0" value={f.tpos_amount} onChange={set('tpos_amount')} className={inputClass} />
          </Field>
          <Field label="Trial ISPs per month" bad={show('trial_limit')} hint="0 to 1000">
            <input type="number" min="0" max="1000" value={f.trial_limit} onChange={set('trial_limit')} className={inputClass} />
          </Field>
        </div>

        <Field label="Password" bad={show('password')} hint="Password does not meet the rule">
          <PasswordInput value={f.password} onChange={(password) => setF((s) => ({ ...s, password }))} />
        </Field>

        <Button type="submit" busy={busy}>Create Sub Admin</Button>
      </Card>
    </form>
  );
};

export default NewSubAdmin;
