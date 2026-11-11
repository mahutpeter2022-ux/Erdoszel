import { randomInt } from 'node:crypto';

export const licensePrice = () => +(process.env.LICENSE_PRICE_HUF || 8000);

const checkDigit = payload => {
  let sum = 0;
  for (let i = payload.length - 1; i >= 0; i--) {
    let n = +payload[i];
    if ((payload.length - 1 - i) % 2 === 0) { n *= 2; if (n > 9) n -= 9; }
    sum += n;
  }
  return (10 - (sum % 10)) % 10;
};
const format = d => `VJ-${d.slice(0, 4)}-${d.slice(4, 8)}-${d.slice(8)}`;