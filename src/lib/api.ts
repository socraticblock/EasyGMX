import { API_BASE, type MarketKey } from "./contracts"

// ─── Types ─────────────────────────────────────────────────

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
  openInterest: { long: string; short: string }
  fundingRate: { long: string; short: string }
  borrowRate: { long: string; short: string }
}

export interface MarketPriceData {
  price: number
  minPrice: number
  maxPrice: number
  fundingRateLong: number
  fundingRateShort: number
  borrowRateLong: number
  borrowRateShort: number
  openInterestLong: number
  openInterestShort: number
}

// ─── Cache ─────────────────────────────────────────────────

let priceCache: Record<string, MarketPriceData> = {}
let lastFetchTime = 0
const CACHE_TTL = 3_000 // 3 seconds

// Rate limit tracking
let requestCount = 0
let requestWindowStart = Date.now()
const MAX_REQUESTS_PER_MINUTE = 30

function checkRateLimit() {
  const now = Date.now()
  if (now - requestWindowStart > 60_000) {
    requestCount = 0
    requestWindowStart = now
  }
  requestCount++
  if (requestCount > MAX_REQUESTS_PER_MINUTE) {
    throw new Error("Rate limit exceeded — slowing down requests")
  }
}

// ─── Fetch market prices ───────────────────────────────────

export async function fetchMarketPrices(): Promise<Record<string, MarketPriceData>> {
  const now = Date.now()
  if (now - lastFetchTime < CACHE_TTL && Object.keys(priceCache).length > 0) {
    return priceCache
  }

  checkRateLimit()

  try {
    const res = await fetch(`${API_BASE}/markets/tickers`, {
      headers: { Accept: "application/json" },
      signal: AbortSignal.timeout(5_000),
    })
    if (!res.ok) throw new Error(`API ${res.status}`)

    const data: MarketTicker[] = await res.json()
    const prices: Record<string, MarketPriceData> = {}

    for (const t of data) {
      if (t.prices?.oraclePrice) {
        prices[t.indexTokenSymbol] = {
          price: parseFloat(t.prices.oraclePrice),
          minPrice: parseFloat(t.prices.minPrice),
          maxPrice: parseFloat(t.prices.maxPrice),
          fundingRateLong: parseFloat(t.fundingRate?.long ?? "0"),
          fundingRateShort: parseFloat(t.fundingRate?.short ?? "0"),
          borrowRateLong: parseFloat(t.borrowRate?.long ?? "0"),
          borrowRateShort: parseFloat(t.borrowRate?.short ?? "0"),
          openInterestLong: parseFloat(t.openInterest?.long ?? "0"),
          openInterestShort: parseFloat(t.openInterest?.short ?? "0"),
        }
      }
    }

    priceCache = prices
    lastFetchTime = now
    return prices
  } catch (err) {
    // Return stale cache on error rather than crashing
    console.warn("Price fetch failed, using cache:", err)
    return priceCache
  }
}

// ─── Fetch single market price ─────────────────────────────

export async function fetchMarketPrice(symbol: string): Promise<number> {
  const prices = await fetchMarketPrices()
  return prices[symbol]?.price ?? 0
}

// ─── Fee estimation ────────────────────────────────────────
// Position fee: 0.05% of size
// Borrow fee: hourly rate while position is open (varies)
// Execution fee: ~0.0001 ETH (gas for keeper)

export interface FeeBreakdown {
  positionFee: number
  borrowFeeHourly: number
  executionFeeUsd: number
  total: number
}

export function estimateFee(sizeUsd: number, borrowRateHourly = 0.0001): FeeBreakdown {
  const positionFee = sizeUsd * 0.0005
  const borrowFeeHourly = sizeUsd * borrowRateHourly
  const executionFeeUsd = 0.15 // approximate ETH cost in USD
  return {
    positionFee: Math.round(positionFee * 100) / 100,
    borrowFeeHourly: Math.round(borrowFeeHourly * 100) / 100,
    executionFeeUsd,
    total: Math.round((positionFee + executionFeeUsd) * 100) / 100,
  }
}

// ─── Liquidation price ─────────────────────────────────────
// Simplified: entry * (1 ± (1/leverage - maintenance_margin))
// GMX V2 maintenance margin ≈ 1% for most markets

export function estimateLiquidationPrice(
  entryPrice: number,
  isLong: boolean,
  leverage: number,
  maintenanceMargin = 0.01
): number {
  if (isLong) {
    // Long liq: price drops below entry * (1 - 1/leverage + maintenance)
    return entryPrice * (1 - 1 / leverage + maintenanceMargin)
  }
  // Short liq: price rises above entry * (1 + 1/leverage - maintenance)
  return entryPrice * (1 + 1 / leverage - maintenanceMargin)
}

// ─── Validation ────────────────────────────────────────────

export function validateTradeAmount(amount: number, balance: number, minAmount = 1): string | null {
  if (!Number.isFinite(amount)) return "Invalid amount"
  if (amount <= 0) return "Amount must be positive"
  if (amount < minAmount) return `Minimum trade is $${minAmount}`
  if (amount > 10_000) return "Maximum trade is $10,000"
  if (amount > balance) return "Insufficient USDC balance"
  // Leave room for fees
  if (amount > balance * 0.95) return "Leave some USDC for fees"
  return null
}
