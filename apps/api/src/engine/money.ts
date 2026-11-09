// All money is integer US cents. SAR isn't a PayPal currency, so it is only ever a label.
export const SAR_PER_USD = 3.75;

export function assertCents(cents: number): void {
  if (!Number.isInteger(cents) || cents <= 0) {
    throw new Error(`Amount must be a positive whole number of cents, got ${cents}`);
  }
}

export function centsToUsdString(cents: number): string {
  if (!Number.isInteger(cents) || cents < 0) {
    throw new Error(`Amount must be a non-negative whole number of cents, got ${cents}`);
  }
  return `${Math.floor(cents / 100)}.${String(cents % 100).padStart(2, "0")}`;
}

export type SpokenCurrency = "USD" | "SAR";

// The model passes amounts exactly as the organizer said them; conversion happens here, never in the model.
export function toUsdCents(amount: number, currency: SpokenCurrency): number {
  const usd = currency === "SAR" ? amount / SAR_PER_USD : amount;
  return Math.round(usd * 100);
}

export function sarLabel(cents: number): string {
  const halalas = Math.round(cents * SAR_PER_USD);
  return `≈ ${centsToUsdString(halalas)} SAR`;
}
