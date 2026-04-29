import { create } from "zustand"
import type { MarketKey } from "./contracts"

export type TradeDirection = "long" | "short"

interface Position {
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
  borrowFeeRate: number
  fundingFeeRate: number
}

interface TradeState {
  selectedMarket: MarketKey | null
  direction: TradeDirection
  amount: number
  leverage: 5 | 10
  isOrderPending: boolean
  activePosition: Position | null

  setSelectedMarket: (m: MarketKey) => void
  setDirection: (d: TradeDirection) => void
  setAmount: (a: number) => void
  setLeverage: (l: 5 | 10) => void
  setOrderPending: (p: boolean) => void
  setActivePosition: (p: Position | null) => void
  updatePositionPrice: (price: number) => void
  reset: () => void
}

export const useTradeStore = create<TradeState>((set, get) => ({
  selectedMarket: null,
  direction: "long",
  amount: 10,
  leverage: 5,
  isOrderPending: false,
  activePosition: null,

  setSelectedMarket: (m) => set({ selectedMarket: m }),
  setDirection: (d) => set({ direction: d }),
  setAmount: (a) => set({ amount: Math.max(0, a) }),
  setLeverage: (l) => set({ leverage: l }),
  setOrderPending: (p) => set({ isOrderPending: p }),
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
  reset: () =>
    set({
      selectedMarket: null,
      direction: "long",
      amount: 10,
      leverage: 5,
      isOrderPending: false,
      activePosition: null,
    }),
}))
