"use client"

import { createChart, AreaSeries, type IChartApi, type ISeriesApi } from "lightweight-charts"
import { useEffect, useRef } from "react"
import { TIMEFRAMES, type Timeframe, useMarketCandles } from "@/lib/gmxCandles"
import type { MarketKey } from "@/lib/contracts"

export function MarketChart({
  marketKey,
  timeframe,
  onTimeframeChange,
  entryPrice,
  isLong = true,
  chartHeight = 220,
}: {
  marketKey: MarketKey | null
  timeframe: Timeframe
  onTimeframeChange: (t: Timeframe) => void
  entryPrice?: number
  isLong?: boolean
  chartHeight?: number
}) {
  const containerRef = useRef<HTMLDivElement>(null)
  const chartRef = useRef<IChartApi | null>(null)
  const seriesRef = useRef<ISeriesApi<"Area"> | null>(null)
  const entryLineRef = useRef<ReturnType<ISeriesApi<"Area">["createPriceLine"]> | null>(null)
  const { data: candles = [], isLoading, error } = useMarketCandles(marketKey, timeframe)

  useEffect(() => {
    if (!containerRef.current || chartRef.current) return

    const lineColor = isLong ? "#22c55e" : "#ef4444"
    const chart = createChart(containerRef.current, {
      layout: { background: { color: "#0a0a0f" }, textColor: "#7d8092", fontSize: 11 },
      grid: { vertLines: { color: "#1e1e3030" }, horzLines: { color: "#1e1e3030" } },
      width: containerRef.current.clientWidth,
      height: chartHeight,
      timeScale: { timeVisible: true, secondsVisible: timeframe === "1m" || timeframe === "5m", borderColor: "#1e1e30" },
      rightPriceScale: { borderColor: "#1e1e30" },
      crosshair: { mode: 0 },
    })
    const series = chart.addSeries(AreaSeries, {
      lineColor,
      topColor: `${lineColor}18`,
      bottomColor: "transparent",
      lineWidth: 2,
      priceLineVisible: false,
    })

    chartRef.current = chart
    seriesRef.current = series

    const onResize = () => {
      if (containerRef.current) chart.applyOptions({ width: containerRef.current.clientWidth })
    }
    window.addEventListener("resize", onResize)
    return () => {
      window.removeEventListener("resize", onResize)
      chart.remove()
      chartRef.current = null
      seriesRef.current = null
    }
  }, [])

  useEffect(() => {
    chartRef.current?.applyOptions({ height: chartHeight })
  }, [chartHeight])

  useEffect(() => {
    const lineColor = isLong ? "#22c55e" : "#ef4444"
    seriesRef.current?.applyOptions({
      lineColor,
      topColor: `${lineColor}18`,
    })
  }, [isLong])

  useEffect(() => {
    if (!seriesRef.current || !chartRef.current) return
    seriesRef.current.setData(candles.map((c) => ({ time: c.time as any, value: c.close })))
    if (entryLineRef.current) {
      seriesRef.current.removePriceLine(entryLineRef.current)
      entryLineRef.current = null
    }
    if (entryPrice && entryPrice > 0) {
      entryLineRef.current = seriesRef.current.createPriceLine({
        price: entryPrice,
        color: "#7d809260",
        lineWidth: 1,
        lineStyle: 2,
      })
    }
    chartRef.current.timeScale().fitContent()
  }, [candles, entryPrice])

  return (
    <div className="space-y-2">
      <div className="flex gap-1 overflow-x-auto pb-1">
        {TIMEFRAMES.map((t) => (
          <button
            key={t}
            onClick={() => onTimeframeChange(t)}
            className={`shrink-0 h-8 px-2.5 rounded-lg text-[11px] font-semibold transition-all
              ${timeframe === t
                ? "bg-[#418cf5]/15 text-[#418cf5] border border-[#418cf5]/30"
                : "bg-[#12121a] border border-[#1e1e30] text-muted-foreground"}`}
          >
            {t}
          </button>
        ))}
      </div>
      <div className="relative">
        <div ref={containerRef} className="w-full" style={{ height: chartHeight }} />
        {(isLoading || error || candles.length === 0) && (
          <div className="absolute inset-0 flex items-center justify-center text-xs text-muted-foreground pointer-events-none">
            {error ? "Chart data unavailable" : "Loading chart..."}
          </div>
        )}
      </div>
      <div className="flex justify-end">
        <button
          onClick={() => chartRef.current?.timeScale().scrollToRealTime()}
          className="text-[11px] text-[#418cf5]/70 hover:text-[#418cf5]"
        >
          Live
        </button>
      </div>
    </div>
  )
}
