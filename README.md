# EasyGMX

Simplified perpetual futures trading on GMX V2 (Arbitrum).

Trade in 4 clicks — pick a market, pick a direction, set your amount, and go. No order book complexity, no advanced settings, no hidden fees.

## What It Does

- **4 markets**: ETH/USD, BTC/USD, SOL/USD, ARB/USD perpetuals
- **2 leverage presets**: 5x or 10x
- **USDC collateral only**: no messing with multiple tokens
- **Real positions on GMX V2**: this is not a demo — trades are real leveraged positions
- **Live P&L tracking**: oracle-priced chart + running profit/loss
- **Take Profit / Cut Loss**: one-tap position closing
- **Share your wins**: copy P&L card to clipboard

## Tech Stack

- Next.js 16 (App Router)
- wagmi + viem (Ethereum interaction)
- wagmi native connectors (wallet connection)
- Zustand (state management)
- TradingView Lightweight Charts
- GMX V2 smart contracts (ExchangeRouter, Reader, Oracle)

## V1 verification

See [docs/V1-LIVE-TRADE-TEST.md](docs/V1-LIVE-TRADE-TEST.md) for manual open/close checklist.

```bash
npm run check:gmx-markets
npm run check:gmx-referral
npm run measure:gmx-costs
```

## Quick Start

```bash
# Install
npm install

# (Optional) Set a custom RPC — defaults to public Arbitrum RPC
echo "NEXT_PUBLIC_RPC_URL=https://arb1.arbitrum.io/rpc" > .env.local

# Run
npm run dev
```

Open http://localhost:3000

## What You Need

- A browser wallet (MetaMask, Coinbase, etc.) connected to **Arbitrum**
- **USDC** on Arbitrum: `0xaf88d065e77c8cC2239327C5EDb3A432268e5831`
- A small amount of ETH for gas (Arbitrum fees are pennies)

## How It Works

```
Connect Wallet → Pick Market → Set Trade → Watch Position
```

1. **Connect** — wagmi handles injected, WalletConnect, and Coinbase Wallet
2. **Pick Market** — Live oracle prices from GMX's API, open interest shown
3. **Set Trade** — Up/Down direction, USDC amount, 5x/10x leverage, fee breakdown
4. **Watch Position** — TradingView chart, live P&L, one-tap close

Behind the scenes, opening a position sends a `multicall` to GMX's ExchangeRouter:
- `sendTokens` — transfers USDC collateral to OrderVault
- `sendWnt` — sends ETH for keeper execution fee
- `createOrder` — creates a MarketIncrease order

A GMX keeper picks up the order within 2-10 seconds and executes it on-chain.

## Project Structure

```
src/
├── app/
│   ├── page.tsx              # 4-screen SPA router
│   ├── layout.tsx            # Root layout with Web3Provider
│   └── globals.css           # Dark trading theme
├── components/
│   ├── LandingScreen.tsx     # Connect wallet
│   ├── MarketSelectScreen.tsx # Pick ETH/BTC/SOL/ARB
│   ├── TradeSetupScreen.tsx  # Configure trade
│   ├── OrderPendingScreen.tsx # Keeper wait state
│   ├── PositionLiveScreen.tsx # Live position + chart
│   ├── ErrorBoundary.tsx
│   ├── WalletDisconnectGuard.tsx
│   └── ui/                   # shadcn/ui components
├── hooks/
│   └── useUsdcBalance.ts     # ERC20 balanceOf hook
├── lib/
│   ├── contracts.ts          # GMX V2 addresses, markets, order types
│   ├── order.ts              # Create/close order hooks (wagmi mutations)
│   ├── api.ts                # GMX REST API (prices, rates, fees)
│   ├── store.ts              # Zustand trade state
│   ├── wagmi.ts              # wagmi config for Arbitrum
│   └── abi/                  # ExchangeRouter, Reader, ERC20 ABIs
└── providers/
    └── Web3Provider.tsx       # WagmiProvider + QueryClient
```

## Safety

- **No custodial risk** — the app never holds or controls your funds. Every transaction is signed in your wallet.
- **Input validation** — min $1, max $10,000, balance checks, fee buffer
- **Slippage protection** — 0.5% tolerance built into every order
- **Error boundaries** — React crash recovery on every screen
- **Wallet disconnect guard** — handles unexpected disconnection gracefully
- **No hidden fees** — fee breakdown shown before every trade

## Disclaimer

This software opens real leveraged positions on GMX V2. You can lose your entire collateral. This is not financial advice. Use at your own risk.

## License

MIT
