import { useState } from 'react';
import { AlertCircle, CheckCircle, Search } from 'lucide-react';
import { api } from '../../api';
import { Button, Card, Loaded, Pager, inputClass, useLoad } from '../../components/ui';

const TYPE = { bill: 'ISP Bill', alert: 'Alert', test: 'Test' };

// Messages TPOS's own WhatsApp sent, like the ISP panel's Message History. Search runs on the button.
const MessageHistory = () => {
  const [filter, setFilter] = useState({ search: '', page: 1 });
  const [typed, setTyped] = useState('');
  const state = useLoad(() => api.whatsappMessages(filter.search, filter.page), [filter.search, filter.page]);

  return (
    <Card className="p-5 space-y-4">
      <div className="flex flex-col sm:flex-row sm:items-center gap-3">
        <h3 className="font-bold text-slate-800 flex-1">Message History</h3>
        <form
          className="flex gap-2"
          onSubmit={(e) => {
            e.preventDefault();
            setFilter({ search: typed.trim().slice(0, 60), page: 1 });
          }}
        >
          <div className="relative">
            <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
            <input value={typed} maxLength={60} onChange={(e) => setTyped(e.target.value)} placeholder="Number or name" className={`${inputClass} pl-9 sm:w-56`} />
          </div>
          <Button type="submit">Search</Button>
        </form>
      </div>

      <Loaded state={state}>
        {(d) => (
          <>
            {d.items.length === 0 ? <p className="py-8 text-center text-slate-500">No messages yet.</p> : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead className="bg-slate-50 text-slate-500 text-left">
                    <tr>
                      {['Date & Time', 'Name', 'Number', 'Type', 'Status'].map((h) => <th key={h} className="px-4 py-2.5 font-semibold whitespace-nowrap">{h}</th>)}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {d.items.map((m) => (
                      <tr key={m.id}>
                        <td className="px-4 py-2.5 text-slate-600 whitespace-nowrap">{m.time}</td>
                        <td className="px-4 py-2.5 text-slate-800">{m.to_name || '-'}</td>
                        <td className="px-4 py-2.5 text-slate-600 whitespace-nowrap">{m.phone}</td>
                        <td className="px-4 py-2.5 text-slate-600">{TYPE[m.message_type] || m.message_type}</td>
                        <td className="px-4 py-2.5">
                          <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-semibold ${m.status === 'sent' ? 'bg-emerald-50 text-emerald-600' : 'bg-red-50 text-red-600'}`}>
                            {m.status === 'sent' ? <CheckCircle size={10} /> : <AlertCircle size={10} />}
                            {m.status === 'sent' ? 'Sent' : 'Failed'}
                          </span>
                          {m.status === 'failed' && m.error_log && <p className="text-xs text-red-500 mt-1 max-w-60">{m.error_log}</p>}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
            <Pager page={d.page} pages={d.pages} total={d.total} perPage={d.per_page} onPage={(page) => setFilter((f) => ({ ...f, page }))} />
          </>
        )}
      </Loaded>
    </Card>
  );
};

export default MessageHistory;
