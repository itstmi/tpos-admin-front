import { useState } from 'react';
import toast from 'react-hot-toast';
import { Loader2, Plus, X } from 'lucide-react';
import { api, errorText } from '../../api';
import ConfirmButton from '../../components/ConfirmButton';
import DateRange, { monthStart, pkToday } from '../../components/DateRange';
import { Button, Card, Loaded, useLoad } from '../../components/ui';
import { date, money } from '../../format';

const field = 'w-full px-4 py-3 border border-slate-200 rounded-xl focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 outline-none transition-all';

// Popup like the ISP panel's Add Expense
const AddExpense = ({ onClose, onAdded }) => {
  const [f, setF] = useState(() => ({ amount: '', title: '', spent_on: pkToday() }));
  const [busy, setBusy] = useState(false);
  const set = (k) => (e) => setF((s) => ({ ...s, [k]: e.target.value }));
  const ok = f.title.trim() && Number(f.amount) > 0 && f.spent_on && f.spent_on <= pkToday();

  const submit = async (e) => {
    e.preventDefault();
    if (!ok || busy) return;
    setBusy(true);
    try {
      const r = await api.addExpense({ title: f.title.trim(), amount: Number(f.amount), spent_on: f.spent_on });
      toast.success('Expense added');
      onAdded(r.expense);
      onClose();
    } catch (err) {
      toast.error(errorText(err));
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-2xl w-full max-w-md shadow-2xl">
        <div className="flex items-center justify-between p-6 border-b border-slate-100">
          <h2 className="text-xl font-bold text-slate-800">Add Expense</h2>
          <button onClick={onClose} className="p-2 text-slate-400 hover:bg-slate-100 rounded-lg transition-colors">
            <X size={20} />
          </button>
        </div>
        <form onSubmit={submit} className="p-6 space-y-4">
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-2">Amount</label>
            <input type="number" inputMode="decimal" min="1" value={f.amount} onChange={set('amount')} placeholder="e.g. 1500" className={field} />
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-2">Description</label>
            <input type="text" maxLength={120} value={f.title} onChange={set('title')} placeholder="e.g. Office electricity bill" className={field} />
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-2">Date</label>
            <input type="date" value={f.spent_on} max={pkToday()} onChange={set('spent_on')} className={field} />
          </div>
          <div className="flex gap-3 pt-2">
            <button type="button" onClick={onClose} className="flex-1 px-4 py-3 border border-slate-200 rounded-xl hover:bg-slate-50 font-medium text-slate-700 transition-colors">
              Cancel
            </button>
            <button type="submit" disabled={!ok || busy} className="flex-1 px-4 py-3 bg-emerald-500 text-white rounded-xl hover:bg-emerald-600 disabled:opacity-50 flex items-center justify-center gap-2 font-medium transition-colors">
              {busy && <Loader2 size={18} className="animate-spin" />}
              Add Expense
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

const Expenses = () => {
  const [range, setRange] = useState({ start: monthStart(), end: pkToday() });
  const [page, setPage] = useState(1);
  const state = useLoad(() => api.expenses(range.start, range.end, page), [range.start, range.end, page]);
  const [busy, setBusy] = useState(null);
  const [adding, setAdding] = useState(false);

  const remove = async (row) => {
    setBusy(row.id);
    try {
      await api.deleteExpense(row.id);
      state.setData((d) => ({ ...d, expenses: d.expenses.filter((x) => x.id !== row.id) }));
      toast.success('Expense deleted');
    } catch (err) {
      toast.error(errorText(err));
    } finally {
      setBusy(null);
    }
  };

  // A new expense inside the shown range goes on top; no reload
  const added = (row) => {
    if (page === 1 && row.spent_on >= range.start && row.spent_on <= range.end) {
      state.setData((d) => ({ ...d, expenses: [row, ...d.expenses] }));
    }
  };

  return (
    <div className="space-y-5">
      <div className="flex justify-end">
        <button
          onClick={() => setAdding(true)}
          className="inline-flex items-center gap-2 px-5 py-2.5 bg-gradient-to-r from-emerald-500 to-emerald-600 text-white rounded-xl hover:from-emerald-600 hover:to-emerald-700 transition-all shadow-lg shadow-emerald-500/20 font-medium"
        >
          <Plus size={20} /> Add Expense
        </button>
      </div>
      {adding && <AddExpense onClose={() => setAdding(false)} onAdded={added} />}
      <DateRange value={range} onChange={(r) => { setPage(1); setRange(r); }} />
      <Loaded state={state}>
        {(d) => (
          <Card className="overflow-x-auto">
            {d.expenses.length === 0 ? <p className="p-8 text-center text-slate-500">No expenses in this range.</p> : (
              <table className="w-full text-sm">
                <thead className="bg-slate-50 text-slate-500 text-left">
                  <tr>
                    {['Date', 'Description', 'Amount', ''].map((h) => <th key={h} className="px-4 py-3 font-semibold">{h}</th>)}
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {d.expenses.map((x) => (
                    <tr key={x.id}>
                      <td className="px-4 py-3 text-slate-700 whitespace-nowrap">{date(x.spent_on)}</td>
                      <td className="px-4 py-3 font-semibold text-slate-800">{x.title}</td>
                      <td className="px-4 py-3 text-slate-700">{money(x.amount)}</td>
                      <td className="px-4 py-3 text-right">
                        <ConfirmButton tone="slate" busy={busy === x.id} onConfirm={() => remove(x)}>Delete</ConfirmButton>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
            {(page > 1 || d.has_more) && (
              <div className="flex justify-between items-center p-4 border-t border-slate-100">
                <Button tone="slate" disabled={page <= 1} onClick={() => setPage((p) => p - 1)}>Previous</Button>
                <span className="text-sm text-slate-500">Page {page}</span>
                <Button tone="slate" disabled={!d.has_more} onClick={() => setPage((p) => p + 1)}>Next</Button>
              </div>
            )}
          </Card>
        )}
      </Loaded>
    </div>
  );
};

export default Expenses;
