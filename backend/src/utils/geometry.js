export const MAP_W = 1000, MAP_H = 700;

export function polygonArea(p) {
  let s = 0;
  for (let i = 0; i < p.length; i++) { const [x1, y1] = p[i], [x2, y2] = p[(i + 1) % p.length]; s += x1 * y2 - x2 * y1; }
  return Math.abs(s) / 2;
}


export function cleanPolygon(p) {
  if (!Array.isArray(p) || p.length < 3 || p.length > 80) return null;
  const out = [];
  for (const pt of p) {
    if (!Array.isArray(pt) || pt.length !== 2) return null;
    const x = Number(pt[0]), y = Number(pt[1]);
    if (!Number.isFinite(x) || !Number.isFinite(y)) return null;
    out.push([Math.round(Math.max(0, Math.min(MAP_W, x))), Math.round(Math.max(0, Math.min(MAP_H, y)))]);
  }
  return polygonArea(out) >= 400 ? out : null;
}

export const cleanColor = c => (/^#[0-9a-fA-F]{6}$/.test(String(c || '')) ? String(c) : null);