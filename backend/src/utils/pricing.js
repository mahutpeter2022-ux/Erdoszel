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