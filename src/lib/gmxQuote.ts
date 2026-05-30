import { DEFAULT_EXECUTION_FEE_ETH, MAX_RISK_USD, MIN_RISK_USD, type MarketKey } from "./contracts"
import type { EasyMarket } from "./gmxMarketData"

export type TradeDirection = "up" | "down"

export type TradeBlockReason =
  | "insufficient_usdc"
  | "insufficient_eth"
  | "market_unavailable"
  | "existing_position"
  | "stale_quote"
  | "invalid_risk_min"
  | "invalid_risk_max"
  | "invalid_risk"
  | "liquidity"
  | "no_price"

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
  blockReason?: TradeBlockReason
  /** @deprecated use blockReason + getTradeBlockButtonLabel */
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

export function validateRiskUsd(riskUsd: number, usdcBalance: number): TradeBlockReason | null {
  if (!Number.isFinite(riskUsd)) return "invalid_risk"
  if (riskUsd < MIN_RISK_USD) return "invalid_risk_min"
  if (riskUsd > MAX_RISK_USD) return "invalid_risk_max"
  if (riskUsd > usdcBalance) return "insufficient_usdc"
  return null
}

export function getTradeBlockButtonLabel(reason: TradeBlockReason | undefined): string {
  switch (reason) {
    case "insufficient_usdc":
      return "Insufficient Arbitrum USDC"
    case "insufficient_eth":
      return "Insufficient ETH for network costs"
    case "existing_position":
      return "Existing same-direction position"
    case "stale_quote":
      return "Refresh quote"
    case "market_unavailable":
    case "liquidity":
    case "no_price":
      return "Market unavailable"
    case "invalid_risk_min":
    case "invalid_risk_max":
    case "invalid_risk":
      return "Trade unavailable"
    default:
      return "Trade unavailable"
  }
}

export function getTradeBlockExplanation(
  reason: TradeBlockReason | undefined,
  ctx: {
    riskUsd: number
    usdcBalance: number
    marketLabel: string
    directionLabel: string
  }
): string | null {
  const { riskUsd, usdcBalance, marketLabel, directionLabel } = ctx
  switch (reason) {
    case "insufficient_usdc":
      return `This trade risks ${riskUsd.toFixed(2)} USDC, but EasyGMX sees ${usdcBalance.toFixed(2)} native USDC on Arbitrum. If your wallet shows a USDC balance, it may be legacy USDC.e, which this GMX V2 flow cannot use as collateral.`
    case "insufficient_eth":
      return "You need a small amount of ETH on Arbitrum for GMX network/execution costs."
    case "existing_position":
      return `You already have an open ${marketLabel} ${directionLabel} position. Close it before opening another same-direction trade.`
    case "stale_quote":
      return "GMX prices and execution costs can move quickly. Refresh the quote before opening this trade."
    case "invalid_risk_min":
      return `Minimum risk is ${MIN_RISK_USD.toFixed(2)} USDC.`
    case "invalid_risk_max":
      return `Maximum risk is ${MAX_RISK_USD.toFixed(2)} USDC.`
    case "invalid_risk":
      return "Enter a valid USDC risk amount."
    case "liquidity":
      return "GMX does not have enough liquidity for this size right now. Try a smaller amount or another market."
    case "no_price":
      return "GMX price data is not available for this market right now."
    case "market_unavailable":
      return "This market is not available on GMX right now."
    default:
      return null
  }
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

  let blockReason: TradeBlockReason | null =
    validateRiskUsd(riskUsd, usdcBalance) ||
    (hasExistingSameDirectionPosition ? "existing_position" : null) ||
    (!market.isAvailable ? "market_unavailable" : null) ||
    (ethBalance < minExecutionEth ? "insufficient_eth" : null) ||
    (market.price <= 0 ? "no_price" : null) ||
    (availableLiquidity !== undefined && availableLiquidity < sizeUsd ? "liquidity" : null)

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
    canTrade: !blockReason,
    blockReason: blockReason ?? undefined,
    cannotTradeReason: blockReason ? getTradeBlockButtonLabel(blockReason) : undefined,
  }

  return quote
}
