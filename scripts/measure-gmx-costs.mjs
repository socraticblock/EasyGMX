import { createRequire } from "node:module"
import { writeFileSync } from "node:fs"
import { join } from "node:path"

const require = createRequire(import.meta.url)
const { GmxApiSdk } = require("@gmx-io/sdk/v2")

const MARKETS = [
  { key: "ETH/USD", symbol: "ETH/USD [WETH-USDC]" },
  { key: "BTC/USD", symbol: "BTC/USD [BTC-USDC]" },
]

const PLACEHOLDER = "0x0000000000000000000000000000000000000001"
const SIZE = 10n * 10n ** 30n
const COLLATERAL = 10_000_000n

const sdk = new GmxApiSdk({ chainId: 42161 })

async function measureOpen(symbol) {
  const prepared = await sdk.prepareOrder({
    kind: "increase",
    symbol,
    direction: "long",
    orderType: "market",
    size: SIZE,
    collateralToPay: { amount: COLLATERAL, token: "USDC" },
    mode: "classic",
    from: PLACEHOLDER,
  })
  const feeWei = prepared.estimates?.executionFeeAmount ?? 0n
  const positionFeeUsd30 = prepared.estimates?.positionFeeUsd ?? 0n
  return {
    executionFeeWei: feeWei.toString(),
    executionFeeEth: Number(feeWei) / 1e18,
    positionFeeUsd: Number(positionFeeUsd30) / 1e30,
  }
}

console.log("Measuring GMX Classic execution fees (prepareOrder)…\n")

const rows = {}

for (const m of MARKETS) {
  try {
    rows[m.key] = await measureOpen(m.symbol)
    console.log(`${m.key}: open execution ~${rows[m.key].executionFeeEth.toFixed(6)} ETH`)
  } catch (err) {
    console.error(`${m.key}: failed`, err instanceof Error ? err.message : err)
  }
}

const eth = rows["ETH/USD"]
const ethPrice = 3000
const openEth = eth?.executionFeeEth ?? 0.0001
const closeEth = openEth
const roundTripEth = openEth + closeEth
const positionFeePer1k = eth ? (eth.positionFeeUsd / 10) * 2 : 0
const referralRate = 0.05
const referralPer1k = positionFeePer1k * referralRate
const breakEvenNotional = referralPer1k > 0 ? (roundTripEth * ethPrice) / referralPer1k * 1000 : null

const memo = `# Economic Proof Memo (Internal)

**Status:** Auto-snapshot from \`scripts/measure-gmx-costs.mjs\` — ${new Date().toISOString().slice(0, 10)}

EasyGMX V1 does **not** activate public cost coverage.

## Live API snapshot (Classic prepareOrder)

| Market | Open execution fee (ETH) | Open execution fee (wei) | Sample position fee (USD, $10 size) |
|--------|--------------------------|----------------------------|-------------------------------------|
${MARKETS.map((m) => {
  const r = rows[m.key]
  return r
    ? `| ${m.key} | ${r.executionFeeEth.toFixed(6)} | ${r.executionFeeWei} | $${r.positionFeeUsd.toFixed(4)} |`
    : `| ${m.key} | — | — | — |`
}).join("\n")}

## Derived estimates (ETH/USD, illustrative USD @ ~$${ethPrice}/ETH)

| # | Metric | Value |
|---|--------|-------|
| 1 | Minimum open execution fee | ~${openEth.toFixed(6)} ETH |
| 2 | Minimum close execution fee | ~${closeEth.toFixed(6)} ETH (same estimate; close requires open position for prepareOrder) |
| 3 | Average open cost | Measure from wallet receipts after live trades |
| 4 | Average close cost | Measure from wallet receipts after live trades |
| 5 | Refund recipient | Trader \`account\` on the GMX request (per GMX docs) |
| 6 | Average refund leakage | Requires tx receipt diff (max fee − keeper gas); not measured here |
| 7 | Round-trip cost (est.) | ~${roundTripEth.toFixed(6)} ETH (~$${(roundTripEth * ethPrice).toFixed(2)} illustrative) |
| 8 | Referral income per $1,000 notional (5% tier, illustrative) | ~$${referralPer1k.toFixed(4)} on eligible open+close position fees |
| 9 | Break-even notional (illustrative) | ${breakEvenNotional ? `~$${Math.round(breakEvenNotional).toLocaleString()}` : "n/a"} |
| 10 | Recommendation | **no coverage** — subsidies require live wallet measurement + legal review |

## Notes

- Execution fees are fetched via GMX SDK \`prepareOrder\` (same path as app \`src/lib/gmxExecutionFee.ts\`).
- Unused execution fee is refunded by GMX to the trader account; subsidy models must account for refund leakage.
- Position fee tier (0.04% / 0.06%) and referral tiers are GMX-controlled.

## Recommendation

**No public coverage in V1.** Re-run this script after material GMX fee changes; complete live wallet open/close tests per \`docs/V1-LIVE-TRADE-TEST.md\`.
`

const outPath = join(process.cwd(), "docs", "economic-proof-memo.md")
writeFileSync(outPath, memo, "utf8")
console.log(`\nWrote ${outPath}`)
