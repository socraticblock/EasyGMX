import { useQuery } from "@tanstack/react-query"
import { getGmxSdk } from "./gmxSdk"
import { withGmxRetry } from "./gmxRetry"
import { MARKET_LIST, type MarketKey } from "./contracts"

export type Timeframe = "1m" | "5m" | "15m" | "1h" | "4h" | "1D" | "1W" | "1M" | "ALL"

export interface EasyCandle {
  time: number
  open: number
  high: number
  low: number
  close: number
}

const MINUTE = 60 * 1000
const HOUR = 60 * MINUTE
const DAY = 24 * HOUR
const WEEK = 7 * DAY

// Trading intervals users expect. We load much more history than the initially visible area
// so dragging left does not immediately hit a hard edge, while keeping single API calls sane.
const TIMEFRAME_CONFIG: Record<Timeframe, { apiTimeframe: string; limit: number; durationMs?: number; aggregate?: "week" | "month" }> = {
  "1m": { apiTimeframe: "1m", limit: 720, durationMs: 12 * HOUR },
  "5m": { apiTimeframe: "5m", limit: 864, durationMs: 3 * DAY },
  "15m": { apiTimeframe: "15m", limit: 960, durationMs: 10 * DAY },
  "1h": { apiTimeframe: "1h", limit: 1000, durationMs: 60 * DAY },
  "4h": { apiTimeframe: "4h", limit: 1000, durationMs: 365 * DAY },
  "1D": { apiTimeframe: "1d", limit: 1000, durationMs: 1000 * DAY },
  "1W": { apiTimeframe: "1d", limit: 1000, durationMs: 1000 * DAY, aggregate: "week" },
  "1M": { apiTimeframe: "1d", limit: 1000, durationMs: 1000 * DAY, aggregate: "month" },
  ALL: { apiTimeframe: "1d", limit: 1000 },
}

export const TIMEFRAMES: Timeframe[] = ["1m", "5m", "15m", "1h", "4h", "1D", "1W", "1M", "ALL"]

export type TrendPeriod = "4H" | "30D" | "1Y"

const TREND_CONFIG: Record<TrendPeriod, { apiTimeframe: string; limit: number; durationMs: number }> = {
  "4H": { apiTimeframe: "5m", limit: 48, durationMs: 4 * HOUR },
  "30D": { apiTimeframe: "1d", limit: 31, durationMs: 30 * DAY },
  "1Y": { apiTimeframe: "1d", limit: 366, durationMs: 365 * DAY },
}

function parseCandleNumber(value: string): number {
  const parsed = Number(value)
  return Number.isFinite(parsed) ? parsed : 0
}

function normalizeCandles(candles: any[]): EasyCandle[] {
  return candles
    .map((c) => ({
      time: Math.floor(c.timestamp / 1000),
      open: parseCandleNumber(c.open),
      high: parseCandleNumber(c.high),
      low: parseCandleNumber(c.low),
      close: parseCandleNumber(c.close),
    }))
    .filter((c) => c.close > 0)
    .sort((a, b) => a.time - b.time)
}

function aggregateCandles(candles: EasyCandle[], mode?: "week" | "month"): EasyCandle[] {
  if (!mode) return candles

  const buckets = new Map<string, EasyCandle[]>()
  for (const candle of candles) {
    const date = new Date(candle.time * 1000)
    const key = mode === "month"
      ? `${date.getUTCFullYear()}-${date.getUTCMonth()}`
      : `${date.getUTCFullYear()}-${Math.floor((date.getTime() - Date.UTC(date.getUTCFullYear(), 0, 1)) / WEEK)}`
    buckets.set(key, [...(buckets.get(key) ?? []), candle])
  }

  return Array.from(buckets.values()).map((bucket) => {
    const first = bucket[0]
    const last = bucket[bucket.length - 1]
    return {
      time: first.time,
      open: first.open,
      high: Math.max(...bucket.map((c) => c.high)),
      low: Math.min(...bucket.map((c) => c.low)),
      close: last.close,
    }
  })
}

export function getTimeframeLabel(timeframe: Timeframe): string {
  switch (timeframe) {
    case "1m":
      return "1-minute chart · loaded 12 hours"
    case "5m":
      return "5-minute chart · loaded 3 days"
    case "15m":
      return "15-minute chart · loaded 10 days"
    case "1h":
      return "Hourly chart · loaded up to 60 days"
    case "4h":
      return "4-hour chart · loaded up to 1 year"
    case "1D":
      return "Daily chart · loaded long-term history"
    case "1W":
      return "Weekly chart · long-term view"
    case "1M":
      return "Monthly chart · long-term view"
    case "ALL":
      return "All available daily history"
  }
}

export async function fetchTrendCandles(marketKey: MarketKey, period: TrendPeriod): Promise<EasyCandle[]> {
  const market = MARKET_LIST.find((m) => m.key === marketKey)
  if (!market) return []
  const config = TREND_CONFIG[period]
  const since = Date.now() - config.durationMs

  const candles = await withGmxRetry(
    () => getGmxSdk().fetchOhlcv({
      symbol: market.apiSymbol,
      timeframe: config.apiTimeframe,
      limit: config.limit,
      since,
    }),
    { label: `Trend candles ${market.symbol} ${period}` }
  )

  return normalizeCandles(candles)
}

export async function fetchCandles(marketKey: MarketKey, timeframe: Timeframe): Promise<EasyCandle[]> {
  const market = MARKET_LIST.find((m) => m.key === marketKey)
  if (!market) return []
  const config = TIMEFRAME_CONFIG[timeframe]
  const since = config.durationMs ? Date.now() - config.durationMs : undefined

  const candles = await withGmxRetry(
    () => getGmxSdk().fetchOhlcv({
      symbol: market.apiSymbol,
      timeframe: config.apiTimeframe,
      limit: config.limit,
      since,
    }),
    { label: `Candles ${market.symbol} ${timeframe}` }
  )

  return aggregateCandles(normalizeCandles(candles), config.aggregate)
}

export function useMarketCandles(marketKey: MarketKey | null, timeframe: Timeframe) {
  const isLiveRange = timeframe === "1m" || timeframe === "5m" || timeframe === "15m"

  return useQuery({
    queryKey: ["gmxCandles", marketKey, timeframe],
    queryFn: () => marketKey ? fetchCandles(marketKey, timeframe) : Promise.resolve([]),
    enabled: !!marketKey,
    staleTime: isLiveRange ? 10_000 : 60_000,
    refetchInterval: isLiveRange ? 15_000 : false,
  })
}
