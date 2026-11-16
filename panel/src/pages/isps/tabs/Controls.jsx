import { useState } from 'react';
import toast from 'react-hot-toast';
import { api, errorText } from '../../../api';
import ConfirmButton from '../../../components/ConfirmButton';
import { Badge, Button, Card, Loaded, inputClass, useLoad } from '../../../components/ui';
import { date } from '../../../format';

const TOGGLES = [
  { control: 'whatsapp', field: 'whatsapp_enabled', label: 'WhatsApp' },
  { control: 'dealer', field: 'dealer_enabled', label: 'Dealer' },
  { control: 'auto_bill', field: 'auto_bill', label: 'Auto bill' },
];

function blockReason(c) {
  if (c.status !== 'blocked') return null;
  if (c.block_reason === 'trial') return 'Trial ended';
  if (c.blocked_by === 'wrong_password') return 'Blocked after wrong passwords';
  if (c.block_reason === 'sub_admin_blocked') return 'Its sub admin is blocked';
  if (c.blocked_by_name) return `Blocked by ${c.blocked_by_name}`;
  return 'Blocked';
}

const CardShell = ({ title, state, tone, note, children }) => (
  <Card className="p-4 flex flex-col gap-3">
    <div className="flex items-center justify-between gap-2">
      <p className="font-semibold text-slate-800">{title}</p>
      <Badge tone={tone}>{state}</Badge>
    </div>
    {note && <p className="text-xs text-slate-500">{note}</p>}
    <div className="mt-auto flex flex-wrap gap-2">{children}</div>
  </Card>
);

const Controls = ({ ispId, reloadIsp }) => {
  const state = useLoad(() => api.ispControls(ispId).then((d) => d.controls), [ispId]);
  const [busy, setBusy] = useState(null);
  const [days, setDays] = useState('7');

  // Each card saves only its own change; the answer holds the fresh controls
  const save = async (key, call, after) => {
    setBusy(key);
    try {
      const r = await call();
      if (r?.controls) state.setData(r.controls);
      toast.success('Saved', { id: 'saved' });
      if (after) after();
    } catch (err) {
      toast.error(errorText(err));
    } finally {
      setBusy(null);
    }
  };

  return (
    <Loaded state={state}>
      {(c) => {
        const trial = !c.bill_start;
        const reason = blockReason(c);
        return (
          <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
            {TOGGLES.map((t) => {
              const on = Boolean(c[t.field]);
              return (
                <CardShell key={t.control} title={t.label} state={on ? 'Enabled' : 'Disabled'} tone={on ? 'emerald' : 'slate'}>
                  <Button
                    tone={on ? 'slate' : 'emerald'}
                    busy={busy === t.control}
                    onClick={() => save(t.control, () => api.setControl(ispId, t.control, !on))}
                  >
                    {on ? 'Disable' : 'Enable'}
                  </Button>
                </CardShell>
              );
            })}

            <CardShell
              title="Access"
              state={c.status === 'blocked' ? 'Blocked' : 'Open'}
              tone={c.status === 'blocked' ? 'red' : 'emerald'}
              note={reason}
            >
              <ConfirmButton
                tone={c.status === 'blocked' ? 'emerald' : 'red'}
                busy={busy === 'block'}
                onConfirm={() => save('block', () => api.setBlock(ispId, c.status !== 'blocked'), reloadIsp)}
              >
                {c.status === 'blocked' ? 'Unblock' : 'Block'}
              </ConfirmButton>
            </CardShell>

            {trial && (
              <CardShell title="Trial" state={`Ends ${date(c.trial_ends_at)}`} tone="amber" note="Paid starts billing from today and cannot go back to trial.">
                <ConfirmButton
                  busy={busy === 'paid'}
                  onConfirm={() => save('paid', () => api.makePaid(ispId), () => { state.reload(); reloadIsp(); })}
                >
                  Make paid
                </ConfirmButton>
                <div className="flex gap-2 w-full">
                  <input
                    type="number"
                    min="1"
                    max="365"
                    value={days}
                    onChange={(e) => setDays(e.target.value)}
                    className={`${inputClass} w-24`}
                  />
                  <Button
                    tone="slate"
                    busy={busy === 'extend'}
                    disabled={!(Number(days) >= 1 && Number(days) <= 365 && Number.isInteger(Number(days)))}
                    onClick={() => save('extend', () => api.extendTrial(ispId, Number(days)), () => { state.reload(); reloadIsp(); })}
                  >
                    Extend days
                  </Button>
                </div>
              </CardShell>
            )}
          </div>
        );
      }}
    </Loaded>
  );
};

export default Controls;
