import { DEFAULT_EXECUTION_FEE_ETH, MAX_RISK_USD, MIN_RISK_USD, type MarketKey } from "./contracts"
import type { EasyMarket } from "./gmxMarketData"

export type TradeDirection = "up" | "down"

export interface EasyTradeQuote {
  marketKey: MarketKey
  direction: TradeDirection
  isLong: boolean
  riskUsd: number
  leverage: 5 | 10
  sizeUsd: number
  estimatedEntryPrice: number
  liquidationPrice: number
  estimatedFeesUsd: number
  borrowRate?: number
  fundingRate?: number
  maxRiskUsd: number
  canTrade: boolean
  cannotTradeReason?: string
}

export function directionToIsLong(direction: TradeDirection): boolean {
  return direction === "up"
}

export function estimateLiquidationPrice(
  entryPrice: number,
  isLong: boolean,
  leverage: number,
  maintenanceMargin = 0.01
): number {
  if (!entryPrice || entryPrice <= 0) return 0
  return isLong
    ? entryPrice * (1 - 1 / leverage + maintenanceMargin)
    : entryPrice * (1 + 1 / leverage - maintenanceMargin)
}

export function estimateFeesUsd(sizeUsd: number): number {
  const positionFee = sizeUsd * 0.0005
  const executionFeeUsd = 0.15
  return Math.round((positionFee + executionFeeUsd) * 100) / 100
}

export function validateRiskUsd(riskUsd: number, usdcBalance: number): string | null {
  if (!Number.isFinite(riskUsd)) return "Invalid risk amount."
  if (riskUsd < MIN_RISK_USD) return `Minimum risk is $${MIN_RISK_USD}.`
  if (riskUsd > MAX_RISK_USD) return `Maximum risk is $${MAX_RISK_USD}.`
  if (riskUsd > usdcBalance) return "You do not have enough USDC for this trade."
  return null
}

export function buildEasyTradeQuote(params: {
  market: EasyMarket | null | undefined
  direction: TradeDirection
  riskUsd: number
  leverage: 5 | 10
  usdcBalance: number
  ethBalance: number
  hasExistingSameDirectionPosition?: boolean
}): EasyTradeQuote | null {
  const { market, direction, riskUsd, leverage, usdcBalance, ethBalance, hasExistingSameDirectionPosition } = params
  if (!market) return null

  const isLong = directionToIsLong(direction)
  const sizeUsd = riskUsd * leverage
  const availableLiquidity = isLong ? market.availableLiquidityLongUsd : market.availableLiquidityShortUsd
  let cannotTradeReason =
    validateRiskUsd(riskUsd, usdcBalance) ||
    (hasExistingSameDirectionPosition ? "You already have this GMX trade open. Close it before starting another in the same direction." : null) ||
    (!market.isAvailable ? market.unavailableReason || "This trade is not available right now." : null) ||
    (ethBalance < DEFAULT_EXECUTION_FEE_ETH ? "You need a small amount of ETH on Arbitrum to pay network and execution costs." : null) ||
    (market.price <= 0 ? "Price data is not available right now." : null) ||
    (availableLiquidity !== undefined && availableLiquidity < sizeUsd ? "This trade is not available right now. Try a smaller amount or another market." : null)

  const quote: EasyTradeQuote = {
    marketKey: market.marketKey,
    direction,
    isLong,
    riskUsd,
    leverage,
    sizeUsd,
    estimatedEntryPrice: market.price,
    liquidationPrice: estimateLiquidationPrice(market.price, isLong, leverage),
    estimatedFeesUsd: estimateFeesUsd(sizeUsd),
    borrowRate: isLong ? market.borrowRateLong : market.borrowRateShort,
    fundingRate: isLong ? market.fundingRateLong : market.fundingRateShort,
    maxRiskUsd: riskUsd,
    canTrade: !cannotTradeReason,
    cannotTradeReason: cannotTradeReason ?? undefined,
  }

  return quote
}
