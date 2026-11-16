import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import toast from 'react-hot-toast';
import { api, errorText } from '../../api';
import Modal, { ModalField, fieldClass } from '../../components/Modal';
import PasswordInput, { passwordOk } from '../../components/PasswordInput';

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

// Popup from the sub admin list. Signs in on the admin app only.
const NewSubAdminModal = ({ onClose }) => {
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
    if (bad.length || busy) return;
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
      setBusy(false);
    }
  };

  return (
    <Modal title="Add New Sub Admin" onClose={onClose} onSubmit={submit} busy={busy} submitText="Create Sub Admin">
      <div className="grid grid-cols-2 gap-3">
        <ModalField label="Name *" bad={show('name')} hint="2 to 100 letters">
          <input value={f.name} maxLength={100} onChange={set('name')} className={fieldClass} placeholder="Shows in Collected by" />
        </ModalField>
        <ModalField label="Username *" bad={show('username')} hint="3 to 64: letters, numbers, . _ @ -">
          <input value={f.username} maxLength={64} autoComplete="off" onChange={set('username')} className={fieldClass} placeholder="Username" />
        </ModalField>
      </div>
      <ModalField label="Password *" bad={show('password')} hint="Password does not meet the rule">
        <PasswordInput small value={f.password} onChange={(password) => setF((s) => ({ ...s, password }))} />
      </ModalField>
      <div className="grid grid-cols-3 gap-3">
        <ModalField label="City *" bad={show('city')} hint="2 to 60 letters">
          <input value={f.city} maxLength={60} onChange={set('city')} className={fieldClass} placeholder="City" />
        </ModalField>
        <ModalField label="TPOS Amount *" bad={show('tpos_amount')} hint="0 or more">
          <input type="number" min="0" value={f.tpos_amount} onChange={set('tpos_amount')} className={fieldClass} placeholder="Per ISP" />
        </ModalField>
        <ModalField label="Trials / Month *" bad={show('trial_limit')} hint="0 to 1000">
          <input type="number" min="0" max="1000" value={f.trial_limit} onChange={set('trial_limit')} className={fieldClass} placeholder="0" />
        </ModalField>
      </div>
    </Modal>
  );
};

export default NewSubAdminModal;
