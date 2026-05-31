import { useQuery } from "@tanstack/react-query"
import { getGmxSdk } from "./gmxSdk"
import { withGmxRetry } from "./gmxRetry"
import { MARKET_LIST, type MarketKey } from "./contracts"

export type Timeframe = "1m" | "5m" | "15m" | "1h" | "4h" | "1D" | "1W" | "1M" | "ALL"
export type ChartTimeframeMode = Timeframe | "auto"

export interface EasyCandle {
  time: number
  open: number
  high: number
  low: number
  close: number
}

const HOUR = 60 * 60 * 1000
const DAY = 24 * HOUR

// User-facing ranges, not technical candle labels.
// Keep point counts high enough to show real market history without overloading mobile.
const TIMEFRAME_CONFIG: Record<Timeframe, { apiTimeframe: string; limit: number; durationMs?: number }> = {
  "1m": { apiTimeframe: "1m", limit: 720, durationMs: 12 * HOUR },
  "5m": { apiTimeframe: "5m", limit: 864, durationMs: 3 * DAY },
  "15m": { apiTimeframe: "15m", limit: 960, durationMs: 10 * DAY },
  "1h": { apiTimeframe: "1h", limit: 1440, durationMs: 60 * DAY },
  "4h": { apiTimeframe: "4h", limit: 2190, durationMs: 365 * DAY },
  "1D": { apiTimeframe: "1d", limit: 1000 },
  "1W": { apiTimeframe: "1d", limit: 1000 },
  "1M": { apiTimeframe: "1d", limit: 1000 },
  ALL: { apiTimeframe: "1d", limit: 1000 },
}

export const TIMEFRAMES: Timeframe[] = ["1m", "5m", "15m", "1h", "4h", "1D", "1W", "1M"]

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

export function getTimeframeLabel(timeframe: Timeframe): string {
  switch (timeframe) {
    case "1m":
      return "1 minute candles"
    case "5m":
      return "5 minute candles"
    case "15m":
      return "15 minute candles"
    case "1h":
      return "1 hour candles"
    case "4h":
      return "4 hour candles"
    case "1D":
      return "Daily candles"
    case "1W":
      return "Weekly candles"
    case "1M":
      return "Monthly candles"
    case "ALL":
      return "Full GMX history"
  }
}

function aggregateCandles(candles: EasyCandle[], bucketMs: number): EasyCandle[] {
  const buckets = new Map<number, EasyCandle>()

  for (const candle of candles) {
    const bucketTime = Math.floor((candle.time * 1000) / bucketMs) * bucketMs / 1000
    const existing = buckets.get(bucketTime)

    if (!existing) {
      buckets.set(bucketTime, { ...candle, time: bucketTime })
      continue
    }

    existing.high = Math.max(existing.high, candle.high)
    existing.low = Math.min(existing.low, candle.low)
    existing.close = candle.close
  }

  return Array.from(buckets.values()).sort((a, b) => a.time - b.time)
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

  const parsed = candles
    .map((c) => ({
      time: Math.floor(c.timestamp / 1000),
      open: parseCandleNumber(c.open),
      high: parseCandleNumber(c.high),
      low: parseCandleNumber(c.low),
      close: parseCandleNumber(c.close),
    }))
    .filter((c) => c.close > 0)
    .sort((a, b) => a.time - b.time)

  if (timeframe === "1W") return aggregateCandles(parsed, 7 * DAY)
  if (timeframe === "1M") return aggregateCandles(parsed, 30 * DAY)
  return parsed
}

export function useMarketCandles(marketKey: MarketKey | null, timeframe: Timeframe) {
  const isLiveRange = timeframe === "1m" || timeframe === "5m" || timeframe === "15m" || timeframe === "1h"

  return useQuery({
    queryKey: ["gmxCandles", marketKey, timeframe],
    queryFn: () => marketKey ? fetchCandles(marketKey, timeframe) : Promise.resolve([]),
    enabled: !!marketKey,
    staleTime: isLiveRange ? 10_000 : 60_000,
    refetchInterval: isLiveRange ? 15_000 : false,
  })
}
