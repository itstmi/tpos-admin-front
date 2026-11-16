import { CalendarDays, CheckCircle2, MessageCircle, Send, UserCheck, UserX, Users, Wallet, XCircle } from 'lucide-react';
import { StatCard } from '../../../components/ui';
import Export from './Export';
import { count, money } from '../../../format';

export const Customers = ({ isp }) => (
  <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
    <StatCard icon={Users} label="Total customers" value={count(isp.customers_total)} />
    <StatCard icon={UserCheck} label="Active" value={count(isp.customers_active)} tone="blue" />
    <StatCard icon={UserX} label="Not active" value={count(isp.customers_total - isp.customers_active)} tone="slate" />
  </div>
);

export const Collection = ({ isp }) => (
  <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
    <StatCard icon={Wallet} label="Today" value={money(isp.collected_today)} />
    <StatCard icon={CalendarDays} label="This month" value={money(isp.collected_month)} tone="blue" />
    <StatCard icon={CheckCircle2} label="Total" value={money(isp.collected_total)} tone="violet" />
  </div>
);

export const WhatsApp = ({ isp }) => (
  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
    <StatCard icon={Send} label="Sent today" value={count(isp.wa_sent_today)} />
    <StatCard icon={MessageCircle} label="Sent total" value={count(isp.wa_sent_total)} tone="blue" />
    <StatCard icon={XCircle} label="Failed today" value={count(isp.wa_failed_today)} tone="amber" />
    <StatCard icon={XCircle} label="Failed total" value={count(isp.wa_failed_total)} tone="red" />
  </div>
);

const Section = ({ title, children }) => (
  <div className="space-y-3">
    <h4 className="text-sm font-semibold text-slate-500 uppercase tracking-wider">{title}</h4>
    {children}
  </div>
);

// Customers, Collection and WhatsApp numbers on one tab, export at the end
export const Overview = ({ isp, ispId }) => (
  <div className="space-y-6">
    <Section title="Customers"><Customers isp={isp} /></Section>
    <Section title="Collection"><Collection isp={isp} /></Section>
    <Section title="WhatsApp"><WhatsApp isp={isp} /></Section>
    <Section title="Export"><Export isp={isp} ispId={ispId} /></Section>
  </div>
);
