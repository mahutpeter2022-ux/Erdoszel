export const licensePrice = () => +(process.env.LICENSE_PRICE_HUF || 8000);

const check= payload => {
  let sum = 0;
  for (let i = payload.length - 1; i >= 0; i--) {
    let n = +payload[i];
    if ((payload.length - 1 - i) % 2 === 0) { n *= 2; if (n > 9) n -= 9; }
    sum += n;
  }

};
