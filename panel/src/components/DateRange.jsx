import { useState } from 'react';
import { Button, Card, inputClass } from './ui';

// Today in Pakistan time as YYYY-MM-DD
export const pkToday = () => new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Karachi' }).format(new Date());
export const monthStart = () => `${pkToday().slice(0, 8)}01`;

// The page loads again only when Show is pressed, not on every date change
const DateRange = ({ value, onChange }) => {
  const [start, setStart] = useState(value.start);
  const [end, setEnd] = useState(value.end);
  const ok = start && end && start <= end;

  return (
    <Card className="p-4">
      <form
        className="flex flex-col sm:flex-row sm:items-end gap-3"
        onSubmit={(e) => {
          e.preventDefault();
          if (ok) onChange({ start, end });
        }}
      >
        <div>
          <label className="block text-xs font-semibold text-slate-500 mb-1">From</label>
          <input type="date" value={start} max={pkToday()} onChange={(e) => setStart(e.target.value)} className={inputClass} />
        </div>
        <div>
          <label className="block text-xs font-semibold text-slate-500 mb-1">To</label>
          <input type="date" value={end} max={pkToday()} onChange={(e) => setEnd(e.target.value)} className={inputClass} />
        </div>
        <Button type="submit" disabled={!ok}>Show</Button>
      </form>
    </Card>
  );
};

export default DateRange;
