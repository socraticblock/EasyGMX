/**
 * GMX Express research spike — not enabled in production V1 by default.
 * See docs/gmx-express-feasibility.md
 */

import { getGmxSdk } from "./gmxSdk"
import { MARKET_LIST, type MarketKey } from "./contracts"

export const GMX_EXPRESS_ENABLED =
  process.env.NEXT_PUBLIC_GMX_EXPRESS_ENABLED === "true"

const PLACEHOLDER_ACCOUNT = "0x0000000000000000000000000000000000000001" as const

export interface ExpressPrepareSnapshot {
  enabled: boolean
  marketKey: MarketKey
  executionFeeAmount: string
  positionFeeUsd: string
  mode: "express" | "classic"
}

/** Dry-run Express prepareOrder for research; does not submit orders. */
export async function researchExpressPrepare(
  marketKey: MarketKey = "ETH/USD"
): Promise<ExpressPrepareSnapshot | null> {
  if (!GMX_EXPRESS_ENABLED) return null

  const market = MARKET_LIST.find((m) => m.key === marketKey)
  if (!market) return null

  try {
    const sdk = getGmxSdk()
    const prepared = await sdk.prepareOrder({
      kind: "increase",
      symbol: market.apiSymbol,
      direction: "long",
      orderType: "market",
      size: 10n * 10n ** 30n,
      collateralToPay: { amount: 10_000_000n, token: "USDC" },
      mode: "express",
      from: PLACEHOLDER_ACCOUNT,
    })

    return {
      enabled: true,
      marketKey,
      executionFeeAmount: String(prepared.estimates?.executionFeeAmount ?? 0n),
      positionFeeUsd: String(prepared.estimates?.positionFeeUsd ?? 0n),
      mode: "express",
    }
  } catch {
    return null
  }
}

export function expressV1StatusLabel(): string {
  if (!GMX_EXPRESS_ENABLED) return "Classic only (V1)"
  return "Express research flag on — Classic still used for trades"
}
