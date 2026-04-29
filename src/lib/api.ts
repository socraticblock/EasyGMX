import { API_BASE, API_V2_BASE, type MarketKey } from "./contracts"

interface TickerPrice {
  minPrice: string
  maxPrice: string
  oraclePrice: string
}

interface MarketTicker {
  market: string
  indexToken: string
  indexTokenSymbol: string
  lastPrice: string
  prices: TickerPrice
  openInterest: {
    long: string
    short: string
  }
  fundingRate: {
    long: string
    short: string
  }
  borrowRate: {
    long: string
    short: string
  }
}

let priceCache: Record<string, number> = {}
let lastFetch = 0
const CACHE_TTL = 3000

export async function fetchMarketPrices(): Promise<Record<string, number>> {
  const now = Date.now()
  if (now - lastFetch < CACHE_TTL && Object.keys(priceCache).length > 0) {
    return priceCache
  }

  try {
    const res = await fetch(`${API_BASE}/markets/tickers`)
    if (!res.ok) throw new Error(`API error: ${res.status}`)
    const data: MarketTicker[] = await res.json()

    const prices: Record<string, number> = {}
    for (const ticker of data) {
      if (ticker.prices?.oraclePrice) {
        prices[ticker.indexTokenSymbol] = parseFloat(ticker.prices.oraclePrice)
      }
    }

    priceCache = prices
    lastFetch = now
    return prices
  } catch {
    return priceCache
  }
}

export async function fetchMarketRates(marketKey: MarketKey) {
  try {
    const res = await fetch(`${API_V2_BASE}/rates?period=1h`)
    if (!res.ok) throw new Error(`Rates API error: ${res.status}`)
    const data = await res.json()
    const match = data.find((r: Record<string, string>) =>
      r.market?.includes(marketKey.split("/")[0])
    )
    return match ?? null
  } catch {
    return null
  }
}

export async function fetchPositions(address: string) {
  try {
    const res = await fetch(`${API_V2_BASE}/positions?address=${address}`)
    if (!res.ok) throw new Error(`Positions API error: ${res.status}`)
    const data = await res.json()
    return data
  } catch {
    return []
  }
}

export function estimateFee(sizeUsd: number): number {
  const positionFee = sizeUsd * 0.0005
  const executionFee = 0.15
  return Math.round((positionFee + executionFee) * 100) / 100
}

export function estimateLiquidationPrice(
  entryPrice: number,
  isLong: boolean,
  leverage: number
): number {
  if (isLong) {
    return entryPrice * (1 - 1 / leverage + 0.015)
  }
  return entryPrice * (1 + 1 / leverage - 0.015)
}
