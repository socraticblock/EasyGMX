// GMX V2 on Arbitrum — contract addresses, token addresses, market definitions
// Source: gmx-io/gmx-synthetics docs/contracts.json + on-chain verification

export const ARBITRUM_CHAIN_ID = 42161

// ─── Core contracts ────────────────────────────────────────

export const CONTRACTS = {
  dataStore: "0xFD70de6b91282D8017aA4E741e9Ae325CAb992d8",
  roleStore: "0x3c3d99FD298f679DBC2CEcd132b4eC4d0F5e6e72",
  reader: "0x470fbC46bcC0f16532691Df360A07d8Bf5ee0789",
  exchangeRouter: "0x1C3fa76e6E1088bCE750f23a5BFcffa1efEF6A41",
  router: "0x7452c558d45f8afC8c83dAe62C3f8A5BE19c71f6",
  orderVault: "0x31eF83a530Fde1B38EE9A18093A333D8Bbbc40D5",
  orderHandler: "0x63492B775e30a9E6b4b4761c12605EB9d071d5e9",
  oracle: "0x7F01614cA5198Ec979B1aAd1DAF0DE7e0a215BDF",
  eventEmitter: "0xC8ee91A54287DB53897056e12D9819156D3822Fb",
  subaccountGelatoRelayRouter: "0x517602BaC704B72993997820981603f5E4901273",
  gelatoRelayRouter: "0xa9090E2fd6cD8Ee397cF3106189A7E1CFAE6C59C",
} as const

// ─── Tokens ────────────────────────────────────────────────

export const TOKENS = {
  USDC: "0xaf88d065e77c8cC2239327C5EDb3A432268e5831" as const,  // 6 decimals
  WETH: "0x82aF49447D8a07e3bd95BD0d56f35241523fBab1" as const,  // 18 decimals
  USDCe: "0xFF970A616C4449D6FaBA68550c9ef83fC09911b2" as const,  // 6 decimals (legacy)
  ARB: "0x912CE59144191C1204E64559FE8253a0e49E6548" as const,    // 18 decimals
  WBTC: "0x2f2a2543B76A4166549F7aaB2e75Bef0aefC5B0f" as const,   // 8 decimals
} as const

export const TOKEN_DECIMALS: Record<string, number> = {
  [TOKENS.USDC]: 6,
  [TOKENS.WETH]: 18,
  [TOKENS.USDCe]: 6,
  [TOKENS.ARB]: 18,
  [TOKENS.WBTC]: 8,
}

// ─── Markets ───────────────────────────────────────────────
// These are market token addresses, used as the `market` param in CreateOrderParams

export const MARKETS = {
  "ETH/USD": "0x70d95587d40A2caf56bd97485aB3Eec10Bee6336",
  "BTC/USD": "0x47c031236e19d024b42f8AE6780E44A573170703",
  "SOL/USD": "0x09400D9DB990D5ed3f35D7be61DfAEB900Af03C9",
  "ARB/USD": "0xC25cEf6061Cf5dE5eb761b50E4743c1F5D7E5407",
} as const

// ─── API ───────────────────────────────────────────────────

export const RPC_URL = process.env.NEXT_PUBLIC_RPC_URL ?? "https://arb1.arbitrum.io/rpc"
export const API_BASE = "https://arbitrum-api.gmxinfra.io"
export const API_V2_BASE = "https://arbitrum.gmxapi.io/v1"
export const ARBISCAN_URL = "https://arbiscan.io"

// ─── Order types ───────────────────────────────────────────

export const ORDER_TYPE = {
  MarketSwap: 0,
  LimitSwap: 1,
  MarketIncrease: 2,
  LimitIncrease: 3,
  MarketDecrease: 4,
  LimitDecrease: 5,
  StopLossDecrease: 6,
  Liquidation: 7,
  StopIncrease: 8,
} as const

export const DECREASE_POSITION_SWAP_TYPE = {
  NoSwap: 0,
  SwapPnlTokenToCollateralToken: 1,
  SwapCollateralTokenToPnlToken: 2,
} as const

// ─── Precision ─────────────────────────────────────────────
// GMX V2 uses 30 decimals for all USD-denominated values

export const USD_DECIMALS = 30n

export function toUsd(amount: number): bigint {
  return BigInt(Math.round(amount * 1e6)) * (USD_DECIMALS / 1_000_000n)
}

export function toTokenRaw(amount: number, decimals: number): bigint {
  const factor = Math.pow(10, decimals)
  return BigInt(Math.round(amount * factor))
}

export function fromUsd(raw: bigint): number {
  return Number(raw / (USD_DECIMALS / 1_000_000n)) / 1e6
}

export function fromTokenRaw(raw: bigint, decimals: number): number {
  const factor = Math.pow(10, decimals)
  return Number(raw) / factor
}

// ─── Market metadata ───────────────────────────────────────

export type MarketKey = keyof typeof MARKETS

export interface MarketInfo {
  key: MarketKey
  address: string
  symbol: string
  apiSymbol: string
  icon: string
  collateralToken: string
  collateralDecimals: number
}

export const MARKET_LIST: MarketInfo[] = [
  { key: "ETH/USD", address: MARKETS["ETH/USD"], symbol: "ETH", apiSymbol: "ETH/USD [WETH-USDC]", icon: "\u27E2", collateralToken: TOKENS.USDC, collateralDecimals: 6 },
  { key: "BTC/USD", address: MARKETS["BTC/USD"], symbol: "BTC", apiSymbol: "BTC/USD [BTC-USDC]", icon: "\u20BF", collateralToken: TOKENS.USDC, collateralDecimals: 6 },
  { key: "SOL/USD", address: MARKETS["SOL/USD"], symbol: "SOL", apiSymbol: "SOL/USD [SOL-USDC]", icon: "\u25CE", collateralToken: TOKENS.USDC, collateralDecimals: 6 },
  { key: "ARB/USD", address: MARKETS["ARB/USD"], symbol: "ARB", apiSymbol: "ARB/USD [ARB-USDC]", icon: "\u25C6", collateralToken: TOKENS.USDC, collateralDecimals: 6 },
]

export const MIN_RISK_USD = 10
export const MAX_RISK_USD = 1_000
export const DEFAULT_RISK_USD = 10
export const DEFAULT_LEVERAGE = 5 as const
export const MAX_UINT256 = (1n << 256n) - 1n

// ─── Slippage ──────────────────────────────────────────────

export const SLIPPAGE_BPS = 50 // 0.5%

export function applySlippage(price: number, isLong: boolean): bigint {
  // For longs: acceptable price can be higher (you pay more)
  // For shorts: acceptable price can be lower (you receive less)
  const slippageMultiplier = isLong ? (1 + SLIPPAGE_BPS / 10000) : (1 - SLIPPAGE_BPS / 10000)
  return toUsd(price * slippageMultiplier)
}

// ─── Execution fee ─────────────────────────────────────────
// Approximate keeper fee on Arbitrum (check GMX API for current value)

export const DEFAULT_EXECUTION_FEE_ETH = 0.0001 // ~0.0001 ETH

export const ZERO_BYTES32 = "0x0000000000000000000000000000000000000000000000000000000000000000" as const

export function getGmxReferralCodeBytes32(): `0x${string}` {
  const code = process.env.NEXT_PUBLIC_GMX_REFERRAL_CODE?.trim()
  if (!code) return ZERO_BYTES32

  if (/^0x[0-9a-fA-F]{64}$/.test(code)) {
    return code as `0x${string}`
  }

  const bytes = new TextEncoder().encode(code)
  if (bytes.length > 32) return ZERO_BYTES32
  const hex = Array.from(bytes, (b) => b.toString(16).padStart(2, "0")).join("").padEnd(64, "0")
  return `0x${hex}`
}
