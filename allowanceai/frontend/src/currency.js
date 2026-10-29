let activeCurrency;
export const CURRENCY_KEY = "allowanceai_display_currency";
export function getDisplayCurrency() {
  if (activeCurrency) return activeCurrency;
  try {
    return localStorage.getItem(CURRENCY_KEY) === "LSL" ? "LSL" : "ZAR";
  } catch {
    return "ZAR";
  }
}
export function saveDisplayCurrency(currency) {
  if (!["LSL", "ZAR"].includes(currency)) return;
  activeCurrency = currency;
  try {
    localStorage.setItem(CURRENCY_KEY, currency);
  } catch {
    /* Storage may be disabled. */
  }
}
export function formatMoney(value = 0, currency = getDisplayCurrency()) {
  const amount = Number(value);
  if (!Number.isFinite(amount)) return "—";
  if (currency === "LSL")
    return (
      "M " +
      new Intl.NumberFormat("en-GB", {
        minimumFractionDigits: 2,
        maximumFractionDigits: 2,
      }).format(amount)
    );
  return new Intl.NumberFormat("en-ZA", {
    style: "currency",
    currency: "ZAR",
  }).format(amount);
}
