import { useQuery } from "@tanstack/react-query"
import { getGmxSdk } from "./gmxSdk"
import { withGmxRetry } from "./gmxRetry"
import { MARKET_LIST, type MarketKey } from "./contracts"

export type Timeframe = "1H" | "1D" | "1W" | "1M" | "3M" | "1Y" | "ALL"

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
  "1H": { apiTimeframe: "1m", limit: 90, durationMs: 90 * 60 * 1000 },
  "1D": { apiTimeframe: "5m", limit: 288, durationMs: DAY },
  "1W": { apiTimeframe: "1h", limit: 168, durationMs: 7 * DAY },
  "1M": { apiTimeframe: "4h", limit: 180, durationMs: 30 * DAY },
  "3M": { apiTimeframe: "1d", limit: 92, durationMs: 92 * DAY },
  "1Y": { apiTimeframe: "1d", limit: 366, durationMs: 365 * DAY },
  ALL: { apiTimeframe: "1d", limit: 1000 },
}

export const TIMEFRAMES: Timeframe[] = ["1H", "1D", "1W", "1M", "3M", "1Y", "ALL"]

function parseCandleNumber(value: string): number {
  const parsed = Number(value)
  return Number.isFinite(parsed) ? parsed : 0
}

export function getTimeframeLabel(timeframe: Timeframe): string {
  switch (timeframe) {
    case "1H":
      return "Last hour"
    case "1D":
      return "Last 24 hours"
    case "1W":
      return "Last 7 days"
    case "1M":
      return "Last 30 days"
    case "3M":
      return "Last 3 months"
    case "1Y":
      return "Last year"
    case "ALL":
      return "Full GMX history"
  }
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

export function useMarketCandles(marketKey: MarketKey | null, timeframe: Timeframe) {
  const isLiveRange = timeframe === "1H" || timeframe === "1D"

  return useQuery({
    queryKey: ["gmxCandles", marketKey, timeframe],
    queryFn: () => marketKey ? fetchCandles(marketKey, timeframe) : Promise.resolve([]),
    enabled: !!marketKey,
    staleTime: isLiveRange ? 10_000 : 60_000,
    refetchInterval: isLiveRange ? 15_000 : false,
  })
}
