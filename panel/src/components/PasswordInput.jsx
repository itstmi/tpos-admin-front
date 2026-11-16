import { useState } from 'react';
import toast from 'react-hot-toast';
import { Check, Copy, Wand2 } from 'lucide-react';
import { api, errorText } from '../api';
import { Button, inputClass } from './ui';
import { fieldClass } from './Modal';

// Sub admin password rule (same as the server): at least 15, upper, lower, number and special
export const PASSWORD_RULES = [
  { label: '15+ characters', test: (p) => p.length >= 15 },
  { label: 'Capital letter', test: (p) => /[A-Z]/.test(p) },
  { label: 'Small letter', test: (p) => /[a-z]/.test(p) },
  { label: 'Number', test: (p) => /[0-9]/.test(p) },
  { label: 'Special character', test: (p) => /[^A-Za-z0-9]/.test(p) },
];

export const passwordOk = (p) => PASSWORD_RULES.every((r) => r.test(p));

// Typed or made by the server (one call, only when the button is pressed)
const PasswordInput = ({ value, onChange, small = false }) => {
  const [busy, setBusy] = useState(false);

  const generate = async () => {
    setBusy(true);
    try {
      onChange((await api.newPassword()).password);
    } catch (err) {
      toast.error(errorText(err));
    } finally {
      setBusy(false);
    }
  };

  const copy = () => {
    navigator.clipboard?.writeText(value).then(() => toast.success('Copied'), () => toast.error('Could not copy'));
  };

  return (
    <div className="space-y-2">
      <div className="flex gap-2">
        <input value={value} maxLength={128} autoComplete="new-password" onChange={(e) => onChange(e.target.value)} className={`${small ? fieldClass : inputClass} font-mono`} />
        <Button type="button" tone="slate" busy={busy} onClick={generate} title="Make a strong password" className={small ? 'px-3 py-1.5' : ''}>
          <Wand2 size={16} />
        </Button>
        <Button type="button" tone="slate" disabled={!value} onClick={copy} title="Copy" className={small ? 'px-3 py-1.5' : ''}>
          <Copy size={16} />
        </Button>
      </div>
      <div className="flex flex-wrap gap-x-4 gap-y-1">
        {PASSWORD_RULES.map((r) => {
          const ok = r.test(value);
          return (
            <span key={r.label} className={`flex items-center gap-1 ${small ? 'text-[11px]' : 'text-xs'} ${ok ? 'text-emerald-600' : 'text-slate-500'}`}>
              <Check size={12} className={ok ? 'opacity-100' : 'opacity-30'} /> {r.label}
            </span>
          );
        })}
      </div>
    </div>
  );
};

export default PasswordInput;
