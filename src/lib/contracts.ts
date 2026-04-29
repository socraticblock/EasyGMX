export const ARBITRUM_CHAIN_ID = 42161

export const CONTRACTS = {
  dataStore: "0xFD70de6b91282D8017aA4E741e9Ae325CAb992d8",
  roleStore: "0x3c3d99FD298f679DBC2CEcd132b4eC4d0F5e6e72",
  reader: "0x470fbC46bcC0f16532691Df360A07d8Bf5ee0789",
  exchangeRouter: "0x1C3fa76e6E1088bCE750f23a5BFcffa1efEF6A41",
  orderVault: "0x31eF83a530Fde1B38EE9A18093A333D8Bbbc40D5",
  orderHandler: "0x63492B775e30a9E6b4b4761c12605EB9d071d5e9",
  oracle: "0x7F01614cA5198Ec979B1aAd1DAF0DE7e0a215BDF",
  subaccountGelatoRelayRouter: "0x517602BaC704B72993997820981603f5E4901273",
  gelatoRelayRouter: "0xa9090E2fd6cD8Ee397cF3106189A7E1CFAE6C59C",
} as const

export const TOKENS = {
  USDC: "0xaf88d065e77c8cC2239327C5EDb3A432268e5831",
  WETH: "0x82aF49447D8a07e3bd95BD0d56f35241523fBab1",
  USDCe: "0xFF970A616C4449D6FaBA68550c9ef83fC09911b2",
} as const

export const MARKETS = {
  "ETH/USD": "0x70d95539653b3d7285587a6B7aE5565DA9cF4c1D",
  "BTC/USD": "0x4793697C2462A1E4b0b1985D6F7a5030B6600E3c",
  "SOL/USD": "0x3193c45D49C07DB9bE9Fb13e6e7e7e5A0b4a1c51",
  "ARB/USD": "0x6C2eaE855e778E7E0b0F4b7e0E6E6E6E6E6E6E6E",
} as const

export const RPC_URL = "https://arb1.arbitrum.io/rpc"
export const API_BASE = "https://arbitrum-api.gmxinfra.io"
export const API_V2_BASE = "https://arbitrum.gmxapi.io/v1"

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

export type MarketKey = keyof typeof MARKETS

export interface MarketInfo {
  key: MarketKey
  address: string
  symbol: string
  icon: string
  decimals: number
}

export const MARKET_LIST: MarketInfo[] = [
  { key: "ETH/USD", address: MARKETS["ETH/USD"], symbol: "ETH", icon: "⟠", decimals: 18 },
  { key: "BTC/USD", address: MARKETS["BTC/USD"], symbol: "BTC", icon: "₿", decimals: 8 },
  { key: "SOL/USD", address: MARKETS["SOL/USD"], symbol: "SOL", icon: "◎", decimals: 9 },
  { key: "ARB/USD", address: MARKETS["ARB/USD"], symbol: "ARB", icon: "◆", decimals: 18 },
]
