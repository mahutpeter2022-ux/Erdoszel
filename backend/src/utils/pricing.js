export const eurHuf = () => +(process.env.EUR_HUF || 366);

const num = s => parseFloat(String(s).replace(',', '.'));
const round6 = n => Math.round(n * 1e6) / 1e6;
const huf = n => Math.round(n).toLocaleString('hu-HU') + ' Ft';
const fmt = (n, d = 3) => Number(n).toLocaleString('hu-HU', { maximumFractionDigits: d });


const GROUPS = [
  { category: 'Gímszarvas bika',    test: /^Agancs/,           group: 'Gímszarvas bika', measure: 'kg', mult: 100 },
  { category: 'Dámszarvas',         test: /^Bika – agancs/,    group: 'Dámszarvas bika', measure: 'kg', mult: 100 },
  { category: 'Őz',                 test: /^Bak –/,            group: 'Őz bak',          measure: 'g',  mult: 1 },
  { category: 'Muflon',             test: /^Kos –/,            group: 'Muflon kos',      measure: 'cm', mult: 1 },
  { category: 'Vaddisznó (egyéni)', test: /^Kan – agyar/,      group: 'Vaddisznó kan',   measure: 'cm', mult: 10 }, 
];
const LIMITS = { kg: 30, g: 2000, cm: 100 };


export function trophyMeta(category, name) {
  const g = GROUPS.find(x => x.category === category && x.test.test(name));
  if (!g) return null;
  let m, min, max = null;
  if ((m = name.match(/(\d+(?:,\d+)?)\s*[–-]\s*(\d+(?:,\d+)?)/))) { min = num(m[1]); max = num(m[2]); }
  else if ((m = name.match(/(\d+(?:,\d+)?)\s*(?:kg|g|cm)?\s*(?:-ig|alatt)/))) { min = 0; max = num(m[1]); }
  else if ((m = name.match(/(\d+(?:,\d+)?)\s*(?:kg|g|cm)?\s*-t[óő]l/))) { min = num(m[1]); }
  else return null;
  return { trophy_group: g.group, measure: g.measure, unit_mult: g.mult, range_min: min, range_max: max };
}

const baseHuf = (p, eur) => p.price_huf_fixed ?? Math.round((p.price_eur || 0) * eur);

function trophyLine(db, it, eur) {
  const group = String(it.group || '');
  const rows = db.prepare('SELECT * FROM price_list WHERE trophy_group=? ORDER BY range_min').all(group);
  if (!rows.length) return { error: 'Ismeretlen trófea-kategória.' };
  const measure = rows[0].measure;
  let value = Number(String(it.value ?? '').replace(',', '.'));
  if (!Number.isFinite(value) || value <= 0 || value > LIMITS[measure])
    return { error: `Adj meg érvényes értéket (${measure}): ${group}.` };
  if (measure === 'g') value = Math.floor(value + 1e-9);         


  let row = rows[0];
  for (const r of rows) if (r.range_min <= value + 1e-9) row = r;

  const base = baseHuf(row, eur);
  const extraHuf = (row.extra_eur || 0) * eur;
  const units = extraHuf > 0 ? Math.floor(round6((value - row.range_min) * row.unit_mult)) : 0;
  let total = base + units * extraHuf;
  const wounded = !!it.wounded && group === 'Gímszarvas bika';
  if (wounded) total *= 0.5;                                     

  const parts = [`Sáv: ${row.name}`, `alapdíj ${huf(base)}`];
  if (units) parts.push(`felár ${/^\d/.test(row.unit) ? `${units} × ${row.unit}` : `${units} ${row.unit}`} (${fmt(extraHuf, 1)} Ft / ${row.unit})`);
  if (wounded) parts.push('sebzés: 50%');
  return {
    kind: 'trophy', id: row.id, group, value, units, wounded,
    label: `${group} – ${fmt(value)} ${measure}${wounded ? ' (sebzés)' : ''}`,
    total: Math.round(total), detail: parts.join(' · '),
  };
}

function kgLine(db, it, eur) {
  const p = db.prepare('SELECT * FROM price_list WHERE id=?').get(+it.id);
  if (!p || p.unit !== 'kg') return { error: 'Ismeretlen kilós tétel.' };
  const kg = Math.round(Number(String(it.kg ?? '').replace(',', '.')) * 1000) / 1000;
  if (!Number.isFinite(kg) || kg <= 0) return { error: `Add meg a mennyiséget kilogrammban: ${p.name}` };
  if (kg > 1000) return { error: 'Túl nagy mennyiség.' };
  const perKg = (p.extra_eur || 0) * eur;
  const total = Math.round(baseHuf(p, eur) + kg * perKg);
  return {
    kind: 'kg', id: p.id, kg, label: `${p.name}: ${fmt(kg)} kg`, total,
    detail: `${fmt(kg)} kg × ${fmt(perKg, 1)} Ft / kg`,
  };
}


const TROPHY_UI = {
  'Gímszarvas bika': { what: 'Agancs súlya', measure: 'kg', step: 0.01, max: 20 },
  'Dámszarvas bika': { what: 'Agancs súlya', measure: 'kg', step: 0.01, max: 9 },
  'Őz bak':          { what: 'Agancs súlya', measure: 'g',  step: 1, max: 700 },
  'Muflon kos':      { what: 'Szarvhossz (csiga)', measure: 'cm', step: 0.1, max: 100 },
  'Vaddisznó kan':   { what: 'Agyarhossz', measure: 'cm', step: 0.1, max: 35 },
};
const trophyPlan = group => ({ type: 'trophy', group, ...TROPHY_UI[group], canWound: group === 'Gímszarvas bika' || group === 'Vaddisznó kan' });
const fixedPlan = (category, name) => ({ type: 'fixed', category, name, woundName: name.includes('– elejtés') ? name.replace('– elejtés', '– sebzés') : null });
const lc = s => String(s || '').toLowerCase();


export function feePlan(k) {
  const sp = lc(k.species_name), male = k.gender === 'Hím', young = k.age_group === 'Fiatal', w = +k.weight || 0;
  if (sp.includes('gímszarvas')) {
    if (male) return young ? fixedPlan('Gímszarvas bika', 'Csapos bika') : trophyPlan('Gímszarvas bika');
    return young ? fixedPlan('Gímszarvas tehén, ünő, borjú', 'Borjú – elejtés') : fixedPlan('Gímszarvas tehén, ünő, borjú', 'Tehén vagy ünő – elejtés');
  }
  if (sp.includes('dámszarvas')) {
    if (male && !young) return trophyPlan('Dámszarvas bika');
    return young ? fixedPlan('Dámszarvas', 'Borjú – elejtés') : fixedPlan('Dámszarvas', 'Tehén vagy ünő – elejtés');
  }
  if (sp.startsWith('őz')) return male && !young ? trophyPlan('Őz bak') : fixedPlan('Őz', 'Suta vagy gida – elejtés');
  if (sp.includes('muflon')) return male && !young ? trophyPlan('Muflon kos') : fixedPlan('Muflon', 'Jerke vagy bárány – elejtés');
  if (sp.includes('vaddisznó')) {
    if (w > 0 && w <= 20) return fixedPlan('Vaddisznó (egyéni)', 'Malac (20 kg-ig) – elejtés');
    if (w > 0 && w <= 50) return fixedPlan('Vaddisznó (egyéni)', 'Süldő (20–50 kg) – elejtés');
    return male ? trophyPlan('Vaddisznó kan') : fixedPlan('Vaddisznó (egyéni)', 'Koca – elejtés');
  }
  return { type: 'none' };
}

const priceRow = (db, category, name) => db.prepare('SELECT * FROM price_list WHERE category=? AND name=?').get(category, name);


export function killFee(db, k, plan = feePlan(k), eur = eurHuf()) {
  const wounded = !!k.wounded;
  if (plan.type === 'none') return { error: `Ehhez a vadhoz (${k.species_name}) nincs díjtétel.` };
  if (plan.type === 'fixed') {
    let row = priceRow(db, plan.category, plan.name);
    if (wounded) { if (!plan.woundName) return { error: 'Sebzés ennél a vadnál nem számolható.' }; row = priceRow(db, plan.category, plan.woundName); }
    if (!row) return { error: 'Nincs megfelelő díjtétel az árlistában.' };
    return { total: baseHuf(row, eur), label: row.name, detail: row.name };
  }
  if (wounded && !plan.canWound) return { error: 'Sebzés ennél a vadnál nem számolható.' };
  if (wounded && plan.group === 'Vaddisznó kan') {         
    const row = priceRow(db, 'Vaddisznó (egyéni)', 'Kan – sebzés (agyarmérettől függetlenül)');
    if (!row) return { error: 'Nincs megfelelő díjtétel az árlistában.' };
    return { total: baseHuf(row, eur), label: 'Vaddisznó kan – sebzés', detail: row.name };
  }
  if (k.trophy_value == null) return { pending: true };
  if (plan.max && k.trophy_value > plan.max) return { error: `A megadott érték irreálisan nagy (legfeljebb ${plan.max} ${plan.measure}) – ellenőrizd a mérést.` };
  const t = trophyLine(db, { group: plan.group, value: k.trophy_value, wounded }, eur);
  if (t.error) return { error: t.error };
  return { total: t.total, label: t.label, detail: t.detail };
}

function killLine(db, it, eur, user) {
  const k = db.prepare('SELECT g.*,s.name AS species_name FROM game_records g JOIN species s ON s.id=g.species_id WHERE g.id=?').get(+it.kill_id);
  if (!k) return { error: 'Ismeretlen elejtés.' };
  if (!user || (k.hunter_id !== user.id && !['admin', 'vador'].includes(user.role))) return { error: 'Csak a saját elejtésed díját fizetheted.' };
  if (k.status !== 'Elfogadva') return { error: 'Csak elfogadott (elbírált) elejtés díja fizethető.' };
  const f = killFee(db, k, feePlan(k), eur);
  if (f.pending) return { error: 'A trófea bírálata még nem történt meg – a vadőr adja meg a mért értéket.' };
  if (f.error) return { error: f.error };
  return { kind: 'kill', id: k.id, kill_id: k.id, label: `${k.species_name} – ${k.date} (${f.label})`, total: f.total, detail: f.detail };
}

function itemLine(db, it, eur) {
  const p = db.prepare('SELECT * FROM price_list WHERE id=?').get(+it.id);
  if (!p) return { error: 'Ismeretlen tétel.' };
  if (p.trophy_group) return { error: `„${p.name}” tételhez használd a trófea-kalkulátort.` };
  const base = baseHuf(p, eur), extra = (p.extra_eur || 0) * eur;
  if (!base && !extra) return { error: `Egyedi elbírálású tétel, online nem fizethető: ${p.name}` };
  const qty = Math.max(1, Math.min(20, Math.floor(+it.qty) || 1));
  const units = Math.max(0, Math.min(100000, +it.units || 0));
  if (!base && !units) return { error: `Add meg a mennyiséget: ${p.name}` };
  const total = Math.round(qty * base + units * extra);
  const label = qty > 1 ? `${p.name} × ${qty}` : p.name;
  return { kind: 'item', id: p.id, qty, units, label, total, detail: units ? `${fmt(units)} ${p.unit} × ${fmt(extra, 1)} Ft` : '' };
}


export function resolveItems(db, items, eur = eurHuf(), user = null) {
  if (!Array.isArray(items) || !items.length) return { error: 'A kosár üres.' };
  if (items.length > 30) return { error: 'Túl sok tétel a kosárban.' };
  const lines = []; let total = 0;
  for (const it of items) {
    const kind = it?.kind || 'item';
    const line = kind === 'kill' ? killLine(db, it, eur, user) : kind === 'trophy' ? trophyLine(db, it, eur) : kind === 'kg' ? kgLine(db, it, eur) : itemLine(db, it, eur);
    if (line.error) return { error: line.error };
    line.name = line.label;                                       
    total += line.total; lines.push(line);
  }
  return { lines, total };
}


export function checkKill(db, killId, user) {
  const k = db.prepare('SELECT id,hunter_id FROM game_records WHERE id=?').get(+killId);
  if (!k) return { error: 'Ismeretlen elejtés.' };
  if (k.hunter_id !== user.id && !['admin', 'vador'].includes(user.role)) return { error: 'Csak a saját elejtésedhez kapcsolhatsz díjat.' };
  return { id: k.id };
}