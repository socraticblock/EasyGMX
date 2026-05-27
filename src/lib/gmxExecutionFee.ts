import { getGmxSdk } from "./gmxSdk"
import { DEFAULT_EXECUTION_FEE_ETH, MARKET_LIST, type MarketKey } from "./contracts"

const CACHE_MS = 60_000
const SIZE_DELTA_30 = 10n * 10n ** 30n
const COLLATERAL_USDC_6 = 10_000_000n // $10 USDC
const PLACEHOLDER_ACCOUNT = "0x0000000000000000000000000000000000000001" as const

type FeeCache = { wei: bigint; eth: number; fetchedAt: number; marketKey: MarketKey }

let cache: FeeCache | null = null

function weiToEth(wei: bigint): number {
  return Number(wei) / 1e18
}

function fallbackWei(): bigint {
  return BigInt(Math.round(DEFAULT_EXECUTION_FEE_ETH * 1e18))
}

/**
 * Fetches GMX-recommended execution fee via SDK prepareOrder (Classic market increase).
 * Uses a placeholder account; fee estimate does not depend on wallet balance.
 */
export async function fetchGmxExecutionFeeWei(marketKey: MarketKey = "ETH/USD"): Promise<bigint> {
  const now = Date.now()
  if (cache && cache.marketKey === marketKey && now - cache.fetchedAt < CACHE_MS) {
    return cache.wei
  }

  const market = MARKET_LIST.find((m) => m.key === marketKey)
  if (!market) return fallbackWei()

  try {
    const sdk = getGmxSdk()
    const prepared = await sdk.prepareOrder({
      kind: "increase",
      symbol: market.apiSymbol,
      direction: "long",
      orderType: "market",
      size: SIZE_DELTA_30,
      collateralToPay: { amount: COLLATERAL_USDC_6, token: "USDC" },
      mode: "classic",
      from: PLACEHOLDER_ACCOUNT,
    })

    const wei = prepared.estimates?.executionFeeAmount
    if (!wei || wei <= 0n) return fallbackWei()

    const eth = weiToEth(wei)
    cache = { wei, eth, fetchedAt: now, marketKey }
    return wei
  } catch {
    return fallbackWei()
  }
}

export async function fetchGmxExecutionFeeEth(marketKey?: MarketKey): Promise<number> {
  const wei = await fetchGmxExecutionFeeWei(marketKey ?? "ETH/USD")
  return weiToEth(wei)
}

export function getCachedExecutionFeeEth(): number | null {
  if (!cache || Date.now() - cache.fetchedAt >= CACHE_MS) return null
  return cache.eth
}
