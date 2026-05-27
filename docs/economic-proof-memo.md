# Economic Proof Memo (Internal)

**Status:** Auto-snapshot from `scripts/measure-gmx-costs.mjs` — 2026-05-27

EasyGMX V1 does **not** activate public cost coverage.

## Live API snapshot (Classic prepareOrder)

| Market | Open execution fee (ETH) | Open execution fee (wei) | Sample position fee (USD, $10 size) |
|--------|--------------------------|----------------------------|-------------------------------------|
| ETH/USD | 0.000220 | 220147551811200 | $0.0040 |
| BTC/USD | 0.000220 | 220499647056000 | $0.0040 |

## Derived estimates (ETH/USD, illustrative USD @ ~$3000/ETH)

| # | Metric | Value |
|---|--------|-------|
| 1 | Minimum open execution fee | ~0.000220 ETH |
| 2 | Minimum close execution fee | ~0.000220 ETH (same estimate; close requires open position for prepareOrder) |
| 3 | Average open cost | Measure from wallet receipts after live trades |
| 4 | Average close cost | Measure from wallet receipts after live trades |
| 5 | Refund recipient | Trader `account` on the GMX request (per GMX docs) |
| 6 | Average refund leakage | Requires tx receipt diff (max fee − keeper gas); not measured here |
| 7 | Round-trip cost (est.) | ~0.000440 ETH (~$1.32 illustrative) |
| 8 | Referral income per $1,000 notional (5% tier, illustrative) | ~$0.0000 on eligible open+close position fees |
| 9 | Break-even notional (illustrative) | ~$33.022.133 |
| 10 | Recommendation | **no coverage** — subsidies require live wallet measurement + legal review |

## Notes

- Execution fees are fetched via GMX SDK `prepareOrder` (same path as app `src/lib/gmxExecutionFee.ts`).
- Unused execution fee is refunded by GMX to the trader account; subsidy models must account for refund leakage.
- Position fee tier (0.04% / 0.06%) and referral tiers are GMX-controlled.

## Recommendation

**No public coverage in V1.** Re-run this script after material GMX fee changes; complete live wallet open/close tests per `docs/V1-LIVE-TRADE-TEST.md`.
