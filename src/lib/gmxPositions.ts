import { useQuery } from "@tanstack/react-query"
import type { Hash } from "viem"
import { getGmxSdk } from "./gmxSdk"
import { withGmxRetry, pollUntil } from "./gmxRetry"
import { usd30ToNumber } from "./gmxMarketData"
import { MARKET_LIST, type MarketKey } from "./contracts"
import type { TradeDirection } from "./gmxQuote"

export interface EasyActivePosition {
  marketKey: MarketKey
  marketAddress: string
  direction: TradeDirection
  isLong: boolean
  riskUsd: number
  sizeUsd: number
  leverage: 5 | 10
  entryPrice: number
  currentPrice: number
  liquidationPrice: number
  pnlUsd: number
  pnlPercent: number
  borrowFeeUsd?: number
  fundingFeeUsd?: number
  openTxHash?: Hash | null
  closeTxHash?: Hash | null
  orderKey?: Hash | null
  isOnChain: boolean
}

export interface EasyClosedTrade {
  marketKey: MarketKey
  direction: TradeDirection
  leverage: 5 | 10
  riskUsd: number
  sizeUsd: number
  entryPrice: number
  exitPrice: number
  pnlUsd: number
  pnlPercent: number
  openTxHash?: Hash | null
  closeTxHash?: Hash | null
  closedAt: number
}

function marketKeyFromAddress(address: string): MarketKey | null {
  return MARKET_LIST.find((m) => m.address.toLowerCase() === address.toLowerCase())?.key ?? null
}

function localPnl(position: Pick<EasyActivePosition, "isLong" | "entryPrice" | "currentPrice" | "sizeUsd" | "riskUsd">) {
  if (!position.entryPrice || !position.currentPrice) return { pnlUsd: 0, pnlPercent: 0 }
  const direction = position.isLong ? 1 : -1
  const pnlUsd = direction * (position.currentPrice - position.entryPrice) * (position.sizeUsd / position.entryPrice)
  return {
    pnlUsd: Math.round(pnlUsd * 100) / 100,
    pnlPercent: position.riskUsd > 0 ? Math.round((pnlUsd / position.riskUsd) * 10_000) / 100 : 0,
  }
}

export function mergePositionPrice(position: EasyActivePosition, currentPrice: number): EasyActivePosition {
  const next = { ...position, currentPrice }
  const pnl = localPnl(next)
  return { ...next, ...pnl }
}

export function mapApiPosition(raw: any, fallback?: EasyActivePosition): EasyActivePosition | null {
  const marketKey = marketKeyFromAddress(raw.marketAddress)
  if (!marketKey) return null
  const market = MARKET_LIST.find((m) => m.key === marketKey)!
  const collateralUsd = usd30ToNumber(raw.collateralUsd ?? raw.remainingCollateralUsd)
  const sizeUsd = usd30ToNumber(raw.sizeInUsd)
  const entryPrice = usd30ToNumber(raw.entryPrice)
  const currentPrice = usd30ToNumber(raw.markPrice)
  const pnlUsd = usd30ToNumber(raw.pnlAfterFees ?? raw.pnl)
  const pnlPercentRaw = raw.pnlAfterFeesPercentage ?? raw.pnlPercentage
  const pnlPercent = pnlPercentRaw !== undefined ? Number(pnlPercentRaw) / 1e28 : (collateralUsd ? (pnlUsd / collateralUsd) * 100 : 0)
  const isLong = Boolean(raw.isLong)

  return {
    marketKey,
    marketAddress: market.address,
    direction: isLong ? "up" : "down",
    isLong,
    riskUsd: fallback?.riskUsd ?? collateralUsd,
    sizeUsd: sizeUsd || fallback?.sizeUsd || 0,
    leverage: fallback?.leverage ?? 5,
    entryPrice: entryPrice || fallback?.entryPrice || 0,
    currentPrice: currentPrice || fallback?.currentPrice || 0,
    liquidationPrice: usd30ToNumber(raw.liquidationPrice) || fallback?.liquidationPrice || 0,
    pnlUsd: Math.round(pnlUsd * 100) / 100,
    pnlPercent: Math.round(pnlPercent * 100) / 100,
    borrowFeeUsd: usd30ToNumber(raw.pendingBorrowingFeesUsd),
    fundingFeeUsd: usd30ToNumber(raw.pendingFundingFeesUsd),
    openTxHash: fallback?.openTxHash ?? null,
    closeTxHash: fallback?.closeTxHash ?? null,
    orderKey: fallback?.orderKey ?? null,
    isOnChain: true,
  }
}

export async function fetchEasyPositions(address: string, fallback?: EasyActivePosition | null): Promise<EasyActivePosition[]> {
  const positions = await withGmxRetry(
    () => getGmxSdk().fetchPositionsInfo({ address, includeRelatedOrders: true }),
    { label: "GMX positions" }
  )
  return positions
    .map((p) => mapApiPosition(p, fallback ?? undefined))
    .filter((p): p is EasyActivePosition => !!p)
}

export async function fetchEasyOrders(address: string) {
  return withGmxRetry(() => getGmxSdk().fetchOrders({ address }), { label: "GMX orders" })
}

export function findMatchingPosition(positions: EasyActivePosition[], target: Pick<EasyActivePosition, "marketAddress" | "isLong">) {
  return positions.find((p) => p.marketAddress.toLowerCase() === target.marketAddress.toLowerCase() && p.isLong === target.isLong) ?? null
}

export async function waitForPosition(address: string, target: EasyActivePosition): Promise<EasyActivePosition> {
  return pollUntil(async () => {
    const positions = await fetchEasyPositions(address, target)
    return findMatchingPosition(positions, target)
  }, {
    timeoutMs: 75_000,
    intervalMs: 4_000,
    label: "GMX is taking longer than expected to confirm this trade. Check GMX or Arbiscan before trying again.",
  })
}

export async function waitForPositionClosed(address: string, target: EasyActivePosition): Promise<true> {
  return pollUntil(async () => {
    const positions = await fetchEasyPositions(address, target)
    return findMatchingPosition(positions, target) ? null : true
  }, {
    timeoutMs: 75_000,
    intervalMs: 4_000,
    label: "GMX is taking longer than expected to confirm the close. Check GMX or Arbiscan before trying again.",
  })
}

export function closedTradeFromPosition(position: EasyActivePosition): EasyClosedTrade {
  return {
    marketKey: position.marketKey,
    direction: position.direction,
    leverage: position.leverage,
    riskUsd: position.riskUsd,
    sizeUsd: position.sizeUsd,
    entryPrice: position.entryPrice,
    exitPrice: position.currentPrice,
    pnlUsd: position.pnlUsd,
    pnlPercent: position.pnlPercent,
    openTxHash: position.openTxHash,
    closeTxHash: position.closeTxHash,
    closedAt: Date.now(),
  }
}

export function useEasyPositions(address: `0x${string}` | undefined, fallback?: EasyActivePosition | null) {
  return useQuery({
    queryKey: ["easyPositions", address, fallback?.marketAddress, fallback?.isLong],
    queryFn: () => address ? fetchEasyPositions(address, fallback) : Promise.resolve([]),
    enabled: !!address,
    refetchInterval: 5_000,
  })
}
