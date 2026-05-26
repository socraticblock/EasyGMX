import { useQuery } from "@tanstack/react-query"
import { getGmxSdk } from "./gmxSdk"
import { withGmxRetry } from "./gmxRetry"
import { MARKET_LIST, type MarketKey } from "./contracts"

export type Timeframe = "1m" | "5m" | "15m" | "1h" | "4h" | "1D" | "1W" | "1M" | "1Y" | "30D" | "MAX"

export interface EasyCandle {
  time: number
  open: number
  high: number
  low: number
  close: number
}

const HOUR = 60 * 60 * 1000
const DAY = 24 * HOUR

const TIMEFRAME_CONFIG: Record<Timeframe, { apiTimeframe: string; limit: number; durationMs?: number }> = {
  "1m": { apiTimeframe: "1m", limit: 90, durationMs: 90 * 60 * 1000 },
  "5m": { apiTimeframe: "5m", limit: 96, durationMs: 8 * HOUR },
  "15m": { apiTimeframe: "15m", limit: 96, durationMs: DAY },
  "1h": { apiTimeframe: "1h", limit: 168, durationMs: 7 * DAY },
  "4h": { apiTimeframe: "5m", limit: 60, durationMs: 4 * HOUR },
  "1D": { apiTimeframe: "1h", limit: 24, durationMs: DAY },
  "1W": { apiTimeframe: "4h", limit: 42, durationMs: 7 * DAY },
  "1M": { apiTimeframe: "4h", limit: 180, durationMs: 30 * DAY },
  "30D": { apiTimeframe: "1d", limit: 31, durationMs: 30 * DAY },
  "1Y": { apiTimeframe: "1d", limit: 366, durationMs: 365 * DAY },
  MAX: { apiTimeframe: "1d", limit: 1000 },
}

export const TIMEFRAMES: Timeframe[] = ["1m", "5m", "15m", "1h", "4h", "1D", "1W", "1M", "1Y", "MAX"]

function parseCandleNumber(value: string): number {
  const parsed = Number(value)
  return Number.isFinite(parsed) ? parsed : 0
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
  return useQuery({
    queryKey: ["gmxCandles", marketKey, timeframe],
    queryFn: () => marketKey ? fetchCandles(marketKey, timeframe) : Promise.resolve([]),
    enabled: !!marketKey,
    staleTime: timeframe === "1m" || timeframe === "5m" ? 10_000 : 60_000,
    refetchInterval: timeframe === "1m" || timeframe === "5m" ? 15_000 : false,
  })
}
