import { z } from 'zod';
import { db } from './db.js';
import { logActivity } from './logs.js';

// A real calendar day (2026-02-31 is refused)
function realDay(d) {
  const t = new Date(`${d}T00:00:00Z`);
  return !Number.isNaN(t.getTime()) && t.toISOString().slice(0, 10) === d;
}
const day = z.string().regex(/^\d{4}-\d{2}-\d{2}$/).refine(realDay);
const rangeQuery = z.object({ start: day.optional(), end: day.optional(), page: z.coerce.number().int().min(1).max(100000).optional() });
const expenseBody = z.object({
  title: z.string().trim().min(1).max(120),
  category: z.string().trim().max(60).optional(),
  amount: z.number().finite().positive().max(10000000),
  spent_on: day.optional(),
  note: z.string().trim().max(500).optional(),
}).strict();

const PAGE_SIZE = 50;

function pkToday() {
  return new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Karachi' }).format(new Date());
}

// Default range: this month so far (PKT)
function range(q) {
  const today = pkToday();
  const start = q.start ?? `${today.slice(0, 8)}01`;
  const end = q.end ?? today;
  return start <= end ? { start, end } : null;
}

// Panel (super admin) only
export function moneyRoutes(router) {
  router.get('/report', async (req, res) => {
    const parsed = rangeQuery.safeParse(req.query);
    const r = parsed.success ? range(parsed.data) : null;
    if (!r) return res.status(400).json({ error: 'invalid_input' });
    const report = await db.rpc('admin_money_report', { p_start: r.start, p_end: r.end });
    if (!report) return res.status(400).json({ error: 'invalid_input' });
    res.json({ report });
  });

  router.get('/expenses', async (req, res) => {
    const parsed = rangeQuery.safeParse(req.query);
    const r = parsed.success ? range(parsed.data) : null;
    if (!r) return res.status(400).json({ error: 'invalid_input' });
    const page = parsed.data.page ?? 1;
    const rows = await db.select('admin_expenses', {
      select: 'id,title,category,amount,spent_on,note,created_at',
      and: `(spent_on.gte.${r.start},spent_on.lte.${r.end})`,
      order: 'spent_on.desc,created_at.desc',
      limit: String(PAGE_SIZE + 1),
      offset: String((page - 1) * PAGE_SIZE),
    });
    res.json({ expenses: rows.slice(0, PAGE_SIZE), page, has_more: rows.length > PAGE_SIZE, start: r.start, end: r.end });
  });

  router.post('/expenses', async (req, res) => {
    const parsed = expenseBody.safeParse(req.body);
    if (!parsed.success) return res.status(400).json({ error: 'invalid_input' });
    const b = parsed.data;
    if (b.spent_on && b.spent_on > pkToday()) return res.status(400).json({ error: 'invalid_input' });
    const [row] = await db.insert('admin_expenses', {
      title: b.title,
      category: b.category || null,
      amount: b.amount,
      spent_on: b.spent_on ?? pkToday(),
      note: b.note || null,
      created_by: req.admin.id,
    });
    await logActivity(req.admin, 'expense_add', { expense_id: row.id, amount: b.amount });
    res.status(201).json({ expense: { id: row.id, title: row.title, category: row.category, amount: row.amount, spent_on: row.spent_on, note: row.note } });
  });

  router.delete('/expenses/:id', async (req, res) => {
    const parsed = z.uuid().safeParse(req.params.id);
    if (!parsed.success) return res.status(400).json({ error: 'invalid_input' });
    const [found] = await db.select('admin_expenses', { select: 'id,amount', id: `eq.${parsed.data}` });
    if (!found) return res.status(404).json({ error: 'not_found' });
    await db.remove('admin_expenses', { id: `eq.${found.id}` });
    await logActivity(req.admin, 'expense_delete', { expense_id: found.id, amount: found.amount });
    res.json({ ok: true });
  });
}
