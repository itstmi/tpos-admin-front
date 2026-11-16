import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import toast from 'react-hot-toast';
import { Building2 } from 'lucide-react';
import { api, errorText } from '../api';
import { Button, Card, inputClass } from '../components/ui';

const EMPTY = {
  business_name: '', owner_name: '', phone: '', password: '', city: '',
  monthly_charges: '', tpos_amount: '', trial: true, trial_days: '7',
};

// Same limits the server checks
function problems(f) {
  const p = [];
  if (f.business_name.trim().length < 2) p.push('business_name');
  if (f.owner_name.trim().length < 2) p.push('owner_name');
  if (!/^03[0-9]{9}$/.test(f.phone)) p.push('phone');
  if (f.password.length < 8) p.push('password');
  if (f.city.trim().length < 2) p.push('city');
  if (!(Number(f.monthly_charges) > 0)) p.push('monthly_charges');
  if (f.tpos_amount === '' || Number(f.tpos_amount) < 0 || Number(f.tpos_amount) > Number(f.monthly_charges)) p.push('tpos_amount');
  const days = Number(f.trial_days);
  if (f.trial && !(Number.isInteger(days) && days >= 1 && days <= 365)) p.push('trial_days');
  return p;
}

const Field = ({ label, hint, bad, children }) => (
  <div>
    <label className="block text-sm font-semibold text-slate-600 mb-2">{label}</label>
    {children}
    {bad && hint && <p className="text-xs text-red-500 mt-1">{hint}</p>}
  </div>
);

const NewIsp = () => {
  const [f, setF] = useState(EMPTY);
  const [touched, setTouched] = useState(false);
  const [busy, setBusy] = useState(false);
  const navigate = useNavigate();

  const set = (key) => (e) => setF((s) => ({ ...s, [key]: e.target.type === 'checkbox' ? e.target.checked : e.target.value }));
  const bad = problems(f);
  const show = (key) => touched && bad.includes(key);

  const submit = async (e) => {
    e.preventDefault();
    setTouched(true);
    if (bad.length) return;
    setBusy(true);
    try {
      const r = await api.createIsp({
        business_name: f.business_name.trim(),
        owner_name: f.owner_name.trim(),
        phone: f.phone,
        password: f.password,
        city: f.city.trim(),
        monthly_charges: Number(f.monthly_charges),
        tpos_amount: Number(f.tpos_amount),
        trial: f.trial,
        ...(f.trial ? { trial_days: Number(f.trial_days) } : {}),
      });
      toast.success('ISP created');
      navigate(`/isps/${r.isp_id}/controls`);
    } catch (err) {
      toast.error(errorText(err));
    } finally {
      setBusy(false);
    }
  };

  return (
    <form onSubmit={submit} className="max-w-6xl">
      <Card className="p-6 space-y-5">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 bg-emerald-50 rounded-xl flex items-center justify-center">
            <Building2 size={20} className="text-emerald-600" />
          </div>
          <div>
            <h3 className="font-bold text-slate-800">New ISP</h3>
            <p className="text-sm text-slate-500">Connection date is today. The owner signs in with the phone number and this password.</p>
          </div>
        </div>

        <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <Field label="Business name" bad={show('business_name')} hint="2 to 100 letters">
            <input value={f.business_name} maxLength={100} onChange={set('business_name')} className={inputClass} />
          </Field>
          <Field label="Owner name" bad={show('owner_name')} hint="2 to 100 letters">
            <input value={f.owner_name} maxLength={100} onChange={set('owner_name')} className={inputClass} />
          </Field>
          <Field label="Phone" bad={show('phone')} hint="03XXXXXXXXX">
            <input value={f.phone} maxLength={11} inputMode="numeric" onChange={set('phone')} placeholder="03XXXXXXXXX" className={inputClass} />
          </Field>
          <Field label="Owner password" bad={show('password')} hint="At least 8 characters">
            <input value={f.password} maxLength={128} autoComplete="new-password" onChange={set('password')} className={inputClass} />
          </Field>
          <Field label="City" bad={show('city')} hint="2 to 60 letters">
            <input value={f.city} maxLength={60} onChange={set('city')} className={inputClass} />
          </Field>
          <Field label="Monthly charges (Rs.)" bad={show('monthly_charges')} hint="More than 0">
            <input type="number" min="1" value={f.monthly_charges} onChange={set('monthly_charges')} className={inputClass} />
          </Field>
          <Field label="TPOS amount (Rs.)" bad={show('tpos_amount')} hint="0 or more, not above monthly charges">
            <input type="number" min="0" value={f.tpos_amount} onChange={set('tpos_amount')} className={inputClass} />
          </Field>
          <Field label="Trial" bad={show('trial_days')} hint="1 to 365 days">
            <div className="flex items-center gap-2">
              <label className="flex items-center gap-2 px-3 py-2.5 border-2 border-slate-200 rounded-xl cursor-pointer text-slate-800 flex-shrink-0">
                <input type="checkbox" checked={f.trial} onChange={set('trial')} className="w-4 h-4 accent-emerald-500" />
                <span className="text-sm">On</span>
              </label>
              <input
                type="number"
                min="1"
                max="365"
                value={f.trial_days}
                disabled={!f.trial}
                onChange={set('trial_days')}
                className={`${inputClass} disabled:opacity-40`}
                title="Trial days"
              />
              <span className="text-sm text-slate-500">days</span>
            </div>
          </Field>
        </div>

        <Button type="submit" busy={busy}>Create ISP</Button>
      </Card>
    </form>
  );
};

export default NewIsp;
