import { date as formatDate, money as formatCurrency } from './format';

// Turns one activity log row into a short line for the Activity tab and the
// customer History. Only the keys each action really saves are read.

const words = (key) => String(key || '').replace(/_/g, ' ').replace(/([a-z])([A-Z])/g, '$1 $2').toLowerCase();

const statusWord = (value) => {
  const s = String(value || '');
  return s ? s.charAt(0).toUpperCase() + s.slice(1) : '';
};

// Column names saved in the log, shown in plain words
const FIELD_NAMES = {
  package_id: 'package',
  package_amount: 'monthly amount',
  assigned_collector_id: 'collector',
  area_id: 'area',
  plus_code: 'location',
  cnic_enc: 'CNIC',
  connection_date: 'connection date',
  equipment_note: 'equipment note'
};

const fieldList = (updates) => {
  if (!Array.isArray(updates) || updates.length === 0) return '';
  const names = updates
    .map((u) => (typeof u === 'string' ? u : u && typeof u === 'object' ? (u.field || u.key || Object.keys(u)[0]) : ''))
    .filter(Boolean)
    .map((name) => FIELD_NAMES[name] || words(name));
  return [...new Set(names)].join(', ');
};

const count = (n, one, many) => `${Number(n || 0)} ${Number(n) === 1 ? one : many}`;

// Backup rows may hold a count or just true/false
const part = (value, name) => (typeof value === 'number' ? `${value} ${name}` : value === true ? name : '');

const join = (...parts) => parts.filter(Boolean).join(', ');

// Edit logs saved before this moment list every form field, not only the changed ones
const FULL_FORM_EDITS_BEFORE = Date.parse('2026-11-05T08:25:00Z');
const isOldEditLog = (createdAt) => {
  const t = Date.parse(createdAt || '');
  return Number.isFinite(t) && t < FULL_FORM_EDITS_BEFORE;
};

export const describeActivity = (action, details, { forCustomer = false, createdAt } = {}) => {
  const d = details && typeof details === 'object' ? details : {};
  const customer = forCustomer ? '' : (d.customer_name || d.customerName || '');

  if (/^login/i.test(action || '')) {
    const app = /📱|\(A\)/u.test(action);
    return { label: 'Login', tone: 'slate', text: app ? 'Mobile app' : 'Web panel' };
  }

  switch (action) {
    case 'Logout':
      return { label: 'Logout', tone: 'slate', text: '' };
    case 'Create Customer':
      return { label: 'Customer Added', tone: 'green', text: join(customer, d.activated === true && 'activated at once') };
    case 'Update Customer': {
      const fields = isOldEditLog(createdAt) ? '' : fieldList(d.updates);
      return { label: 'Customer Edited', tone: 'blue', text: join(customer, fields && `changed: ${fields}`, d.new_status && `status set to ${statusWord(d.new_status)}`) };
    }
    case 'Update Customer Status':
      return { label: 'Status Changed', tone: 'amber', text: join(customer, d.new_status && `set to ${statusWord(d.new_status)}`) };
    case 'Auto Inactive':
      return { label: 'Auto Inactive', tone: 'amber', text: join(customer, d.paid_until && `paid until ${formatDate(d.paid_until)}`) };
    case 'Assign Area':
      return { label: 'Area Assigned', tone: 'blue', text: customer };
    case 'Assign Collector':
      return { label: 'Collector Assigned', tone: 'blue', text: customer };
    case 'Delete Customer':
      return { label: 'Customer Deleted', tone: 'red', text: customer };
    case 'View Customer CNIC':
      return { label: 'CNIC Viewed', tone: 'amber', text: '' };
    case 'Update Location':
      return { label: 'Location Updated', tone: 'blue', text: customer };

    case 'Bulk Delete Customers': {
      const names = Array.isArray(d.customer_names) ? d.customer_names.filter(Boolean) : [];
      const shown = names.slice(0, 3).join(', ');
      const more = names.length > 3 ? ` and ${names.length - 3} more` : '';
      return { label: 'Customers Deleted', tone: 'red', text: join(count(d.customer_count, 'customer', 'customers'), shown && shown + more) };
    }
    case 'Bulk Update Connection Date':
      return { label: 'Bulk Update', tone: 'blue', text: `Connection date ${formatDate(d.connection_date)} for ${count(d.customer_count, 'customer', 'customers')}` };
    case 'Bulk Update Package':
      return { label: 'Bulk Update', tone: 'blue', text: join(`Package changed for ${count(d.customer_count, 'customer', 'customers')}`, d.package_amount != null && formatCurrency(d.package_amount)) };
    case 'Bulk Update Amount':
      return { label: 'Bulk Update', tone: 'blue', text: `Monthly amount ${formatCurrency(d.new_amount)} for ${count(d.customer_count, 'customer', 'customers')}` };
    case 'Bulk Change Status':
      return { label: 'Bulk Update', tone: 'amber', text: `${count(d.customer_count, 'customer', 'customers')} set to ${statusWord(d.new_status)}` };
    case 'Bulk Assign Area':
      return { label: 'Bulk Update', tone: 'blue', text: `Area assigned to ${count(d.customer_count, 'customer', 'customers')}` };
    case 'Bulk Import Customers':
      return { label: 'Customers Imported', tone: 'green', text: count(d.total_imported, 'customer', 'customers') };

    case 'Delete Payment':
      return { label: 'Payment Deleted', tone: 'red', text: join(customer, d.amount != null && formatCurrency(d.amount), d.receipt_number && `receipt ${d.receipt_number}`) };
    case 'Add Expense':
      return { label: 'Expense Added', tone: 'green', text: join(formatCurrency(d.amount), d.description) };
    case 'Delete Expense':
      return { label: 'Expense Deleted', tone: 'red', text: join(formatCurrency(d.amount), d.description) };
    case 'Collector Handover':
      return { label: 'Handover', tone: 'blue', text: join(d.collector_name, d.received_amount != null && `received ${formatCurrency(d.received_amount)}`, d.remaining_balance != null && `remaining ${formatCurrency(d.remaining_balance)}`) };
    case 'Add Dealer Credit':
      return { label: 'Dealer Credit', tone: 'blue', text: join(d.dealer_name, d.credit != null && `credit ${formatCurrency(d.credit)}`, Number(d.paid) > 0 && `paid ${formatCurrency(d.paid)}`) };
    case 'Dealer Payment':
      return { label: 'Dealer Payment', tone: 'green', text: join(d.dealer_name, d.paid != null && formatCurrency(d.paid)) };

    case 'Create Package':
      return { label: 'Package Added', tone: 'green', text: d.package_name || '' };
    case 'Update Package':
      return { label: 'Package Edited', tone: 'blue', text: join(d.package_name, fieldList(d.updates) && `changed: ${fieldList(d.updates)}`) };
    case 'Delete Package':
      return { label: 'Package Deleted', tone: 'red', text: d.package_name || '' };
    case 'Create Area':
      return { label: 'Area Added', tone: 'green', text: d.area_name || '' };
    case 'Update Area':
      return { label: 'Area Edited', tone: 'blue', text: join(d.area_name, fieldList(d.updates) && `changed: ${fieldList(d.updates)}`) };
    case 'Delete Area':
      return { label: 'Area Deleted', tone: 'red', text: d.area_name || '' };

    case 'Create Collector':
      return { label: 'Collector Added', tone: 'green', text: d.collector_name || '' };
    case 'Update Collector':
      return { label: 'Collector Edited', tone: 'blue', text: join(d.collector_name, fieldList(d.updates) && `changed: ${fieldList(d.updates)}`) };
    case 'Delete Collector':
      return { label: 'Collector Deleted', tone: 'red', text: d.collector_name || '' };
    case 'Reset Collector Password':
      return { label: 'Password Reset', tone: 'amber', text: d.collector_name || '' };
    case 'Password Reset':
      return { label: 'Password Reset', tone: 'amber', text: 'Own password' };
    case 'Secret Question Setup':
      return { label: 'Security Question', tone: 'slate', text: 'Set up' };

    case 'Update Payment Account':
      return { label: 'Payment Account', tone: 'blue', text: d.method ? `${words(d.method)} account updated` : '' };
    case 'Download Backup':
      return { label: 'Backup', tone: 'slate', text: join(part(d.customers, 'customers'), part(d.payments, 'payments'), d.with_cnic === true && 'with CNIC') };

    default:
      return { label: action || 'Activity', tone: 'slate', text: '' };
  }
};

export const TONE_CLASSES = {
  green: 'bg-emerald-50 dark:bg-emerald-500/10 text-emerald-700 dark:text-emerald-300 border-emerald-100 dark:border-emerald-500/25',
  blue: 'bg-blue-50 dark:bg-blue-500/10 text-blue-700 dark:text-blue-300 border-blue-100 dark:border-blue-500/25',
  amber: 'bg-amber-50 dark:bg-amber-500/10 text-amber-700 dark:text-amber-300 border-amber-200 dark:border-amber-500/25',
  red: 'bg-red-50 dark:bg-red-500/10 text-red-600 dark:text-red-300 border-red-200 dark:border-red-500/25',
  slate: 'bg-slate-50 text-slate-600 border-slate-200'
};
