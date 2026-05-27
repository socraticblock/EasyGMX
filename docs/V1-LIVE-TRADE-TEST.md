# V1 Live Trade Test Plan

EasyGMX opens **real** GMX V2 positions on Arbitrum. Automated agents cannot sign with your wallet; use this checklist for manual verification.

## Prerequisites

- Wallet on **Arbitrum** with **USDC** (collateral) and **ETH** (execution/network fees)
- `NEXT_PUBLIC_GMX_REFERRAL_CODE` set in `.env.local` (optional for trading; required for referral proof)
- `npm run dev` → http://localhost:3000

## Code paths verified (static)

| Step | Module | Behavior |
|------|--------|----------|
| Connect | `WalletButton`, `wagmi.ts` | Injected / WalletConnect / Coinbase; switch to Arbitrum |
| Market | `MarketSelectScreen` | ETH primary; secondary under “More markets” |
| Quote | `gmxQuote.ts`, `useGmxExecutionFee` | Risk, liquidation, fee range, dynamic execution ETH |
| Approve | `useUsdcApproval` in `order.ts` | Exact or max USDC allowance |
| Open | `useCreateOrder` | multicall: sendTokens → sendWnt → createOrder (MarketIncrease) |
| Pending | `OrderPendingScreen` | Polls positions; 75s timeout; `useOrderStatus` for keeper |
| Live | `PositionLiveScreen` | Chart, P&amp;L merge, full close |
| Close | `useClosePosition` | MarketDecrease + execution fee from API |
| Errors | `userFacingGmxError` | Wallet reject, allowance, ETH, price messages |

## Manual test checklist

### 1. Connect and network

- [ ] Connect wallet
- [ ] Wrong chain shows “Switch to Arbitrum”
- [ ] USDC balance visible on market screen

### 2. Open ETH position (small size)

- [ ] Select **ETH** (V1 market)
- [ ] Price Up or Price Down, $10 risk, 5x leverage
- [ ] Review shows liquidation, fee range, **~dynamic ETH** execution estimate
- [ ] Acknowledge risk modal (first time)
- [ ] Approve USDC if prompted
- [ ] Sign open tx in wallet
- [ ] Pending screen → live position within ~75s
- [ ] Arbiscan link on pending screen resolves

### 3. Close full position

- [ ] Take Profit / Cut Loss
- [ ] Sign close tx
- [ ] Position clears; closed summary screen

### 4. Referral (optional)

- [ ] `/referral` shows configured code and registration
- [ ] Debug strip shows attribution when connected
- [ ] `npm run check:gmx-referral -- 0xYourWallet` matches UI state

### 5. Secondary market (beta)

- [ ] Expand “More markets”, open small **BTC** or **SOL** trade only if willing to test non-primary path

## Failure scenarios

- [ ] Reject wallet signature → friendly cancel message
- [ ] Insufficient ETH → execution cost error before trade
- [ ] Keeper delay &gt; 75s → timeout message; check GMX / Arbiscan

## CLI helpers

```bash
npm run check:gmx-markets
npm run check:gmx-referral
npm run check:gmx-referral -- 0xYourWalletAddress
npm run measure:gmx-costs
```

## Sign-off

V1 trading UX is **live-verified** when ETH open + full close complete once on mainnet with no stuck pending state.
