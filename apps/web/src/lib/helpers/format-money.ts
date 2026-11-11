// SAR is a display label only; every amount is stored and paid in US cents.
export const SAR_PER_USD = 3.75;

const usd = new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" });
const usdWhole = new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 0 });
const whole = new Intl.NumberFormat("en-US", { maximumFractionDigits: 0 });

export function formatUsd(cents: number, options: { whole?: boolean } = {}): string {
  const dollars = cents / 100;
  return options.whole && Number.isInteger(dollars) ? usdWhole.format(dollars) : usd.format(dollars);
}

// Wrapped in a left-to-right isolate so Arabic pages don't reorder it into "SAR 0 ≈".
export function formatSar(cents: number): string {
  return `\u2066≈ ${whole.format(Math.round((cents * SAR_PER_USD) / 100))} SAR\u2069`;
}
