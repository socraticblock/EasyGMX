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

/** GMX position fee is often 0.04% or 0.06% depending on open interest balance. */
export const POSITION_FEE_BPS_LOW = 4
export const POSITION_FEE_BPS_HIGH = 6

export interface FeeEstimateBreakdown {
  positionFeeLowUsd: number
  positionFeeHighUsd: number
  executionFeeUsd: number
  totalLowUsd: number
  totalHighUsd: number
}

export function estimateFeeBreakdown(sizeUsd: number, executionFeeEth?: number, ethUsdPrice?: number): FeeEstimateBreakdown {
  const positionFeeLowUsd = (sizeUsd * POSITION_FEE_BPS_LOW) / 10_000
  const positionFeeHighUsd = (sizeUsd * POSITION_FEE_BPS_HIGH) / 10_000
  const executionFeeUsd =
    executionFeeEth !== undefined && ethUsdPrice !== undefined && ethUsdPrice > 0
      ? executionFeeEth * ethUsdPrice
      : 0.15
  return {
    positionFeeLowUsd,
    positionFeeHighUsd,
    executionFeeUsd,
    totalLowUsd: Math.round((positionFeeLowUsd + executionFeeUsd) * 100) / 100,
    totalHighUsd: Math.round((positionFeeHighUsd + executionFeeUsd) * 100) / 100,
  }
}

export function estimateFeesUsd(sizeUsd: number, executionFeeEth?: number, ethUsdPrice?: number): number {
  const { totalHighUsd } = estimateFeeBreakdown(sizeUsd, executionFeeEth, ethUsdPrice)
  return totalHighUsd
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
  executionFeeEth?: number
  ethUsdPrice?: number
  hasExistingSameDirectionPosition?: boolean
}): EasyTradeQuote | null {
  const { market, direction, riskUsd, leverage, usdcBalance, ethBalance, executionFeeEth, ethUsdPrice, hasExistingSameDirectionPosition } = params
  const minExecutionEth = executionFeeEth ?? DEFAULT_EXECUTION_FEE_ETH
  if (!market) return null

  const isLong = directionToIsLong(direction)
  const sizeUsd = riskUsd * leverage
  const availableLiquidity = isLong ? market.availableLiquidityLongUsd : market.availableLiquidityShortUsd
  let cannotTradeReason =
    validateRiskUsd(riskUsd, usdcBalance) ||
    (hasExistingSameDirectionPosition ? "You already have this GMX trade open. Close it before starting another in the same direction." : null) ||
    (!market.isAvailable ? market.unavailableReason || "This trade is not available right now." : null) ||
    (ethBalance < minExecutionEth ? "You need a small amount of ETH on Arbitrum to pay network and execution costs." : null) ||
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
    estimatedFeesUsd: estimateFeesUsd(sizeUsd, executionFeeEth, ethUsdPrice),
    borrowRate: isLong ? market.borrowRateLong : market.borrowRateShort,
    fundingRate: isLong ? market.fundingRateLong : market.fundingRateShort,
    maxRiskUsd: riskUsd,
    canTrade: !cannotTradeReason,
    cannotTradeReason: cannotTradeReason ?? undefined,
  }

  return quote
}
