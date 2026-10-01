export const currencyList = [
  "usd", "eur", "gbp", "cad", "aud", "jpy", "chf", "cny", "sek", "nzd",
] as const;
export type CurrencyCode = (typeof currencyList)[number];
