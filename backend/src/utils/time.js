export const localNow = (d = new Date()) => {
  const p = n => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}T${p(d.getHours())}:${p(d.getMinutes())}`;
};
export const isLocalDateTime = s => /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}/.test(String(s || ''));
