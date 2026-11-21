const SOON_DAYS = 60;
const pad = n => String(n).padStart(2, '0');
const todayStr = d => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;

export function membershipOf(db, userId, now = new Date()) {
  const item = db.prepare("SELECT id FROM price_list WHERE category='Társasági díjak' AND name='Éves tagdíj'").get();
  const none = { status: 'Nincs tagdíj', valid_until: null, days_left: null, last_payment: null, years: [] };
  if (!item) return none;
  const rows = db.prepare("SELECT i.dup_key AS k,p.payment_date AS d FROM payment_items i JOIN payments p ON p.id=i.payment_id WHERE p.status='Sikeres' AND i.dup_key LIKE ?")
    .all(`year:%:user:${userId}:item:${item.id}`);
  if (!rows.length) return { ...none, item_id: item.id };
  const years = [...new Set(rows.map(r => +r.k.split(':')[1]))].sort((a, b) => a - b);
  const until = `${years[years.length - 1]}-12-31`;
  const t = (s) => { const [y, m, d] = s.split('-').map(Number); return Date.UTC(y, m - 1, d); };
  const days_left = Math.round((t(until) - t(todayStr(now))) / 86400000);
  const status = days_left < 0 ? 'Lejárt' : days_left <= SOON_DAYS ? 'Hamarosan lejár' : 'Érvényes';
  const last_payment = rows.map(r => r.d).filter(Boolean).sort().pop() || null;
  return { item_id: item.id, status, valid_until: until, days_left, last_payment, years };
}
