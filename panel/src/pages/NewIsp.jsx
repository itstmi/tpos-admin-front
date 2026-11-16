import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import toast from 'react-hot-toast';
import { api, errorText } from '../api';
import Modal, { ModalField, fieldClass } from '../components/Modal';

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

// Popup from the ISP list. Connection date is today; the owner signs in with the phone and this password.
const NewIspModal = ({ onClose }) => {
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
    if (bad.length || busy) return;
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
      setBusy(false);
    }
  };

  return (
    <Modal title="Add New ISP" onClose={onClose} onSubmit={submit} busy={busy} submitText="Create ISP">
      <div className="grid grid-cols-2 gap-3">
        <ModalField label="Business Name *" bad={show('business_name')} hint="2 to 100 letters">
          <input value={f.business_name} maxLength={100} onChange={set('business_name')} className={fieldClass} placeholder="ISP name" />
        </ModalField>
        <ModalField label="Owner Name *" bad={show('owner_name')} hint="2 to 100 letters">
          <input value={f.owner_name} maxLength={100} onChange={set('owner_name')} className={fieldClass} placeholder="Owner name" />
        </ModalField>
      </div>
      <div className="grid grid-cols-2 gap-3">
        <ModalField label="Phone *" bad={show('phone')} hint="03XXXXXXXXX">
          <input type="tel" value={f.phone} onChange={(e) => setF((s) => ({ ...s, phone: e.target.value.replace(/\D/g, '').slice(0, 11) }))} className={fieldClass} placeholder="03001234567" />
        </ModalField>
        <ModalField label="Owner Password *" bad={show('password')} hint="At least 8 characters">
          <input value={f.password} maxLength={128} autoComplete="new-password" onChange={set('password')} className={fieldClass} placeholder="Password" />
        </ModalField>
      </div>
      <div className="grid grid-cols-2 gap-3">
        <ModalField label="City *" bad={show('city')} hint="2 to 60 letters">
          <input value={f.city} maxLength={60} onChange={set('city')} className={fieldClass} placeholder="City" />
        </ModalField>
        <ModalField label="Monthly Charges *" bad={show('monthly_charges')} hint="More than 0">
          <input type="number" min="1" value={f.monthly_charges} onChange={set('monthly_charges')} className={fieldClass} placeholder="0" />
        </ModalField>
      </div>
      <div className="grid grid-cols-2 gap-3">
        <ModalField label="TPOS Amount *" bad={show('tpos_amount')} hint="Not above monthly charges">
          <input type="number" min="0" value={f.tpos_amount} onChange={set('tpos_amount')} className={fieldClass} placeholder="0" />
        </ModalField>
        <div>
          <div className="flex items-center justify-between mb-1">
            <label className="block text-xs font-semibold text-slate-700">Trial Days</label>
            <label className="flex items-center gap-1 text-xs text-slate-600">
              <input type="checkbox" checked={f.trial} onChange={set('trial')} className="w-3.5 h-3.5 accent-emerald-600" />
              Trial
            </label>
          </div>
          {f.trial ? (
            <input type="number" min="1" max="365" value={f.trial_days} onChange={set('trial_days')} className={fieldClass} />
          ) : (
            <div className="w-full px-3 py-2 border border-slate-200 rounded-xl bg-slate-50 text-sm text-slate-500">Paid, billing from today</div>
          )}
          {show('trial_days') && <p className="text-[11px] text-red-500 mt-1">1 to 365 days</p>}
        </div>
      </div>
    </Modal>
  );
};

export default NewIspModal;
