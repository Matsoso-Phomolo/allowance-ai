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
// Format Decimal strings without converting stored cents through IEEE-754.
// Historical sub-cent values are shown exactly rather than silently rounded.
export function formatMoney(value = 0, currency = getDisplayCurrency()) {
  const source = String(value);
  const match = /^(-?)(\d+)(?:\.(\d+))?$/.exec(source);
  if (!match) return "—";
  const [, sign, integer, raw = ""] = match;
  const fraction = raw.replace(/0+$/, "").padEnd(2, "0");
  const whole = integer.replace(
    /\B(?=(\d{3})+(?!\d))/g,
    currency === "LSL" ? "," : " ",
  );
  return currency === "LSL"
    ? `M ${sign}${whole}.${fraction}`
    : `${sign}R ${whole},${fraction}`;
}

export function plannedItemTotal(quantity, price) {
  const parse = (value) => {
    const match = /^(\d+)(?:\.(\d+))?$/.exec(String(value));
    if (!match) return null;
    return {
      coefficient: BigInt(match[1] + (match[2] || "")),
      scale: (match[2] || "").length,
    };
  };
  const q = parse(quantity),
    p = parse(price);
  if (!q || !p) return "0.00";
  let product = q.coefficient * p.coefficient;
  const scale = q.scale + p.scale;
  if (scale > 2) {
    const divisor = 10n ** BigInt(scale - 2);
    product =
      product / divisor + ((product % divisor) * 2n >= divisor ? 1n : 0n);
  } else product *= 10n ** BigInt(2 - scale);
  return `${product / 100n}.${String(product % 100n).padStart(2, "0")}`;
}
