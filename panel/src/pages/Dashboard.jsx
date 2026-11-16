import { useNavigate } from 'react-router-dom';
import { Activity, ArrowUpRight, Building2, Clock, MessageSquare, Receipt, Smartphone, Wallet } from 'lucide-react';
import { api } from '../api';
import { Loaded, useLoad } from '../components/ui';
import { count, money } from '../format';

const monthLabel = () => new Date().toLocaleDateString('en-PK', { month: 'long', year: 'numeric', timeZone: 'Asia/Karachi' });

function waTexts(wa) {
  if (wa.status === 'not_configured') return { service: 'Not set up', number: 'Not set up', dots: ['bg-red-500', 'bg-red-500'] };
  if (wa.server_reachable === false) return { service: 'Unreachable', number: 'Unknown', dots: ['bg-red-500', 'bg-slate-400'] };
  const connected = wa.status === 'connected';
  return { service: 'Active', number: connected ? 'Connected' : 'Not connected', dots: ['bg-emerald-500', connected ? 'bg-emerald-500' : 'bg-amber-500'] };
}

const SmallCard = ({ label, value, icon: Icon, gradient, bgLight, iconColor, dot, onClick }) => (
  <div
    onClick={onClick}
    className="group relative bg-white rounded-2xl p-6 shadow-sm border border-slate-200/60 cursor-pointer hover:shadow-xl hover:shadow-slate-200/50 hover:-translate-y-1 transition-all duration-300"
  >
    <div className={`absolute top-0 left-6 right-6 h-1 bg-gradient-to-r ${gradient} rounded-b-full`}></div>
    <div className="flex items-start justify-between gap-3">
      <div className="min-w-0">
        <p className="text-sm font-medium text-slate-500 truncate">{label}</p>
        {dot ? (
          <div className="mt-2 h-9 flex items-center gap-2">
            <span className={`w-2.5 h-2.5 rounded-full flex-shrink-0 ${dot}`}></span>
            <p className="text-lg font-bold text-slate-800 truncate">{value}</p>
          </div>
        ) : (
          <p className="text-3xl font-bold text-slate-800 mt-2">{value}</p>
        )}
      </div>
      <div className={`w-12 h-12 ${bgLight} rounded-xl flex items-center justify-center group-hover:scale-110 transition-transform duration-300`}>
        <Icon className={`w-6 h-6 ${iconColor}`} />
      </div>
    </div>
    <div className="absolute bottom-4 right-4 opacity-0 group-hover:opacity-100 transition-opacity">
      <ArrowUpRight size={18} className="text-slate-400" />
    </div>
  </div>
);

const BigCard = ({ label, icon: Icon, gradient, sub, onClick, children }) => (
  <div
    onClick={onClick}
    className={`group relative overflow-hidden bg-gradient-to-br ${gradient} rounded-2xl p-6 ${onClick ? 'cursor-pointer' : ''} hover:shadow-xl hover:-translate-y-1 transition-all duration-300`}
  >
    <div className="absolute top-0 right-0 w-32 h-32 bg-white/10 rounded-full -translate-y-16 translate-x-16"></div>
    <div className="absolute bottom-0 left-0 w-24 h-24 bg-white/5 rounded-full translate-y-12 -translate-x-12"></div>
    <div className="relative">
      <div className="flex items-center justify-between mb-2">
        <p className={`text-sm font-medium ${sub}`}>{label}</p>
        <div className="w-10 h-10 bg-white/20 rounded-xl flex items-center justify-center group-hover:scale-110 transition-transform duration-300">
          <Icon className="w-5 h-5 text-white" />
        </div>
      </div>
      {children}
    </div>
  </div>
);

const Line = ({ title, note, value, sub, onClick }) => (
  <div
    onClick={onClick ? (e) => { e.stopPropagation(); onClick(); } : undefined}
    className={`-mx-2 px-2 py-1 mt-1 rounded-lg ${onClick ? 'cursor-pointer hover:bg-white/10' : ''} transition-colors`}
  >
    <div className="flex items-baseline justify-between gap-2">
      <p className={`text-[11px] font-medium ${sub} truncate`}>{title}</p>
      {note && <p className={`text-[10px] ${sub} flex-shrink-0`}>{note}</p>}
    </div>
    <p className="text-xl font-bold tracking-tight text-white">{value}</p>
  </div>
);

// One request for the whole page
const Dashboard = () => {
  const state = useLoad(() => api.dashboard(), []);
  const navigate = useNavigate();

  return (
    <Loaded state={state}>
      {(d) => {
        const wa = waTexts(d.whatsapp);
        const month = monthLabel();
        return (
          <div className="space-y-8">
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
              <SmallCard label="Total ISPs" value={count(d.isps.total)} icon={Building2} gradient="from-blue-500 to-blue-600" bgLight="bg-blue-50" iconColor="text-blue-500" onClick={() => navigate('/isps')} />
              <SmallCard label="Active ISPs" value={count(d.isps.active)} icon={Activity} gradient="from-emerald-500 to-emerald-600" bgLight="bg-emerald-50" iconColor="text-emerald-500" onClick={() => navigate('/isps')} />
              <SmallCard label="WhatsApp Service" value={wa.service} dot={wa.dots[0]} icon={MessageSquare} gradient="from-violet-500 to-violet-600" bgLight="bg-violet-50" iconColor="text-violet-500" onClick={() => navigate('/settings/whatsapp')} />
              <SmallCard label="WhatsApp Number" value={wa.number} dot={wa.dots[1]} icon={Smartphone} gradient="from-violet-500 to-violet-600" bgLight="bg-violet-50" iconColor="text-violet-500" onClick={() => navigate('/settings/whatsapp')} />
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
              <BigCard label="Collection Details" icon={Wallet} gradient="from-emerald-500 to-emerald-600" sub="text-emerald-100">
                <Line title="This month's collection" note={month} value={money(d.collection.month_total)} sub="text-emerald-100" onClick={() => navigate('/report/collection')} />
                <Line title="Received in handovers" note={month} value={money(d.collection.from_sub_admins)} sub="text-emerald-100" onClick={() => navigate('/report/collection')} />
              </BigCard>

              <BigCard label="Pending Details" icon={Clock} gradient="from-amber-500 to-amber-600" sub="text-amber-100">
                <Line title="Pending amount" note={`${count(d.pending.own_bills)} ISP bills`} value={money(d.pending.own_amount)} sub="text-amber-100" />
                <Line title="Pending from sub admins" note={`${count(d.pending.sub_admins_bills)} bills + older`} value={money(d.pending.sub_admins_due)} sub="text-amber-100" onClick={() => navigate('/sub-admins')} />
              </BigCard>

              <BigCard label="Customer Alerts" icon={MessageSquare} gradient="from-violet-500 to-violet-600" sub="text-violet-100" onClick={() => navigate('/settings/whatsapp')}>
                <div className="grid grid-cols-3 gap-2 mb-3">
                  {[['Total', d.messages.sent_total], ['Today', d.messages.sent_today], ['Failed', d.messages.failed_total]].map(([label, value]) => (
                    <div key={label} className="bg-white/10 rounded-lg p-2 text-center">
                      <p className="text-[10px] text-violet-200 font-medium">{label}</p>
                      <p className="text-base font-bold text-white">{count(value)}</p>
                    </div>
                  ))}
                </div>
                <div className="h-11 flex flex-col justify-center">
                  {d.whatsapp.phone_number ? (
                    <>
                      <p className="text-[10px] text-violet-200">TPOS number</p>
                      <p className="text-sm font-semibold text-white tracking-tight">{d.whatsapp.phone_number}</p>
                    </>
                  ) : (
                    <p className="text-xs text-violet-200 truncate">TPOS WhatsApp {wa.number.toLowerCase()}</p>
                  )}
                </div>
              </BigCard>

              <BigCard label="Expenses & Handover" icon={Receipt} gradient="from-cyan-500 to-cyan-600" sub="text-cyan-100">
                <Line title="This month's expenses" note={month} value={money(d.money.expenses)} sub="text-cyan-100" onClick={() => navigate('/report/expenses')} />
                <Line title="Pending handover" note={`${count(d.money.pending_handover_bills)} bills, ${month}`} value={money(d.money.pending_handover)} sub="text-cyan-100" onClick={() => navigate('/sub-admins')} />
              </BigCard>
            </div>
          </div>
        );
      }}
    </Loaded>
  );
};

export default Dashboard;
