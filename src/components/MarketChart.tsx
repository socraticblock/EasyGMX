"use client"

import { createChart, AreaSeries, type IChartApi, type ISeriesApi } from "lightweight-charts"
import { useEffect, useMemo, useRef, type CSSProperties } from "react"
import { TIMEFRAMES, getTimeframeLabel, type Timeframe, useMarketCandles } from "@/lib/gmxCandles"
import type { MarketKey } from "@/lib/contracts"

type ChartHeight = number | string

function measuredHeight(el: HTMLDivElement, fallback: ChartHeight): number {
  const height = Math.round(el.getBoundingClientRect().height)
  if (height > 0) return height
  return typeof fallback === "number" ? fallback : 260
}

function formatUsd(n: number): string {
  if (!Number.isFinite(n) || n <= 0) return "-"
  if (n >= 1) return n.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })
  return n.toFixed(6)
}

function formatAxisPrice(n: number): string {
  if (!Number.isFinite(n) || n <= 0) return ""
  if (n >= 1000) return `$${n.toLocaleString("en-US", { maximumFractionDigits: 0 })}`
  if (n >= 10) return `$${n.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
  if (n >= 1) return `$${n.toFixed(3)}`
  return `$${n.toFixed(5)}`
}

function formatTickTime(value: unknown, timeframe: Timeframe): string {
  const seconds = typeof value === "number" ? value : Number(value)
  if (!Number.isFinite(seconds)) return ""
  const date = new Date(seconds * 1000)
  if (timeframe === "1m" || timeframe === "5m" || timeframe === "15m" || timeframe === "1h") {
    return date.toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit", hour12: false })
  }
  if (timeframe === "4h" || timeframe === "1D") {
    return date.toLocaleDateString("en-US", { month: "short", day: "numeric" })
  }
  return date.toLocaleDateString("en-US", { month: "short", year: "2-digit" })
}

function rangeSpacing(timeframe: Timeframe): number {
  switch (timeframe) {
    case "1m": return 5
    case "5m": return 5
    case "15m": return 5
    case "1h": return 5
    case "4h": return 4
    case "1D": return 4
    default: return 7
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
      case "ALL": return 365
    }
  })()
  return Math.max(20, Math.min(pointCount, preferred))
}

function applyPaddedVisibleRange(chart: IChartApi, timeframe: Timeframe, pointCount: number) {
  if (pointCount <= 0) return
  const visiblePoints = initialVisiblePoints(timeframe, pointCount)
  const rightPadding = Math.max(6, Math.min(18, Math.round(visiblePoints * 0.08)))
  const leftPadding = Math.max(4, Math.min(12, Math.round(visiblePoints * 0.04)))
  const to = pointCount - 1 + rightPadding
  const from = Math.max(-leftPadding, pointCount - visiblePoints - leftPadding)
  chart.timeScale().setVisibleLogicalRange({ from, to })
}

export function MarketChart({
  marketKey,
  timeframe,
  onTimeframeChange,
  entryPrice,
  isLong = true,
  chartHeight = 260,
}: {
  marketKey: MarketKey | null
  timeframe: Timeframe
  onTimeframeChange: (t: Timeframe) => void
  entryPrice?: number
  isLong?: boolean
  chartHeight?: ChartHeight
}) {
  const containerRef = useRef<HTMLDivElement>(null)
  const chartRef = useRef<IChartApi | null>(null)
  const seriesRef = useRef<ISeriesApi<"Area"> | null>(null)
  const entryLineRef = useRef<ReturnType<ISeriesApi<"Area">["createPriceLine"]> | null>(null)
  const fittedKeyRef = useRef<string | null>(null)
  const { data: candles = [], isLoading, error, isFetching } = useMarketCandles(marketKey, timeframe)

  const latest = candles[candles.length - 1]
  const firstVisibleBase = candles[Math.max(0, candles.length - initialVisiblePoints(timeframe, candles.length))]
  const priceChange = latest && firstVisibleBase ? latest.close - firstVisibleBase.close : 0
  const priceChangePercent = latest && firstVisibleBase && firstVisibleBase.close > 0 ? (priceChange / firstVisibleBase.close) * 100 : 0
  const positiveRange = priceChange >= 0
  const lineColor = positiveRange ? "#22c55e" : "#ef4444"
  const fillColor = positiveRange ? "rgba(34,197,94,0.20)" : "rgba(239,68,68,0.18)"

  const chartData = useMemo(() => candles.map((c) => ({ time: c.time as any, value: c.close })), [candles])

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
      grid: { vertLines: { color: "rgba(126,139,173,0.05)" }, horzLines: { color: "rgba(126,139,173,0.06)" } },
      width: container.clientWidth,
      height: measuredHeight(container, chartHeight),
      localization: { priceFormatter: (price: number) => formatAxisPrice(price) },
      timeScale: {
        timeVisible: timeframe === "1m" || timeframe === "5m" || timeframe === "15m" || timeframe === "1h",
        secondsVisible: false,
        borderVisible: false,
        rightOffset: 8,
        barSpacing: rangeSpacing(timeframe),
        minBarSpacing: 2,
        tickMarkFormatter: (time: unknown) => formatTickTime(time, timeframe),
      },
      rightPriceScale: { borderVisible: false, scaleMargins: { top: 0.16, bottom: 0.18 } },
      crosshair: { mode: 0 },
    })
    const series = chart.addSeries(AreaSeries, {
      lineColor,
      topColor: fillColor,
      bottomColor: "rgba(10,10,15,0)",
      lineWidth: 3,
      priceLineVisible: true,
      priceLineColor: lineColor,
      lastValueVisible: true,
      crosshairMarkerVisible: true,
      crosshairMarkerRadius: 4,
      crosshairMarkerBorderColor: "#0a0a0f",
      crosshairMarkerBackgroundColor: lineColor,
    })

    chartRef.current = chart
    seriesRef.current = series

    const resize = () => chart.applyOptions({ width: container.clientWidth, height: measuredHeight(container, chartHeight) })
    const observer = new ResizeObserver(resize)
    observer.observe(container)
    resize()

    return () => {
      observer.disconnect()
      chart.remove()
      chartRef.current = null
      seriesRef.current = null
      entryLineRef.current = null
      fittedKeyRef.current = null
    }
  }, [])

  useEffect(() => {
    if (!chartRef.current || !containerRef.current) return
    chartRef.current.applyOptions({ height: measuredHeight(containerRef.current, chartHeight) })
  }, [chartHeight])

  useEffect(() => {
    seriesRef.current?.applyOptions({ lineColor, topColor: fillColor, priceLineColor: lineColor, crosshairMarkerBackgroundColor: lineColor })
  }, [lineColor, fillColor])

  useEffect(() => {
    chartRef.current?.applyOptions({
      timeScale: {
        timeVisible: timeframe === "1m" || timeframe === "5m" || timeframe === "15m" || timeframe === "1h",
        secondsVisible: false,
        borderVisible: false,
        rightOffset: 8,
        barSpacing: rangeSpacing(timeframe),
        minBarSpacing: 2,
        tickMarkFormatter: (time: unknown) => formatTickTime(time, timeframe),
      },
    })
  }, [timeframe])

  useEffect(() => {
    if (!seriesRef.current || !chartRef.current) return
    seriesRef.current.setData(chartData)
    if (entryLineRef.current) {
      seriesRef.current.removePriceLine(entryLineRef.current)
      entryLineRef.current = null
    }
    if (entryPrice && entryPrice > 0) {
      entryLineRef.current = seriesRef.current.createPriceLine({ price: entryPrice, color: "rgba(148,163,184,0.55)", lineWidth: 1, lineStyle: 2, title: "entry" })
    }
    const fitKey = `${marketKey ?? "none"}:${timeframe}:${chartData.length}`
    if (chartData.length > 0 && fittedKeyRef.current !== fitKey) {
      applyPaddedVisibleRange(chartRef.current, timeframe, chartData.length)
      fittedKeyRef.current = fitKey
    }
  }, [chartData, entryPrice, marketKey, timeframe])

  const chartStyle: CSSProperties = { height: chartHeight }
  const directionText = priceChange >= 0 ? "+" : "-"

  return (
    <div className="relative rounded-2xl border border-[#1e1e30] bg-[#07070c] p-3 shadow-[0_24px_80px_rgba(0,0,0,0.28)] sm:p-4">
      <div className="pointer-events-none absolute inset-0 rounded-2xl opacity-90" style={{ background: `radial-gradient(circle at 20% 0%, ${fillColor}, transparent 32%), linear-gradient(180deg, rgba(18,18,28,0.92), rgba(7,7,12,0.98))` }} />
      <div className="relative z-10">
        <div className="mb-3 flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <div className="flex items-center gap-2">
              <span className="text-xs font-bold uppercase tracking-[0.22em] text-muted-foreground">GMX oracle</span>
              {isFetching && <span className="h-1.5 w-1.5 rounded-full bg-[#418cf5] animate-pulse" />}
            </div>
            <div className="mt-1 flex flex-wrap items-baseline gap-2">
              <span className="font-mono text-2xl font-bold tabular-nums text-foreground sm:text-3xl">${formatUsd(latest?.close ?? 0)}</span>
              {candles.length > 1 && (
                <span className={`font-mono text-sm font-semibold tabular-nums ${positiveRange ? "text-[#22c55e]" : "text-[#ef4444]"}`}>
                  {directionText}${formatUsd(Math.abs(priceChange))} · {directionText}{Math.abs(priceChangePercent).toFixed(2)}%
                </span>
              )}
            </div>
            <div className="mt-1 text-[11px] text-muted-foreground">{getTimeframeLabel(timeframe)}</div>
          </div>
          <div className="flex max-w-full gap-1 overflow-x-auto rounded-xl border border-[#1e1e30] bg-[#0a0a0f]/70 p-1">
            {TIMEFRAMES.map((t) => (
              <button type="button" key={t} onClick={() => onTimeframeChange(t)} className={`shrink-0 rounded-lg px-2.5 py-1.5 text-[11px] font-bold transition-all ${timeframe === t ? "bg-[#418cf5]/18 text-[#7bb3ff] shadow-[inset_0_0_0_1px_rgba(65,140,245,0.25)]" : "text-muted-foreground hover:bg-[#12121a] hover:text-foreground"}`}>
                {t}
              </button>
            ))}
          </div>
        </div>
        <div className="relative rounded-xl border border-[#10111d] bg-[#050509]/45 p-1.5 overflow-hidden">
          <div ref={containerRef} className="w-full" style={chartStyle} />
          {(isLoading || error || candles.length === 0) && (
            <div className="absolute inset-0 flex items-center justify-center rounded-xl bg-[#050509]/45 text-xs text-muted-foreground pointer-events-none">
              {error ? "Chart data unavailable" : "Loading chart..."}
            </div>
          )}
        </div>
        <div className="mt-3 flex items-center justify-between gap-3 text-[11px] text-muted-foreground">
          <span>Drag to inspect loaded history. Switch interval for a wider or faster view.</span>
          <button type="button" onClick={() => chartRef.current && applyPaddedVisibleRange(chartRef.current, timeframe, chartData.length)} className="shrink-0 rounded-lg border border-[#418cf5]/20 bg-[#418cf5]/10 px-2.5 py-1 font-semibold text-[#7bb3ff] transition-colors hover:bg-[#418cf5]/15">
            Live
          </button>
        </div>
      </div>
    </div>
  )
}
