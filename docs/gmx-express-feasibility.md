# GMX Express Feasibility Memo

**Status:** Research spike (V1)  
**Recommendation:** **Use Classic for V1 shipping; pursue Express as Phase 2 integration** after Classic open/close is reliable and referral attribution is verified.

## Summary

GMX Express (and Express + One-Click) uses GMX/Gelato relay infrastructure so users can sign orders off-chain and pay network costs in USDC or WETH on Arbitrum, reducing wallet popups versus Classic. EasyGMX already lists Gelato/subaccount router addresses in `src/lib/contracts.ts` and depends on `@gmx-io/sdk`, which is the likely integration path for Express APIs.

EasyGMX should **not** build custom relay sponsorship in V1. Express may reduce future need for EasyGMX-paid network costs, but it does not remove trading, liquidation, or collateral risk.

## Research answers

| # | Question | Finding |
|---|----------|---------|
| 1 | Can EasyGMX integrate Express via GMX SDK/API? | **Likely yes** — `@gmx-io/sdk` is already in the repo (`src/lib/gmxSdk.ts`). Express flows are documented in GMX V2 docs; SDK v2 should expose relay/subaccount helpers. Needs a spike branch with test wallet on Arbitrum. |
| 2 | Keep simplified UI while using Express underneath? | **Yes** — UI can remain Price Up/Down + risk presets; submission layer swaps from `ExchangeRouter` multicall (Classic) to Express signed payloads + relay status polling. |
| 3 | Pay gas in USDC or WETH on Arbitrum? | **Yes per GMX docs** for Express; exact token list should be confirmed against current GMX UI settings for Arbitrum. |
| 4 | Does Express preserve referral attribution? | **Must verify on-chain** — orders should still accept `referralCode` bytes32; first trade may set attribution. Use `src/lib/gmxReferral.ts` + `useGmxReferralStatus` before enabling Express in production. |
| 5 | Order submission method? | Express: off-chain sign → relay submit → keeper execution. Classic (current): wallet sends `createOrder` via `src/lib/order.ts`. |
| 6 | Status fields returned? | Expect `requestId`, order key, tx hashes, and execution/keeper states from GMX API/SDK — align with existing `OrderPendingScreen` keeper phase. |
| 7 | Track requestId / orderKey / txHash? | Extend `store.ts` active position + pending screen to persist Express identifiers alongside current `orderKey` / `openTxHash`. |
| 8 | Failed / expired / delayed orders? | Need explicit UI timeouts and retry copy (reuse patterns in `gmxRetry.ts`). Do not auto-resubmit without user confirmation. |
| 9 | New user approvals? | Express may still require USDC allowance and possibly subaccount/relay permissions for One-Click — spike required. |
| 10 | Reduces need for EasyGMX cost coverage? | **Partially** — Express improves gas UX without EasyGMX paying fees. It does **not** remove execution fee economics or refund leakage concerns documented in GMX keeper refunds. |

## Implementation path (if approved post-V1)

1. Add trade mode selector (Classic vs Express) hidden behind feature flag `NEXT_PUBLIC_GMX_EXPRESS_ENABLED`.
2. Implement Express order builder in new module `src/lib/gmxExpressOrder.ts` using `@gmx-io/sdk`.
3. Unify pending/position screens on shared status model.
4. Run referral attribution checks before marking Express as default.

## Risks

- SDK alpha version (`^1.5.0-alpha-13`) may change Express APIs.
- Referral attribution on first Express trade must be validated on-chain.
- One-Click subaccount keys introduce key-management UX and security scope — defer until Classic + Express without One-Click are stable.
- Mixed modes could confuse fee estimates; Express gas-in-USDC should be labeled separately from Classic ETH execution fee.

## Files likely to change

- `src/lib/gmxSdk.ts`, `src/lib/order.ts` (or new `gmxExpressOrder.ts`)
- `src/lib/store.ts`, `src/components/OrderPendingScreen.tsx`, `src/components/TradeSetupScreen.tsx`
- `src/lib/gmxQuote.ts` (fee labels per mode)
- `src/lib/contracts.ts` (relay router usage)

## V1 mode decision

| Mode | V1 |
|------|-----|
| Classic user-paid | **Ship** (current) |
| Express | Research only; feature-flag later |
| Express + One-Click | **Do not ship** in V1 |

## Code spike (feature flag)

- `NEXT_PUBLIC_GMX_EXPRESS_ENABLED=true` enables `researchExpressPrepare()` in `src/lib/gmxExpress.ts` (dry-run `prepareOrder` with `mode: "express"`).
- Production trades remain Classic via `src/lib/order.ts` regardless of the flag.
