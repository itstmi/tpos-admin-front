import { useState } from 'react';
import toast from 'react-hot-toast';
import { BellRing } from 'lucide-react';
import { api, errorText } from '../../api';
import { Badge, Button, Card, Loaded, inputClass, useLoad } from '../../components/ui';

// Number that gets security alerts on WhatsApp (login lock, new sub admin, export all, server errors)
const Alerts = () => {
  const state = useLoad(() => api.alerts(), []);
  return (
    <Loaded state={state}>
      {(d) => <Form data={d} setData={state.setData} />}
    </Loaded>
  );
};

const Form = ({ data, setData }) => {
  const [phone, setPhone] = useState(data.phone || '');
  const [busy, setBusy] = useState(null);
  const ok = phone === '' || /^03[0-9]{9}$/.test(phone);
  const changed = phone !== (data.phone || '');

  const save = async () => {
    setBusy('save');
    try {
      const r = await api.setAlertPhone(phone);
      setData((d) => ({ ...d, phone: r.phone }));
      toast.success(phone ? 'Alert number saved' : 'Alert number removed');
    } catch (err) {
      toast.error(errorText(err));
    } finally {
      setBusy(null);
    }
  };

  const test = async () => {
    setBusy('test');
    try {
      const r = await api.testAlert();
      if (r.sent) toast.success('Test message sent');
      else toast.error('Test message failed. Check TPOS WhatsApp.');
    } catch (err) {
      toast.error(errorText(err));
    } finally {
      setBusy(null);
    }
  };

  return (
    <Card className="p-6 space-y-5">
      <div className="flex items-center gap-3">
        <div className="w-10 h-10 bg-amber-50 rounded-xl flex items-center justify-center">
          <BellRing size={20} className="text-amber-600" />
        </div>
        <div className="flex-1">
          <h3 className="font-bold text-slate-800">Alert number</h3>
          <p className="text-sm text-slate-500">Security alerts come here on WhatsApp. Leave empty to stop them.</p>
        </div>
        <Badge tone={data.whatsapp_ready ? 'emerald' : 'red'}>{data.whatsapp_ready ? 'WhatsApp ready' : 'WhatsApp not set up'}</Badge>
      </div>
      <input value={phone} maxLength={11} inputMode="numeric" onChange={(e) => setPhone(e.target.value.trim())} placeholder="03XXXXXXXXX" className={inputClass} />
      {!ok && <p className="text-xs text-red-500">03XXXXXXXXX or empty</p>}
      <div className="flex gap-2">
        <Button busy={busy === 'save'} disabled={!ok || !changed} onClick={save}>Save</Button>
        <Button tone="slate" busy={busy === 'test'} disabled={!data.phone || changed} onClick={test}>Send test</Button>
      </div>
    </Card>
  );
};

export default Alerts;
