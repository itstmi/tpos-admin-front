import { useEffect, useRef, useState } from 'react';
import toast from 'react-hot-toast';
import { MessageCircle } from 'lucide-react';
import { api, errorText } from '../../api';
import ConfirmButton from '../../components/ConfirmButton';
import { Badge, Button, Card, Loaded, useLoad } from '../../components/ui';
import Alerts from './Alerts';
import MessageHistory from './MessageHistory';

const LABEL = {
  connected: ['emerald', 'Connected'],
  scan_qr: ['amber', 'Scan QR'],
  connecting: ['blue', 'Connecting'],
  disconnected: ['slate', 'Disconnected'],
  not_configured: ['red', 'Not set up'],
  unknown: ['red', 'Server not reachable'],
};

// The QR changes every few seconds, so it is asked again every 5 seconds, only while
// waiting for a scan, and never longer than 3 minutes.
const QR_EVERY = 5000;
const QR_FOR = 3 * 60 * 1000;

// TPOS's own WhatsApp (session tpos_admin) for ISP bill messages and alerts
const WhatsApp = () => {
  const state = useLoad(() => api.whatsappStatus(), []);
  const [qr, setQr] = useState(null);
  const [waiting, setWaiting] = useState(false);
  const [busy, setBusy] = useState(null);
  const timer = useRef(null);

  const stop = () => {
    clearTimeout(timer.current);
    setWaiting(false);
    setQr(null);
  };
  useEffect(() => () => clearTimeout(timer.current), []);

  const poll = (until) => {
    api.whatsappQr()
      .then((r) => {
        if (r.status === 'connected') {
          stop();
          toast.success('WhatsApp connected');
          state.reload();
          return;
        }
        setQr(r.qr);
        if (Date.now() < until) timer.current = setTimeout(() => poll(until), QR_EVERY);
        else stop();
      })
      .catch((err) => {
        stop();
        toast.error(errorText(err));
      });
  };

  const connect = async () => {
    setBusy('connect');
    try {
      await api.whatsappConnect();
      setWaiting(true);
      poll(Date.now() + QR_FOR);
    } catch (err) {
      toast.error(errorText(err));
    } finally {
      setBusy(null);
    }
  };

  const disconnect = async () => {
    setBusy('disconnect');
    try {
      await api.whatsappDisconnect();
      stop();
      state.setData({ status: 'disconnected', phone_number: null, server_reachable: true });
    } catch (err) {
      toast.error(errorText(err));
    } finally {
      setBusy(null);
    }
  };

  return (
    <Loaded state={state}>
      {(s) => {
        const [tone, label] = LABEL[s.status] || ['slate', s.status];
        const connected = s.status === 'connected';
        return (
          <div className="space-y-5">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-5 items-start">
          <Card className="p-6 space-y-5">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-emerald-50 rounded-xl flex items-center justify-center">
                <MessageCircle size={20} className="text-emerald-600" />
              </div>
              <div className="flex-1">
                <h3 className="font-bold text-slate-800">TPOS WhatsApp</h3>
                <p className="text-sm text-slate-500">Sends ISP bill messages and alerts.</p>
              </div>
              <Badge tone={tone}>{label}</Badge>
            </div>

            {connected && s.phone_number && <p className="text-sm text-slate-600">Number: {s.phone_number}</p>}

            {waiting && (
              <div className="flex flex-col items-center gap-3 p-4 bg-slate-50 rounded-xl">
                {qr ? <img src={qr} alt="WhatsApp QR" className="w-64 h-64" /> : <p className="text-sm text-slate-500">Waiting for QR...</p>}
                <p className="text-xs text-slate-500 text-center">WhatsApp on the TPOS phone, Linked devices, Link a device, then scan.</p>
                <Button tone="slate" onClick={stop}>Stop</Button>
              </div>
            )}

            <div className="flex gap-2">
              {!connected && !waiting && s.status !== 'not_configured' && (
                <Button busy={busy === 'connect'} onClick={connect}>Connect</Button>
              )}
              {connected && (
                <ConfirmButton tone="red" busy={busy === 'disconnect'} onConfirm={disconnect}>Disconnect</ConfirmButton>
              )}
              <Button tone="slate" onClick={state.reload} disabled={waiting}>Check again</Button>
            </div>
          </Card>
          <Alerts />
          </div>
          <MessageHistory />
          </div>
        );
      }}
    </Loaded>
  );
};

export default WhatsApp;
