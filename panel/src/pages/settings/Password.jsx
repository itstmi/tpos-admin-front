import { useState } from 'react';
import toast from 'react-hot-toast';
import { Check, Eye, EyeOff, KeyRound, Loader2 } from 'lucide-react';
import { api, errorText } from '../../api';
import ExportAll from '../ExportAll';

// Same rule the server checks: at least 15, with upper, lower, a number and a special character
const RULES = [
  { label: 'At least 15 characters', test: (p) => p.length >= 15 },
  { label: 'A capital letter', test: (p) => /[A-Z]/.test(p) },
  { label: 'A small letter', test: (p) => /[a-z]/.test(p) },
  { label: 'A number', test: (p) => /[0-9]/.test(p) },
  { label: 'A special character', test: (p) => /[^A-Za-z0-9]/.test(p) },
];

const inputClass = 'w-full px-4 py-3 pr-12 bg-white border-2 border-slate-200 rounded-xl focus:border-emerald-500 outline-none transition-all text-slate-800';

const Field = ({ label, value, onChange, show, autoComplete }) => (
  <div>
    <label className="block text-sm font-semibold text-slate-600 mb-2">{label}</label>
    <input
      type={show ? 'text' : 'password'}
      autoComplete={autoComplete}
      value={value}
      maxLength={128}
      onChange={(e) => onChange(e.target.value)}
      className={inputClass}
    />
  </div>
);

const Password = () => {
  const [current, setCurrent] = useState('');
  const [next, setNext] = useState('');
  const [confirm, setConfirm] = useState('');
  const [show, setShow] = useState(false);
  const [saving, setSaving] = useState(false);

  const rulesOk = RULES.every((r) => r.test(next));
  const ready = current && rulesOk && next === confirm && next !== current;

  const save = async (e) => {
    e.preventDefault();
    if (!ready || saving) return;
    setSaving(true);
    try {
      await api.changePassword(current, next);
      toast.success('Password changed. Other devices are signed out.');
      setCurrent('');
      setNext('');
      setConfirm('');
    } catch (err) {
      toast.error(errorText(err));
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-5 items-start">
      <form onSubmit={save} className="bg-white rounded-2xl border border-slate-200 shadow-sm p-6 space-y-5">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 bg-emerald-50 rounded-xl flex items-center justify-center">
            <KeyRound size={20} className="text-emerald-600" />
          </div>
          <div className="flex-1">
            <h3 className="font-bold text-slate-800">Change Password</h3>
            <p className="text-sm text-slate-500">Used for the panel sign in after the email code.</p>
          </div>
          <button type="button" onClick={() => setShow(!show)} className="p-2 text-slate-500 hover:text-slate-700" title={show ? 'Hide' : 'Show'}>
            {show ? <EyeOff size={20} /> : <Eye size={20} />}
          </button>
        </div>

        <Field label="Current password" value={current} onChange={setCurrent} show={show} autoComplete="current-password" />
        <Field label="New password" value={next} onChange={setNext} show={show} autoComplete="new-password" />

        <ul className="grid grid-cols-1 sm:grid-cols-2 gap-1.5">
          {RULES.map((r) => {
            const ok = r.test(next);
            return (
              <li key={r.label} className={`flex items-center gap-2 text-sm ${ok ? 'text-emerald-600' : 'text-slate-500'}`}>
                <Check size={14} className={ok ? 'opacity-100' : 'opacity-30'} />
                {r.label}
              </li>
            );
          })}
        </ul>

        <Field label="Confirm new password" value={confirm} onChange={setConfirm} show={show} autoComplete="new-password" />
        {confirm && next !== confirm && <p className="text-sm text-red-500">Passwords do not match.</p>}
        {next && next === current && <p className="text-sm text-red-500">New password must be different.</p>}

        <button
          type="submit"
          disabled={!ready || saving}
          className="w-full bg-gradient-to-r from-emerald-500 to-teal-500 text-white py-3 rounded-xl font-bold hover:from-emerald-400 hover:to-teal-400 transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
        >
          {saving && <Loader2 size={18} className="animate-spin" />}
          {saving ? 'Saving...' : 'Change Password'}
        </button>
      </form>
      <ExportAll />
    </div>
  );
};

export default Password;
