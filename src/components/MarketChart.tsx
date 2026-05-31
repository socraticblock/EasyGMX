"use client"

import {
  CandlestickSeries,
  LineStyle,
  createChart,
  type CandlestickData,
  type IChartApi,
  type ISeriesApi,
  type Time,
} from "lightweight-charts"
import { useCallback, useEffect, useMemo, useRef, useState, type CSSProperties, type MutableRefObject } from "react"
import { TIMEFRAMES, type ChartTimeframeMode, type EasyCandle, type Timeframe, useMarketCandles } from "@/lib/gmxCandles"
import { MARKET_LIST, type MarketKey } from "@/lib/contracts"

type ChartHeight = number | string

type MarketChartProps = {
  marketKey: MarketKey | null
  timeframe: ChartTimeframeMode
  onTimeframeChange: (t: ChartTimeframeMode) => void
  screen?: "trade-setup" | "live-position"
  positionOpenedAt?: number
  entryPrice?: number
  liquidationPrice?: number
  previewEntryPrice?: number
  previewLiquidationPrice?: number
  isLong?: boolean
  chartHeight?: ChartHeight
}

type ChartFreshness = "live" | "updating" | "delayed" | "unavailable"
type ChartViewMode = "candles" | "risk"
type PriceLine = ReturnType<ISeriesApi<"Candlestick">["createPriceLine"]>

function measuredHeight(el: HTMLDivElement, fallback: ChartHeight): number {
  const height = Math.round(el.getBoundingClientRect().height)
  if (height > 0) return height
  return typeof fallback === "number" ? fallback : 260
}

function formatAxisPrice(n: number): string {
  if (!Number.isFinite(n) || n <= 0) return ""
  if (n >= 1000) return `$${n.toLocaleString("en-US", { maximumFractionDigits: 0 })}`
  if (n >= 10) return `$${n.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
  if (n >= 1) return `$${n.toFixed(3)}`
  return `$${n.toFixed(5)}`
}

function formatCandlePrice(n: number | undefined): string {
  if (!Number.isFinite(n) || !n) return "-"
  if (n >= 1000) return n.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })
  if (n >= 1) return n.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 4 })
  return n.toFixed(6)
}

function formatPercent(n: number): string {
  if (!Number.isFinite(n)) return "-"
  const sign = n > 0 ? "+" : ""
  return `${sign}${n.toFixed(2)}%`
}

function getTimeframeButtonLabel(timeframe: Timeframe): string {
  switch (timeframe) {
    case "1D": return "D"
    case "1W": return "W"
    case "1M": return "M"
    default: return timeframe
  }
}

function resolveAutoTimeframe({
  screen,
  positionOpenedAt,
}: {
  screen: "trade-setup" | "live-position"
  positionOpenedAt?: number
}): Timeframe {
  if (screen === "trade-setup") return "15m"
  if (!positionOpenedAt) return "15m"

  const ageMs = Date.now() - positionOpenedAt
  if (ageMs < 6 * 60 * 60 * 1000) return "15m"
  if (ageMs < 2 * 24 * 60 * 60 * 1000) return "1h"
  return "4h"
}

function isValidPrice(value: number | undefined | null): value is number {
  return typeof value === "number" && Number.isFinite(value) && value > 0
}

function isNearPrice(a: number | undefined, b: number | undefined, thresholdPercent = 0.15): boolean {
  if (!isValidPrice(a) || !isValidPrice(b)) return false
  return Math.abs(a - b) / b * 100 <= thresholdPercent
}

function isNearCurrentPrice(price: number | undefined, currentPrice: number | undefined, thresholdPercent = 8): boolean {
  if (!isValidPrice(price) || !isValidPrice(currentPrice)) return false
  return Math.abs(price - currentPrice) / currentPrice * 100 <= thresholdPercent
}

function getAutoscaleRiskPrices({
  chartViewMode,
  currentPrice,
  entryPrice,
  liquidationPrice,
  previewEntryPrice,
  previewLiquidationPrice,
}: {
  chartViewMode: ChartViewMode
  currentPrice?: number
  entryPrice?: number
  liquidationPrice?: number
  previewEntryPrice?: number
  previewLiquidationPrice?: number
}) {
  const all = [entryPrice, liquidationPrice, previewLiquidationPrice, previewEntryPrice].filter(isValidPrice)
  if (chartViewMode === "risk") return all
  if (!isValidPrice(currentPrice)) return []
  return all.filter((price) => isNearCurrentPrice(price, currentPrice, 8))
}

function getOffscreenRiskMarker({
  price,
  currentPrice,
  chartViewMode,
  label,
}: {
  price?: number
  currentPrice?: number
  chartViewMode: ChartViewMode
  label: string
}): null | { direction: "above" | "below"; text: string } {
  if (chartViewMode !== "candles") return null
  if (!isValidPrice(price) || !isValidPrice(currentPrice)) return null
  if (isNearCurrentPrice(price, currentPrice, 8)) return null

  return {
    direction: price > currentPrice ? "above" : "below",
    text: `${label} ${price > currentPrice ? "above" : "below"} $${formatCandlePrice(price)}`,
  }
}

function useDelayedBoolean(value: boolean, delayMs = 400) {
  const [delayed, setDelayed] = useState(false)

  useEffect(() => {
    if (!value) {
      setDelayed(false)
      return
    }

    const timer = window.setTimeout(() => setDelayed(true), delayMs)
    return () => window.clearTimeout(timer)
  }, [value, delayMs])

  return delayed
}

function getLoadedHistoryLabel(timeframe: Timeframe): string {
  switch (timeframe) {
    case "1m": return "Loaded 12 hours"
    case "5m": return "Loaded 3 days"
    case "15m": return "Loaded 10 days"
    case "1h": return "Loaded up to 60 days"
    case "4h": return "Loaded up to 1 year"
    case "1D": return "Loaded daily history"
    case "1W": return "Loaded weekly history"
    case "1M": return "Loaded monthly history"
    default: return "Loaded history"
  }
}

function formatTickTime(value: unknown, timeframe: Timeframe): string {
  const seconds = typeof value === "number" ? value : Number(value)
  if (!Number.isFinite(seconds)) return ""
  const date = new Date(seconds * 1000)

  switch (timeframe) {
    case "1m":
    case "5m":
    case "15m":
      return date.toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit", hour12: false })
    case "1h":
      return `${date.toLocaleDateString("en-US", { month: "short", day: "numeric" })} ${date.toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit", hour12: false })}`
    case "4h":
    case "1D":
      return date.toLocaleDateString("en-US", { month: "short", day: "numeric" })
    case "1W":
      return date.toLocaleDateString("en-US", { month: "short", year: "2-digit" })
    case "1M":
      return date.toLocaleDateString("en-US", { year: "numeric" })
    default:
      return date.toLocaleDateString("en-US", { month: "short", day: "numeric" })
  }
}

function rangeSpacing(timeframe: Timeframe): number {
  switch (timeframe) {
    case "1m":
    case "5m":
    case "15m":
    case "1h":
      return 5
    case "4h":
    case "1D":
      return 4
    default:
      return 7
  }
}

function initialVisiblePoints(timeframe: Timeframe, pointCount: number): number {
  const preferred = (() => {
    switch (timeframe) {
      case "1m": return 120
      case "5m": return 144
      case "15m": return 192
      case "1h": return 168
      case "4h": return 180
      case "1D": return 220
      case "1W": return 156
      case "1M": return 120
      default: return 180
    }
  })()

  return Math.max(20, Math.min(pointCount, preferred))
}

function applyInitialVisibleRange(chart: IChartApi, timeframe: Timeframe, pointCount: number) {
  if (pointCount <= 0) return
  const visiblePoints = initialVisiblePoints(timeframe, pointCount)
  const rightPadding = Math.max(8, Math.min(24, Math.round(visiblePoints * 0.10)))
  const leftPadding = Math.max(4, Math.min(14, Math.round(visiblePoints * 0.04)))
  const to = pointCount - 1 + rightPadding
  const from = Math.max(-leftPadding, pointCount - visiblePoints - leftPadding)
  chart.timeScale().setVisibleLogicalRange({ from, to })
}

function formatLastUpdated(timestampSeconds?: number): string {
  if (!timestampSeconds) return "Not updated"
  return new Date(timestampSeconds * 1000).toLocaleTimeString("en-US", {
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: false,
  })
}

function getChartFreshness({
  latestTime,
  timeframe,
  isFetching,
  hasError,
}: {
  latestTime?: number
  timeframe: Timeframe
  isFetching: boolean
  hasError: boolean
}): ChartFreshness {
  if (hasError) return "unavailable"
  if (isFetching) return "updating"
  if (!latestTime) return "unavailable"

  const ageSeconds = Date.now() / 1000 - latestTime
  const maxFreshAge = (() => {
    switch (timeframe) {
      case "1m": return 180
      case "5m": return 600
      case "15m": return 1800
      case "1h": return 7200
      default: return 86400
    }
  })()

  return ageSeconds > maxFreshAge ? "delayed" : "live"
}

function getFreshnessLabel(freshness: ChartFreshness): string {
  switch (freshness) {
    case "live": return "Live"
    case "updating": return "Updating"
    case "delayed": return "Delayed"
    case "unavailable": return "Unavailable"
  }
}

function removeLine(series: ISeriesApi<"Candlestick">, ref: MutableRefObject<PriceLine | null>) {
  if (!ref.current) return
  series.removePriceLine(ref.current)
  ref.current = null
}

export function MarketChart(props: MarketChartProps) {
  const [isFullscreen, setIsFullscreen] = useState(false)
  const [chartViewMode, setChartViewMode] = useState<ChartViewMode>("candles")

  return (
    <>
      <MarketChartContent
        {...props}
        chartViewMode={chartViewMode}
        onChartViewModeChange={setChartViewMode}
        isFullscreen={false}
        onOpenFullscreen={() => setIsFullscreen(true)}
      />

      {isFullscreen && (
        <div className="fixed inset-0 z-50 overflow-hidden bg-[#050509] p-3">
          <div className="mb-3 flex items-center justify-between gap-3">
            <div className="text-sm font-semibold text-foreground">Chart</div>
            <button
              type="button"
              onClick={() => setIsFullscreen(false)}
              className="rounded-md border border-[#1e1e30] px-3 py-1.5 text-xs font-semibold text-muted-foreground hover:text-foreground"
            >
              Close
            </button>
          </div>
          <MarketChartContent
            {...props}
            chartViewMode={chartViewMode}
            onChartViewModeChange={setChartViewMode}
            isFullscreen
            chartHeight="calc(100vh - 140px)"
            onOpenFullscreen={() => {}}
          />
        </div>
      )}
    </>
  )
}

function MarketChartContent({
  marketKey,
  timeframe,
  onTimeframeChange,
  screen = "trade-setup",
  positionOpenedAt,
  entryPrice,
  liquidationPrice,
  previewEntryPrice,
  previewLiquidationPrice,
  chartHeight = 260,
  chartViewMode,
  onChartViewModeChange,
  isFullscreen,
  onOpenFullscreen,
}: MarketChartProps & {
  chartViewMode: ChartViewMode
  onChartViewModeChange: (mode: ChartViewMode) => void
  isFullscreen: boolean
  onOpenFullscreen: () => void
}) {
  const containerRef = useRef<HTMLDivElement>(null)
  const chartRef = useRef<IChartApi | null>(null)
  const seriesRef = useRef<ISeriesApi<"Candlestick"> | null>(null)
  const entryLineRef = useRef<PriceLine | null>(null)
  const liquidationLineRef = useRef<PriceLine | null>(null)
  const previewEntryLineRef = useRef<PriceLine | null>(null)
  const previewLiquidationLineRef = useRef<PriceLine | null>(null)
  const lastFitContextKeyRef = useRef<string | null>(null)
  const autoscaleRiskPricesRef = useRef<number[]>([])
  const chartViewModeRef = useRef<ChartViewMode>("candles")
  const [hoveredCandle, setHoveredCandle] = useState<EasyCandle | null>(null)
  const resolvedTimeframe = timeframe === "auto"
    ? resolveAutoTimeframe({ screen, positionOpenedAt })
    : timeframe
  const { data: candles = [], isLoading, error, isFetching } = useMarketCandles(marketKey, resolvedTimeframe)

  const market = MARKET_LIST.find((m) => m.key === marketKey)
  const marketLabel = market?.symbol?.includes("/") ? market.symbol : `${market?.symbol ?? "Market"}/USD`
  const latest = candles[candles.length - 1]
  const displayCandle = hoveredCandle ?? latest ?? null
  const candleChange = displayCandle ? displayCandle.close - displayCandle.open : 0
  const candleChangePercent = displayCandle && displayCandle.open > 0 ? (candleChange / displayCandle.open) * 100 : 0
  const displayCandleUp = candleChange >= 0
  const latestCandleUp = latest ? latest.close >= latest.open : true
  const currentPriceColor = latestCandleUp ? "#22c55e" : "#ef4444"
  const showUpdating = useDelayedBoolean(isFetching, 400)
  const freshness = getChartFreshness({ latestTime: latest?.time, timeframe: resolvedTimeframe, isFetching: showUpdating, hasError: !!error })
  const shouldShowPreviewEntry = isValidPrice(previewEntryPrice) &&
    !isValidPrice(entryPrice) &&
    !isNearPrice(previewEntryPrice, latest?.close, 0.15)
  const shouldShowPreviewLiq = isValidPrice(previewLiquidationPrice) && !isValidPrice(liquidationPrice)
  const shouldRenderActualLiqLine = isValidPrice(liquidationPrice) &&
    (chartViewMode === "risk" || isNearCurrentPrice(liquidationPrice, latest?.close, 8))
  const shouldRenderPreviewLiqLine = shouldShowPreviewLiq &&
    (chartViewMode === "risk" || isNearCurrentPrice(previewLiquidationPrice, latest?.close, 8))
  const offscreenLiqMarker =
    getOffscreenRiskMarker({ price: liquidationPrice, currentPrice: latest?.close, chartViewMode, label: "Liq" }) ??
    getOffscreenRiskMarker({ price: previewLiquidationPrice, currentPrice: latest?.close, chartViewMode, label: "Preview Liq" })

  const autoscaleRiskPrices = useMemo(
    () => getAutoscaleRiskPrices({
      chartViewMode,
      currentPrice: latest?.close,
      entryPrice,
      liquidationPrice,
      previewEntryPrice: shouldShowPreviewEntry ? previewEntryPrice : undefined,
      previewLiquidationPrice: shouldShowPreviewLiq ? previewLiquidationPrice : undefined,
    }),
    [
      chartViewMode,
      entryPrice,
      latest?.close,
      liquidationPrice,
      previewEntryPrice,
      previewLiquidationPrice,
      shouldShowPreviewEntry,
      shouldShowPreviewLiq,
    ],
  )

  const chartData = useMemo<CandlestickData<Time>[]>(
    () => candles.map((c) => ({ time: c.time as Time, open: c.open, high: c.high, low: c.low, close: c.close })),
    [candles],
  )

  useEffect(() => {
    chartViewModeRef.current = chartViewMode
    autoscaleRiskPricesRef.current = autoscaleRiskPrices
  }, [autoscaleRiskPrices, chartViewMode])

  useEffect(() => {
    if (!containerRef.current || chartRef.current) return
    const container = containerRef.current
    const chart = createChart(container, {
      layout: {
        background: { color: "transparent" },
        textColor: "#8d91a6",
        fontSize: 11,
        fontFamily: "ui-monospace, SFMono-Regular, Menlo, monospace",
      },
      grid: {
        vertLines: { color: "rgba(126,139,173,0.05)" },
        horzLines: { color: "rgba(126,139,173,0.06)" },
      },
      width: container.clientWidth,
      height: measuredHeight(container, chartHeight),
      localization: { priceFormatter: (price: number) => formatAxisPrice(price) },
      timeScale: {
        timeVisible: resolvedTimeframe === "1m" || resolvedTimeframe === "5m" || resolvedTimeframe === "15m" || resolvedTimeframe === "1h",
        secondsVisible: false,
        borderVisible: false,
        rightOffset: 8,
        barSpacing: rangeSpacing(resolvedTimeframe),
        minBarSpacing: 2,
        tickMarkFormatter: (time: unknown) => formatTickTime(time, resolvedTimeframe),
      },
      rightPriceScale: { autoScale: true, borderVisible: false, scaleMargins: { top: 0.14, bottom: 0.18 } },
      crosshair: { mode: 0 },
      handleScale: {
        mouseWheel: true,
        pinch: true,
        axisPressedMouseMove: { time: true, price: true },
        axisDoubleClickReset: { time: true, price: true },
      },
      handleScroll: {
        mouseWheel: true,
        pressedMouseMove: true,
        horzTouchDrag: true,
        vertTouchDrag: false,
      },
    })
    const series = chart.addSeries(CandlestickSeries, {
      upColor: "#22c55e",
      downColor: "#ef4444",
      wickUpColor: "#22c55e",
      wickDownColor: "#ef4444",
      borderVisible: false,
      priceLineVisible: true,
      lastValueVisible: true,
      priceLineColor: "#8d91a6",
      autoscaleInfoProvider: (original: () => any) => {
        const res = original()
        if (!res?.priceRange) return res

        const prices = autoscaleRiskPricesRef.current.filter(isValidPrice)
        if (!prices.length) return res

        const riskMin = Math.min(...prices)
        const riskMax = Math.max(...prices)
        const minValue = Math.min(res.priceRange.minValue, riskMin)
        const maxValue = Math.max(res.priceRange.maxValue, riskMax)
        const base = Math.max(Math.abs(maxValue), Math.abs(minValue), 1)
        const range = Math.max(maxValue - minValue, base * 0.002)
        const padding = range * (chartViewModeRef.current === "risk" ? 0.14 : 0.08)

        return {
          priceRange: {
            minValue: minValue - padding,
            maxValue: maxValue + padding,
          },
          margins: { above: 10, below: 14 },
        }
      },
    })

    chartRef.current = chart
    seriesRef.current = series

    const handleCrosshairMove = (param: any) => {
      if (!param.time || !seriesRef.current) {
        setHoveredCandle(null)
        return
      }

      const data = param.seriesData.get(seriesRef.current)
      if (!data || !("open" in data)) {
        setHoveredCandle(null)
        return
      }

      setHoveredCandle({
        time: typeof param.time === "number" ? param.time : latest?.time ?? 0,
        open: Number(data.open),
        high: Number(data.high),
        low: Number(data.low),
        close: Number(data.close),
      })
    }

    chart.subscribeCrosshairMove(handleCrosshairMove)

    const resize = () => {
      chart.applyOptions({ width: container.clientWidth, height: measuredHeight(container, chartHeight) })
    }
    const observer = new ResizeObserver(resize)
    observer.observe(container)
    resize()

    return () => {
      observer.disconnect()
      chart.unsubscribeCrosshairMove(handleCrosshairMove)
      chart.remove()
      chartRef.current = null
      seriesRef.current = null
      entryLineRef.current = null
      liquidationLineRef.current = null
      previewEntryLineRef.current = null
      previewLiquidationLineRef.current = null
      lastFitContextKeyRef.current = null
    }
  }, [])

  useEffect(() => {
    if (!chartRef.current || !containerRef.current) return
    chartRef.current.applyOptions({ height: measuredHeight(containerRef.current, chartHeight) })
  }, [chartHeight])

  useEffect(() => {
    chartRef.current?.applyOptions({
      timeScale: {
        timeVisible: resolvedTimeframe === "1m" || resolvedTimeframe === "5m" || resolvedTimeframe === "15m" || resolvedTimeframe === "1h",
        secondsVisible: false,
        borderVisible: false,
        rightOffset: 8,
        barSpacing: rangeSpacing(resolvedTimeframe),
        minBarSpacing: 2,
        tickMarkFormatter: (time: unknown) => formatTickTime(time, resolvedTimeframe),
      },
    })
  }, [resolvedTimeframe])

  useEffect(() => {
    seriesRef.current?.applyOptions({ priceLineColor: currentPriceColor })
  }, [currentPriceColor])

  const fitChartView = useCallback(() => {
    if (!chartRef.current || !seriesRef.current || !chartData.length) return

    applyInitialVisibleRange(chartRef.current, resolvedTimeframe, chartData.length)
    chartRef.current.priceScale("right").applyOptions({ autoScale: true })

    requestAnimationFrame(() => {
      chartRef.current?.priceScale("right").applyOptions({ autoScale: true })
    })
  }, [chartData.length, resolvedTimeframe])

  const handleFitClick = () => {
    if (chartViewMode === "candles") {
      fitChartView()
      return
    }
    onChartViewModeChange("candles")
  }

  const handleRiskClick = () => {
    if (chartViewMode === "risk") {
      fitChartView()
      return
    }
    onChartViewModeChange("risk")
  }

  useEffect(() => {
    const chart = chartRef.current
    const series = seriesRef.current
    if (!chart || !series) return

    series.setData(chartData)
    removeLine(series, entryLineRef)
    removeLine(series, liquidationLineRef)
    removeLine(series, previewEntryLineRef)
    removeLine(series, previewLiquidationLineRef)

    if (isValidPrice(entryPrice)) {
      entryLineRef.current = series.createPriceLine({
        price: entryPrice,
        color: "rgba(148,163,184,0.80)",
        lineWidth: 1,
        lineStyle: LineStyle.Dashed,
        axisLabelVisible: true,
        title: "Entry",
      })
    }

    if (shouldRenderActualLiqLine) {
      liquidationLineRef.current = series.createPriceLine({
        price: liquidationPrice as number,
        color: "rgba(239,68,68,0.90)",
        lineWidth: 1,
        lineStyle: LineStyle.Dashed,
        axisLabelVisible: true,
        title: "Liq",
      })
    }

    if (shouldShowPreviewEntry) {
      previewEntryLineRef.current = series.createPriceLine({
        price: previewEntryPrice as number,
        color: "rgba(96,165,250,0.45)",
        lineWidth: 1,
        lineStyle: LineStyle.Dotted,
        axisLabelVisible: false,
        title: "Preview Entry",
      })
    }

    if (shouldRenderPreviewLiqLine) {
      previewLiquidationLineRef.current = series.createPriceLine({
        price: previewLiquidationPrice as number,
        color: "rgba(248,113,113,0.80)",
        lineWidth: 1,
        lineStyle: LineStyle.Dotted,
        axisLabelVisible: true,
        title: "Preview Liq",
      })
    }
  }, [
    chartData,
    entryPrice,
    liquidationPrice,
    previewEntryPrice,
    previewLiquidationPrice,
    shouldRenderActualLiqLine,
    shouldRenderPreviewLiqLine,
    shouldShowPreviewEntry,
  ])

  const fitContextKey = [
    marketKey ?? "none",
    resolvedTimeframe,
    chartData.length,
    entryPrice ?? "no-entry",
    liquidationPrice ?? "no-liq",
    shouldShowPreviewEntry ? previewEntryPrice : "no-preview-entry",
    shouldShowPreviewLiq ? previewLiquidationPrice : "no-preview-liq",
    chartViewMode,
    isFullscreen ? "fullscreen" : "normal",
  ].join(":")

  useEffect(() => {
    if (!chartRef.current || !seriesRef.current || !chartData.length) return
    if (lastFitContextKeyRef.current === fitContextKey) return

    fitChartView()
    lastFitContextKeyRef.current = fitContextKey
  }, [chartData.length, fitChartView, fitContextKey])

  useEffect(() => {
    if (!isFullscreen) return
    requestAnimationFrame(() => {
      requestAnimationFrame(() => {
        fitChartView()
      })
    })
  }, [isFullscreen, fitChartView])

  const chartStyle: CSSProperties = { height: chartHeight }

  return (
    <div className="relative overflow-hidden rounded-2xl border border-[#1e1e30] bg-[#07070c] p-3 shadow-[0_24px_80px_rgba(0,0,0,0.28)] sm:p-4">
      <div
        className="pointer-events-none absolute inset-0 rounded-2xl opacity-90"
        style={{ background: "linear-gradient(180deg, rgba(18,18,28,0.92), rgba(7,7,12,0.98))" }}
      />
      <div className="relative z-10">
        <div className="mb-3 flex flex-col gap-3">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div className="flex flex-wrap items-center gap-2">
              <span className="text-[12px] font-semibold text-foreground sm:text-[13px]">{marketLabel} · GMX Oracle Price</span>
              <span
                className={`rounded-full px-2 py-0.5 text-[10px] font-semibold ${
                  freshness === "live"
                    ? "bg-[#22c55e]/10 text-[#22c55e]"
                    : freshness === "updating"
                      ? "bg-[#418cf5]/10 text-[#7bb3ff]"
                      : freshness === "delayed"
                        ? "bg-yellow-500/10 text-yellow-300"
                        : "bg-[#ef4444]/10 text-[#ef4444]"
                }`}
              >
                {getFreshnessLabel(freshness)}
              </span>
              {isFetching && <span className="h-1.5 w-1.5 rounded-full bg-[#418cf5] animate-pulse" />}
            </div>
            {!isFullscreen && (
              <button
                type="button"
                onClick={onOpenFullscreen}
                className="rounded-md border border-[#1e1e30] bg-[#0a0a0f]/70 px-2 py-1 text-[11px] font-semibold text-muted-foreground hover:text-foreground sm:hidden"
              >
                Expand
              </button>
            )}
          </div>

          <div className="flex flex-wrap items-center gap-x-3 gap-y-1 font-mono text-[11px] leading-5 text-[#a9aec3] tabular-nums sm:text-xs">
            <span>Start {formatCandlePrice(displayCandle?.open)}</span>
            <span>High {formatCandlePrice(displayCandle?.high)}</span>
            <span>Low {formatCandlePrice(displayCandle?.low)}</span>
            <span className="text-foreground">End {formatCandlePrice(displayCandle?.close)}</span>
            <span className={displayCandleUp ? "text-[#22c55e]" : "text-[#ef4444]"}>{formatPercent(candleChangePercent)}</span>
          </div>

          <div className="flex flex-wrap items-center gap-1">
            <button
              type="button"
              onClick={() => onTimeframeChange("auto")}
              className={`rounded-md px-2 py-1 text-[11px] font-semibold transition-colors ${
                timeframe === "auto"
                  ? "bg-[#1f2937] text-white"
                  : "text-muted-foreground hover:bg-[#111827] hover:text-foreground"
              }`}
            >
              Auto
            </button>
            {TIMEFRAMES.map((t) => (
              <button
                type="button"
                key={t}
                onClick={() => onTimeframeChange(t)}
                className={`rounded-md px-2 py-1 text-[11px] font-semibold transition-colors ${
                  timeframe === t
                    ? "bg-[#1f2937] text-white"
                    : "text-muted-foreground hover:bg-[#111827] hover:text-foreground"
                }`}
              >
                {getTimeframeButtonLabel(t)}
              </button>
            ))}
          </div>
        </div>

        <div className="relative overflow-hidden rounded-xl border border-[#10111d] bg-[#050509]/45 p-1.5">
          <div ref={containerRef} className="w-full" style={chartStyle} />
          {offscreenLiqMarker && (
            <div
              className={`pointer-events-none absolute left-3 z-20 rounded-md border border-[#ef4444]/20 bg-[#2a0d12]/90 px-2 py-1 text-[11px] font-semibold text-[#fca5a5] ${
                offscreenLiqMarker.direction === "above" ? "top-3" : "bottom-3"
              }`}
            >
              {offscreenLiqMarker.text}
            </div>
          )}
          {(isLoading || error || candles.length === 0) && (
            <div className="pointer-events-none absolute inset-0 flex items-center justify-center rounded-xl bg-[#050509]/70 text-xs text-muted-foreground">
              {error ? "GMX chart data unavailable" : "Loading GMX chart data..."}
            </div>
          )}
        </div>

        <div className="mt-2 flex items-center justify-between gap-3 text-[11px] text-muted-foreground">
          <span>
            {timeframe === "auto" ? `Auto · ${resolvedTimeframe} view` : `${getTimeframeButtonLabel(resolvedTimeframe)} view`}
            {" · "}
            {getLoadedHistoryLabel(resolvedTimeframe)}
            {latest?.time ? ` · Last updated ${formatLastUpdated(latest.time)}` : ""}
          </span>
          <div className="flex shrink-0 items-center gap-1">
            <button
              type="button"
              onClick={handleFitClick}
              className={`rounded-md border px-2 py-1 font-semibold transition-colors ${
                chartViewMode === "candles"
                  ? "border-[#418cf5]/30 bg-[#418cf5]/15 text-[#7bb3ff]"
                  : "border-[#418cf5]/15 bg-[#418cf5]/5 text-[#7bb3ff]/75 hover:bg-[#418cf5]/12"
              }`}
            >
              Fit
            </button>
            <button
              type="button"
              onClick={handleRiskClick}
              className={`rounded-md border px-2 py-1 font-semibold transition-colors ${
                chartViewMode === "risk"
                  ? "border-[#ef4444]/30 bg-[#ef4444]/15 text-[#fca5a5]"
                  : "border-[#ef4444]/15 bg-[#ef4444]/5 text-[#fca5a5]/75 hover:bg-[#ef4444]/12"
              }`}
            >
              Risk
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
