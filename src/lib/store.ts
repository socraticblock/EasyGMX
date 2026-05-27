import { create } from "zustand"
import { DEFAULT_LEVERAGE, DEFAULT_RISK_USD, MAX_RISK_USD, MIN_RISK_USD, V1_PRIMARY_MARKET_KEY, type MarketKey } from "./contracts"
import type { EasyActivePosition, EasyClosedTrade } from "./gmxPositions"
import type { Timeframe } from "./gmxCandles"
import type { TradeDirection } from "./gmxQuote"

export type OrderPhase = "idle" | "approval" | "signing" | "submitted" | "keeper" | "confirmed" | "failed"

interface TradeState {
  selectedMarket: MarketKey | null
  direction: TradeDirection
  riskUsd: number
  leverage: 5 | 10
  chartTimeframe: Timeframe
  liveChartTimeframe: Timeframe
  hasAcknowledgedRisk: boolean
  orderPhase: OrderPhase
  orderError: string | null
  closePhase: OrderPhase
  closeError: string | null
  activePosition: EasyActivePosition | null
  lastClosedTrade: EasyClosedTrade | null
  showMarketPicker: boolean

  setSelectedMarket: (m: MarketKey | null) => void
  openMarketPicker: () => void
  closeMarketPicker: () => void
  startEthTrade: () => void
  setDirection: (d: TradeDirection) => void
  setRiskUsd: (a: number) => void
  setLeverage: (l: 5 | 10) => void
  setChartTimeframe: (t: Timeframe) => void
  setLiveChartTimeframe: (t: Timeframe) => void
  setHasAcknowledgedRisk: (v: boolean) => void
  setOrderPhase: (p: OrderPhase) => void
  setOrderError: (e: string | null) => void
  setClosePhase: (p: OrderPhase) => void
  setCloseError: (e: string | null) => void
  setActivePosition: (p: EasyActivePosition | null) => void
  updateActivePosition: (partial: Partial<EasyActivePosition>) => void
  setLastClosedTrade: (p: EasyClosedTrade | null) => void
  reset: () => void
  resetOrderFlow: () => void
  tradeAgain: () => void
}

const INITIAL = {
  selectedMarket: null,
  direction: "up" as TradeDirection,
  riskUsd: DEFAULT_RISK_USD,
  leverage: DEFAULT_LEVERAGE,
  chartTimeframe: "1h" as Timeframe,
  liveChartTimeframe: "5m" as Timeframe,
  hasAcknowledgedRisk: false,
  orderPhase: "idle" as OrderPhase,
  orderError: null,
  closePhase: "idle" as OrderPhase,
  closeError: null,
  activePosition: null,
  lastClosedTrade: null,
  showMarketPicker: false,
}

function clampRiskUsd(value: number): number {
  if (!Number.isFinite(value)) return 0
  return Math.max(0, Math.min(MAX_RISK_USD, Math.round(value * 100) / 100))
}

function hasMeaningfulChange<T extends object>(current: T, next: T): boolean {
  const keys = new Set([...Object.keys(current), ...Object.keys(next)])
  for (const key of keys) {
    if (!Object.is((current as Record<string, unknown>)[key], (next as Record<string, unknown>)[key])) return true
  }
  return false
}

export const useTradeStore = create<TradeState>((set, get) => ({
  ...INITIAL,

  setSelectedMarket: (m) => set({ selectedMarket: m, lastClosedTrade: null }),
  openMarketPicker: () => set({ showMarketPicker: true, selectedMarket: null, lastClosedTrade: null }),
  closeMarketPicker: () => set({ showMarketPicker: false }),
  startEthTrade: () => set({
    selectedMarket: V1_PRIMARY_MARKET_KEY,
    showMarketPicker: false,
    lastClosedTrade: null,
  }),
  setDirection: (d) => set({ direction: d }),
  setRiskUsd: (a) => set({ riskUsd: clampRiskUsd(a) }),
  setLeverage: (l) => set({ leverage: l }),
  setChartTimeframe: (t) => set({ chartTimeframe: t }),
  setLiveChartTimeframe: (t) => set({ liveChartTimeframe: t }),
  setHasAcknowledgedRisk: (v) => set({ hasAcknowledgedRisk: v }),
  setOrderPhase: (p) => set({ orderPhase: p }),
  setOrderError: (e) => set({ orderError: e, orderPhase: e ? "failed" : get().orderPhase }),
  setClosePhase: (p) => set({ closePhase: p }),
  setCloseError: (e) => set({ closeError: e, closePhase: e ? "failed" : get().closePhase }),
  setActivePosition: (p) => set({ activePosition: p }),
  updateActivePosition: (partial) => {
    const pos = get().activePosition
    if (!pos) return
    const next = { ...pos, ...partial }
    if (hasMeaningfulChange(pos, next)) set({ activePosition: next })
  },
  setLastClosedTrade: (p) => set({ lastClosedTrade: p }),
  reset: () => set(INITIAL),
  resetOrderFlow: () => set({
    orderPhase: "idle",
    orderError: null,
    closePhase: "idle",
    closeError: null,
  }),
  tradeAgain: () => set({
    selectedMarket: null,
    showMarketPicker: false,
    direction: "up",
    riskUsd: MIN_RISK_USD,
    leverage: DEFAULT_LEVERAGE,
    orderPhase: "idle",
    orderError: null,
    closePhase: "idle",
    closeError: null,
    activePosition: null,
    lastClosedTrade: null,
  }),
}))
