import { decryptCnic } from './cnic.js';
import { db } from './db.js';

const PAGE = 1000;
const byName = (a, b) => a.localeCompare(b, 'en', { sensitivity: 'base' });
const clean = (v) => (v === null || v === undefined || v === '' ? '-' : String(v).replace(/[|\r\n]+/g, ' ').trim());

export const pkToday = () => new Date().toLocaleDateString('en-CA', { timeZone: 'Asia/Karachi' });

async function loadCustomers(ispId) {
  const rows = [];
  for (let offset = 0; ; offset += PAGE) {
    const query = {
      select: 'isp_id,name,username,phone,plus_code,cnic_enc,package_presets(name)',
      order: 'isp_id,id',
      limit: String(PAGE),
      offset: String(offset),
    };
    if (ispId) query.isp_id = `eq.${ispId}`;
    const page = await db.select('customers', query);
    rows.push(...page);
    if (page.length < PAGE) return rows;
  }
}

export function buildExport(isps, customers, decrypt = decryptCnic) {
  const stats = { isps: 0, customers: 0, cnicSaved: 0, cnicOpened: 0 };
  const lines = [`TPOS customers export ${pkToday()} (PKT)`, ''];
  const sorted = [...isps].sort((a, b) => byName(a.business_name || '', b.business_name || ''));

  for (const isp of sorted) {
    const list = customers
      .filter((c) => c.isp_id === isp.id)
      .sort((a, b) => byName(a.name || '', b.name || ''));
    stats.isps += 1;
    stats.customers += list.length;
    lines.push(`=== ${clean(isp.business_name)} (${list.length} customers) ===`);
    lines.push('Name | User ID | Phone | Package | Location | CNIC');
    for (const c of list) {
      let cnic = null;
      if (c.cnic_enc) {
        stats.cnicSaved += 1;
        cnic = decrypt(c.cnic_enc, c.isp_id);
        if (cnic) stats.cnicOpened += 1;
      }
      lines.push([c.name, c.username, c.phone, c.package_presets?.name, c.plus_code, cnic].map(clean).join(' | '));
    }
    lines.push('');
  }
  return { text: lines.join('\n'), stats };
}

export async function collectExport(ispId = null) {
  const query = { select: 'id,business_name' };
  if (ispId) query.id = `eq.${ispId}`;
  const isps = await db.select('isp_accounts', query);
  const customers = await loadCustomers(ispId);
  return buildExport(isps, customers);
}
