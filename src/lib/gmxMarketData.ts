import { useQuery } from "@tanstack/react-query"
import { getGmxSdk } from "./gmxSdk"
import { withGmxRetry } from "./gmxRetry"
import { fetchCandles } from "./gmxCandles"
import { MARKET_LIST, USD_PRECISION, type MarketKey } from "./contracts"

export interface EasyMarket {
  marketKey: MarketKey
  marketAddress: string
  symbol: string
  apiSymbol: string
  icon: string
  price: number
  minPrice: number
  maxPrice: number
  change4hPercent: number
  change1dPercent: number
  change30dPercent: number
  change1yPercent: number
  isAvailable: boolean
  unavailableReason?: string
  borrowRateLong?: number
  borrowRateShort?: number
  fundingRateLong?: number
  fundingRateShort?: number
  availableLiquidityLongUsd?: number
  availableLiquidityShortUsd?: number
}

export function usd30ToNumber(value: bigint | string | number | undefined): number {
  if (value === undefined) return 0
  const raw = typeof value === "bigint" ? value : BigInt(value)
  return Number(raw) / Number(USD_PRECISION)
}

function bpsToPercent(value: bigint | string | number | undefined): number {
  if (value === undefined) return 0
  return Number(value) / 100
}

function rateToDisplayPercent(value: bigint | string | number | undefined): number {
  if (value === undefined) return 0
  return Number(value) / 1e28
}

function percentChange(current: number, previous: number): number {
  if (!Number.isFinite(current) || !Number.isFinite(previous) || previous <= 0) return 0
  return ((current - previous) / previous) * 100
}

async function candleChange(marketKey: MarketKey, period: "4H" | "30D" | "1Y"): Promise<number> {
  const candles = await fetchCandles(marketKey, period === "4H" ? "4h" : period)
  if (candles.length < 2) return 0
  const latest = candles[candles.length - 1]
  const previous = candles[0]
  return percentChange(latest.close, previous.close)
}

export async function fetchEasyMarkets(): Promise<Record<MarketKey, EasyMarket>> {
  const sdk = getGmxSdk()
  const [marketInfos, tickers] = await Promise.all([
    withGmxRetry(() => sdk.fetchMarketsInfo(), { label: "GMX markets" }),
    withGmxRetry(() => sdk.fetchMarketsTickers({ symbols: MARKET_LIST.map((m) => m.apiSymbol) }), { label: "GMX tickers" }),
  ])

  const byKey: Partial<Record<MarketKey, EasyMarket>> = {}

  await Promise.all(MARKET_LIST.map(async (m) => {
    const ticker = tickers.find((t) => t.marketTokenAddress.toLowerCase() === m.address.toLowerCase() || t.symbol === m.apiSymbol)
    const marketInfo = marketInfos.find((info) =>
      info.marketTokenAddress?.toLowerCase() === m.address.toLowerCase() ||
      info.name === m.apiSymbol
    )
    const price = usd30ToNumber(ticker?.markPrice)
    const availableLong = usd30ToNumber(ticker?.availableLiquidityLong)
    const availableShort = usd30ToNumber(ticker?.availableLiquidityShort)
    const isListed = marketInfo?.isDisabled === false || marketInfo?.isDisabled === undefined
    const hasTicker = !!ticker && price > 0
    const hasLiquidity = availableLong > 0 && availableShort > 0

    let unavailableReason: string | undefined
    if (!marketInfo) unavailableReason = "Market is not available from GMX right now."
    else if (!isListed) unavailableReason = "This market is temporarily unavailable on GMX."
    else if (!hasTicker) unavailableReason = "Price data is not available right now."
    else if (!hasLiquidity) unavailableReason = "Liquidity is not available right now."

    const [change4hPercent, change30dPercent, change1yPercent] = await Promise.all([
      candleChange(m.key, "4H").catch(() => 0),
      candleChange(m.key, "30D").catch(() => 0),
      candleChange(m.key, "1Y").catch(() => 0),
    ])

    byKey[m.key] = {
      marketKey: m.key,
      marketAddress: m.address,
      symbol: m.symbol,
      apiSymbol: m.apiSymbol,
      icon: m.icon,
      price,
      minPrice: usd30ToNumber(ticker?.minPrice),
      maxPrice: usd30ToNumber(ticker?.maxPrice),
      change4hPercent,
      change1dPercent: bpsToPercent(ticker?.priceChangePercent24hBps),
      change30dPercent,
      change1yPercent,
      isAvailable: !unavailableReason,
      unavailableReason,
      borrowRateLong: rateToDisplayPercent(ticker?.borrowingRateLong),
      borrowRateShort: rateToDisplayPercent(ticker?.borrowingRateShort),
      fundingRateLong: rateToDisplayPercent(ticker?.fundingRateLong),
      fundingRateShort: rateToDisplayPercent(ticker?.fundingRateShort),
      availableLiquidityLongUsd: availableLong,
      availableLiquidityShortUsd: availableShort,
    }
  }))

  return byKey as Record<MarketKey, EasyMarket>
}

export function useEasyMarkets() {
  return useQuery({
    queryKey: ["easyMarkets"],
    queryFn: fetchEasyMarkets,
    staleTime: 10_000,
    refetchInterval: 20_000,
  })
}
