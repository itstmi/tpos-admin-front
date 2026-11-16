import { useState } from 'react';
import toast from 'react-hot-toast';
import { Plus } from 'lucide-react';
import { api, errorText } from '../../api';
import ConfirmButton from '../../components/ConfirmButton';
import DateRange, { monthStart, pkToday } from '../../components/DateRange';
import { Button, Card, Loaded, inputClass, useLoad } from '../../components/ui';
import { date, money } from '../../format';

const EMPTY = { title: '', category: '', amount: '', spent_on: '', note: '' };

const AddExpense = ({ onAdded }) => {
  const [f, setF] = useState(() => ({ ...EMPTY, spent_on: pkToday() }));
  const [busy, setBusy] = useState(false);
  const set = (k) => (e) => setF((s) => ({ ...s, [k]: e.target.value }));
  const ok = f.title.trim() && Number(f.amount) > 0 && f.spent_on && f.spent_on <= pkToday();

  const submit = async (e) => {
    e.preventDefault();
    if (!ok) return;
    setBusy(true);
    try {
      const r = await api.addExpense({
        title: f.title.trim(),
        amount: Number(f.amount),
        spent_on: f.spent_on,
        ...(f.category.trim() ? { category: f.category.trim() } : {}),
        ...(f.note.trim() ? { note: f.note.trim() } : {}),
      });
      toast.success('Expense added');
      onAdded(r.expense);
      setF({ ...EMPTY, spent_on: pkToday() });
    } catch (err) {
      toast.error(errorText(err));
    } finally {
      setBusy(false);
    }
  };

  return (
    <Card className="p-5">
      <form onSubmit={submit} className="grid sm:grid-cols-2 lg:grid-cols-6 gap-3 items-end">
        <input value={f.title} maxLength={120} onChange={set('title')} placeholder="Title" className={`${inputClass} lg:col-span-2`} />
        <input value={f.category} maxLength={60} onChange={set('category')} placeholder="Category (optional)" className={inputClass} />
        <input type="number" min="1" value={f.amount} onChange={set('amount')} placeholder="Amount" className={inputClass} />
        <input type="date" value={f.spent_on} max={pkToday()} onChange={set('spent_on')} className={inputClass} />
        <Button type="submit" busy={busy} disabled={!ok}><Plus size={16} /> Add</Button>
        <input value={f.note} maxLength={500} onChange={set('note')} placeholder="Note (optional)" className={`${inputClass} sm:col-span-2 lg:col-span-6`} />
      </form>
    </Card>
  );
};

const Expenses = () => {
  const [range, setRange] = useState({ start: monthStart(), end: pkToday() });
  const [page, setPage] = useState(1);
  const state = useLoad(() => api.expenses(range.start, range.end, page), [range.start, range.end, page]);
  const [busy, setBusy] = useState(null);

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
      <AddExpense onAdded={added} />
      <DateRange value={range} onChange={(r) => { setPage(1); setRange(r); }} />
      <Loaded state={state}>
        {(d) => (
          <Card className="overflow-x-auto">
            {d.expenses.length === 0 ? <p className="p-8 text-center text-slate-500">No expenses in this range.</p> : (
              <table className="w-full text-sm">
                <thead className="bg-slate-50 text-slate-500 text-left">
                  <tr>
                    {['Date', 'Title', 'Category', 'Amount', 'Note', ''].map((h) => <th key={h} className="px-4 py-3 font-semibold">{h}</th>)}
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {d.expenses.map((x) => (
                    <tr key={x.id}>
                      <td className="px-4 py-3 text-slate-700 whitespace-nowrap">{date(x.spent_on)}</td>
                      <td className="px-4 py-3 font-semibold text-slate-800">{x.title}</td>
                      <td className="px-4 py-3 text-slate-600">{x.category || '-'}</td>
                      <td className="px-4 py-3 text-slate-700">{money(x.amount)}</td>
                      <td className="px-4 py-3 text-slate-600">{x.note || '-'}</td>
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
