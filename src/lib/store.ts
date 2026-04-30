import { create } from "zustand"
import type { Hash } from "viem"
import type { MarketKey } from "./contracts"

// ─── Types ─────────────────────────────────────────────────

export type TradeDirection = "long" | "short"
export type OrderPhase = "idle" | "approving" | "signing" | "submitted" | "keeper" | "confirmed" | "failed"

export interface Position {
  marketKey: MarketKey
  marketAddress: string
  isLong: boolean
  sizeUsd: number
  collateralUsd: number
  entryPrice: number
  currentPrice: number
  pnlUsd: number
  pnlPercent: number
  liquidationPrice: number
  borrowFeeHourly: number
  fundingRateAnnual: number
  // On-chain data
  orderKey: Hash | null
  openTxHash: Hash | null
  closeTxHash: Hash | null
  isOnChain: boolean // true = confirmed on-chain, false = optimistic
}

interface TradeState {
  // Navigation
  selectedMarket: MarketKey | null

  // Trade config
  direction: TradeDirection
  amount: number
  leverage: 5 | 10

  // Order flow
  orderPhase: OrderPhase
  orderError: string | null
  closePhase: OrderPhase
  closeError: string | null

  // Active position
  activePosition: Position | null

  // Actions
  setSelectedMarket: (m: MarketKey | null) => void
  setDirection: (d: TradeDirection) => void
  setAmount: (a: number) => void
  setLeverage: (l: 5 | 10) => void
  setOrderPhase: (p: OrderPhase) => void
  setOrderError: (e: string | null) => void
  setClosePhase: (p: OrderPhase) => void
  setCloseError: (e: string | null) => void
  setActivePosition: (p: Position | null) => void
  updatePositionPrice: (price: number) => void
  updatePositionOnChain: (partial: Partial<Position>) => void
  reset: () => void
  resetOrderFlow: () => void
}

const INITIAL = {
  selectedMarket: null,
  direction: "long" as TradeDirection,
  amount: 10,
  leverage: 5 as const,
  orderPhase: "idle" as OrderPhase,
  orderError: null,
  closePhase: "idle" as OrderPhase,
  closeError: null,
  activePosition: null,
}

export const useTradeStore = create<TradeState>((set, get) => ({
  ...INITIAL,

  setSelectedMarket: (m) => set({ selectedMarket: m }),
  setDirection: (d) => set({ direction: d }),
  setAmount: (a) => set({ amount: Math.max(0, Math.min(10_000, Number.isFinite(a) ? a : 0)) }),
  setLeverage: (l) => set({ leverage: l }),
  setOrderPhase: (p) => set({ orderPhase: p }),
  setOrderError: (e) => set({ orderError: e, orderPhase: e ? "failed" : get().orderPhase }),
  setClosePhase: (p) => set({ closePhase: p }),
  setCloseError: (e) => set({ closeError: e, closePhase: e ? "failed" : get().closePhase }),
  setActivePosition: (p) => set({ activePosition: p }),

  updatePositionPrice: (price) => {
    const pos = get().activePosition
    if (!pos) return
    const direction = pos.isLong ? 1 : -1
    const priceDiff = price - pos.entryPrice
    const pnlUsd = direction * priceDiff * (pos.sizeUsd / pos.entryPrice)
    const pnlPercent = (pnlUsd / pos.collateralUsd) * 100
    set({
      activePosition: {
        ...pos,
        currentPrice: price,
        pnlUsd: Math.round(pnlUsd * 100) / 100,
        pnlPercent: Math.round(pnlPercent * 100) / 100,
      },
    })
  },

  updatePositionOnChain: (partial) => {
    const pos = get().activePosition
    if (!pos) return
    set({ activePosition: { ...pos, ...partial } })
  },

  reset: () => set(INITIAL),

  resetOrderFlow: () => set({
    orderPhase: "idle",
    orderError: null,
    closePhase: "idle",
    closeError: null,
  }),
}))
