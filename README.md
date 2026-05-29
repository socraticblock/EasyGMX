# EasyGMX

Real GMX V2 perpetual futures on Arbitrum — simplified for beginners.

Choose a direction, set your USDC risk, review the order, and sign with your wallet. No order book complexity, no extra EasyGMX trading fee.

## What It Does

- **V1 focus**: ETH/USD primary path; BTC, SOL, ARB secondary
- **Arbitrum only**, **USDC collateral only**
- **2 leverage presets**: 5x or 10x
- **Real positions on GMX V2** — not a demo
- **Live P&L tracking** with oracle-priced chart
- **Full position close** with review step before signing
- **Pending recovery** if GMX takes longer than expected

## Tech Stack

- Next.js 16 (App Router)
- wagmi + viem (Ethereum interaction)
- Zustand (state management)
- TradingView Lightweight Charts
- `@gmx-io/sdk` + GMX V2 smart contracts

## V1 verification

- Manual checklist: [docs/V1-LIVE-TRADE-TEST.md](docs/V1-LIVE-TRADE-TEST.md)
- Known limitations: [docs/V1-KNOWN-LIMITATIONS.md](docs/V1-KNOWN-LIMITATIONS.md)

```bash
npm run check:gmx-markets
npm run check:gmx-referral
npm run measure:gmx-costs
```

## Quick Start

```bash
npm install

# Optional: custom Arbitrum RPC
echo "NEXT_PUBLIC_RPC_URL=https://arb1.arbitrum.io/rpc" > .env.local

npm run dev
```

Open http://localhost:3000

Production (after `npm run build`):

```bash
npm run start
```

## Environment variables

Set in `.env.local` for development and in **Vercel → Project → Settings → Environment Variables** for production.

| Variable | Required | Purpose |
|----------|----------|---------|
| `NEXT_PUBLIC_GMX_REFERRAL_CODE` | Recommended | GMX referral code (case-sensitive, max 20 chars). Verify with `npm run check:gmx-referral`. |
| `NEXT_PUBLIC_WC_PROJECT_ID` | Optional | WalletConnect project ID for mobile wallets |
| `NEXT_PUBLIC_RPC_URL` | Optional | Arbitrum RPC (defaults to public Arbitrum RPC) |
| `NEXT_PUBLIC_GMX_EXPRESS_ENABLED` | Optional | `true` enables Express dry-run research only; trades stay Classic |
| `NEXT_PUBLIC_SHOW_DEBUG_STRIP` | Optional | `true` shows referral debug strip in trading screens (dev only) |

V1 does **not** use sponsor wallets, cost coverage, or free-trade infrastructure.

## What You Need

- A browser wallet (MetaMask, Coinbase, etc.) connected to **Arbitrum**
- **USDC** on Arbitrum: `0xaf88d065e77c8cC2239327C5EDb3A432268e5831`
- A small amount of ETH for gas

## How It Works

```
Connect Wallet → Set up trade → Review & sign → Watch position
```

1. **Connect** — wagmi handles injected, WalletConnect, and Coinbase Wallet
2. **Set up trade** — Price Up/Down, USDC risk ($10–$1,000), 5x/10x leverage, fee breakdown
3. **Review & sign** — USDC approval (if needed) is separate from opening the trade
4. **Watch position** — chart, live P&L, close full position with review

Behind the scenes, opening a position sends a `multicall` to GMX's ExchangeRouter:
- `sendTokens` — USDC collateral to OrderVault
- `sendWnt` — ETH for keeper execution fee
- `createOrder` — MarketIncrease order

A GMX keeper typically executes within a few seconds.

## Project Structure

```
src/
├── app/
│   ├── page.tsx              # SPA router
│   ├── layout.tsx            # Root layout with Web3Provider
│   └── globals.css           # Dark trading theme
├── components/
│   ├── HomeScreen.tsx        # Trading lobby
│   ├── MarketSelectScreen.tsx
│   ├── TradeSetupScreen.tsx
│   ├── OrderPendingScreen.tsx
│   ├── PositionLiveScreen.tsx
│   └── TradeClosedScreen.tsx
├── lib/
│   ├── contracts.ts          # GMX V2 addresses, markets
│   ├── order.ts              # Create/close order hooks
│   ├── gmxMarketData.ts      # GMX SDK market data
│   ├── gmxQuote.ts           # Trade quotes & validation
│   └── store.ts              # Zustand trade state
└── providers/
    └── Web3Provider.tsx
```

## Safety

- **No custodial risk** — every transaction is signed in your wallet
- **Input validation** — min $10, max $1,000 USDC risk, balance checks
- **Slippage protection** — 0.5% tolerance on orders
- **Pending recovery** — submitted trades stay visible if GMX is slow
- **No extra EasyGMX trading fee** — GMX and network costs only

## Disclaimer

This software opens real leveraged positions on GMX V2. You can lose your entire collateral. This is not financial advice. Use at your own risk.

## License

MIT
