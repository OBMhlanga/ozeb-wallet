const EXCHANGE_API_KEY = import.meta.env.VITE_EXCHANGE_API_KEY;
const FALLBACK_RATES = { USD: 1, BWP: 13.81, ZAR: 16.03, BTC: 0.0000146105, ETH: 0.00051151 };

const isPositiveNumber = (n) => typeof n === "number" && Number.isFinite(n) && n > 0;

export async function fetchLiveRates() {
  // If no API key yet, return fixed fallback immediately
  if (!EXCHANGE_API_KEY) {
    console.warn("No VITE_EXCHANGE_API_KEY found — using fixed fallback rates.");
    return { ...FALLBACK_RATES };
  }

  try {
    const [fiatRes, cryptoRes] = await Promise.all([
      fetch(`https://v6.exchangerate-api.com/v6/${EXCHANGE_API_KEY}/latest/USD`),
      fetch(`https://api.coingecko.com/api/v3/simple/price?ids=bitcoin,ethereum&vs_currencies=usd`)
    ]);

    if (!fiatRes.ok) throw new Error(`Fiat API ${fiatRes.status}`);
    if (!cryptoRes.ok) throw new Error(`Crypto API ${cryptoRes.status}`);

    const fiatData = await fiatRes.json();
    const cryptoData = await cryptoRes.json();

    if (fiatData.result !== "success") throw new Error("Fiat API error");

    const bwp = fiatData?.conversion_rates?.BWP;
    const zar = fiatData?.conversion_rates?.ZAR;
    const btcUsd = cryptoData?.bitcoin?.usd;
    const ethUsd = cryptoData?.ethereum?.usd;

    // Each rate must be a positive finite number — otherwise fall back per-currency
    // so a single bad field doesn't poison every conversion in the app.
    const rates = {
      USD: 1,
      BWP: isPositiveNumber(bwp) ? bwp : FALLBACK_RATES.BWP,
      ZAR: isPositiveNumber(zar) ? zar : FALLBACK_RATES.ZAR,
      BTC: isPositiveNumber(btcUsd) ? 1 / btcUsd : FALLBACK_RATES.BTC,
      ETH: isPositiveNumber(ethUsd) ? 1 / ethUsd : FALLBACK_RATES.ETH,
    };
    return rates;
  } catch (err) {
    console.warn("Live rates failed, using fallback:", err.message);
    return { ...FALLBACK_RATES };
  }
}

export async function updateSupabaseRates(supabase, rates) {
  if (!rates || typeof rates !== "object") return;
  try {
    for (const [currency, rate] of Object.entries(rates)) {
      await supabase
        .from("exchange_rates")
        .update({ rate_to_usd: rate, updated_at: new Date().toISOString() })
        .eq("currency_code", currency);
    }
  } catch (err) {
    console.warn("Could not update Supabase rates:", err.message);
  }
}