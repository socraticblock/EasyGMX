"use client"

import { useTradeStore } from "@/lib/store"
import { useClosePosition, useOnChainPositions, arbiscanTxLink } from "@/lib/order"
import { fetchMarketPrices, type MarketPriceData } from "@/lib/api"
import { MARKET_LIST, TOKENS, type MarketKey } from "@/lib/contracts"
import { createChart, AreaSeries, type IChartApi, type ISeriesApi } from "lightweight-charts"
import { useState, useEffect, useRef, useCallback } from "react"
import { ConnectKitButton } from "connectkit"
import { useAccount } from "wagmi"

function formatUsd(n: number): string {
  if (!Number.isFinite(n)) return "\u2014"
  if (Math.abs(n) >= 1) return n.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })
  if (Math.abs(n) >= 0.01) return n.toFixed(4)
  return n.toFixed(6)
}

function formatPnl(n: number): string {
  const sign = n >= 0 ? "+" : "-"
  return `${sign}$${formatUsd(Math.abs(n))}`
}

// ─── Share screenshot overlay ──────────────────────────────

function ShareOverlay({ onClose }: { onClose: () => void }) {
  const { activePosition, leverage } = useTradeStore()

  const handleShare = useCallback(async () => {
    if (!activePosition) return
    const isLong = activePosition.isLong
    const pnlPositive = activePosition.pnlUsd >= 0
    const text = `EasyGMX ${leverage}x ${isLong ? "Long" : "Short"} ${activePosition.marketKey}\n${
      pnlPositive ? "Profit" : "Loss"
    }: ${formatPnl(activePosition.pnlUsd)} (${activePosition.pnlPercent >= 0 ? "+" : ""}${activePosition.pnlPercent.toFixed(2)}%)\n${
      activePosition.openTxHash ? arbiscanTxLink(activePosition.openTxHash) : ""
    }`

    try {
      if (typeof navigator !== "undefined" && typeof navigator.share === "function") {
        await navigator.share({ title: "EasyGMX Trade", text })
      } else if (typeof navigator !== "undefined" && typeof navigator.clipboard?.writeText === "function") {
        await navigator.clipboard.writeText(text)
      }
    } catch { /* user cancelled or not supported */ }
    onClose()
  }, [activePosition, leverage, onClose])

  if (!activePosition) return null

  const isLong = activePosition.isLong
  const pnlPositive = activePosition.pnlUsd >= 0
  const lineColor = isLong ? "#22c55e" : "#ef4444"
  const marketInfo = MARKET_LIST.find((m) => m.key === activePosition.marketKey)

  return (
    <div className="fixed inset-0 z-50 bg-black/80 flex items-center justify-center px-4" onClick={onClose}>
      <div className="max-w-sm w-full rounded-2xl bg-[#12121a] border border-[#1e1e30] p-6 space-y-5" onClick={(e) => e.stopPropagation()}>
        {/* Share card preview */}
        <div
          className="rounded-xl p-5 text-center space-y-2"
          style={{ backgroundColor: `${lineColor}08`, border: `1px solid ${lineColor}20` }}
        >
          <div className="text-xs text-muted-foreground">
            {leverage}x {isLong ? "Long" : "Short"} &middot; {marketInfo?.icon} {activePosition.marketKey}
          </div>
          <div className={`text-3xl font-bold font-mono tabular-nums ${pnlPositive ? "text-[#22c55e]" : "text-[#ef4444]"}`}>
            {formatPnl(activePosition.pnlUsd)}
          </div>
          <div className={`text-sm font-mono tabular-nums ${pnlPositive ? "text-[#22c55e]/70" : "text-[#ef4444]/70"}`}>
            {activePosition.pnlPercent >= 0 ? "+" : ""}{activePosition.pnlPercent.toFixed(2)}%
          </div>
          <div className="text-[10px] text-muted-foreground/40 pt-1">EasyGMX &middot; Powered by GMX V2</div>
        </div>

        <div className="flex gap-2">
          <button
            onClick={handleShare}
            className="flex-1 h-10 rounded-xl bg-[#418cf5] text-white text-sm font-semibold hover:bg-[#418cf5]/90 transition-all"
          >
            {typeof navigator !== "undefined" && "share" in navigator ? "Share" : "Copy"}
          </button>
          <button
            onClick={onClose}
            className="h-10 px-4 rounded-xl bg-[#1e1e30] text-muted-foreground text-sm hover:bg-[#2a2a3d] transition-all"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  )
}

// ─── Main position screen ──────────────────────────────────

export function PositionLiveScreen() {
  const {
    activePosition,
    updatePositionPrice,
    updatePositionOnChain,
    setActivePosition,
    setOrderPhase,
    setClosePhase,
    setCloseError,
    closePhase,
    closeError,
    leverage,
  } = useTradeStore()

  const chartContainerRef = useRef<HTMLDivElement>(null)
  const chartRef = useRef<IChartApi | null>(null)
  const seriesRef = useRef<ISeriesApi<"Area"> | null>(null)
  const priceDataRef = useRef<{ time: import("lightweight-charts").Time; value: number }[]>([])
  const [showShare, setShowShare] = useState(false)

  const marketInfo = MARKET_LIST.find((m) => m.key === activePosition?.marketKey)
  const closePosition = useClosePosition()

  // On-chain position sync
  const { data: onChainPositions } = useOnChainPositions()

  // Create chart
  useEffect(() => {
    if (!chartContainerRef.current || !activePosition || chartRef.current) return

    const chart = createChart(chartContainerRef.current, {
      layout: { background: { color: "#0a0a0f" }, textColor: "#6b6b80", fontSize: 11 },
      grid: { vertLines: { color: "#1e1e3030" }, horzLines: { color: "#1e1e3030" } },
      width: chartContainerRef.current.clientWidth,
      height: 180,
      timeScale: { timeVisible: true, secondsVisible: true, borderColor: "#1e1e30" },
      rightPriceScale: { borderColor: "#1e1e30" },
      crosshair: { mode: 0 },
    })

    const lineColor = activePosition.isLong ? "#22c55e" : "#ef4444"
    const series = chart.addSeries(AreaSeries, {
      lineColor,
      topColor: `${lineColor}18`,
      bottomColor: "transparent",
      lineWidth: 2,
      priceLineVisible: false,
    })

    series.createPriceLine({
      price: activePosition.entryPrice,
      color: "#6b6b8050",
      lineWidth: 1,
      lineStyle: 2,
    })

    chartRef.current = chart
    seriesRef.current = series

    const onResize = () => {
      if (chartContainerRef.current) {
        chart.applyOptions({ width: chartContainerRef.current.clientWidth })
      }
    }
    window.addEventListener("resize", onResize)

    return () => {
      window.removeEventListener("resize", onResize)
      chart.remove()
      chartRef.current = null
      seriesRef.current = null
    }
  }, [activePosition?.marketKey, activePosition?.isLong, activePosition?.entryPrice])

  // Poll prices
  useEffect(() => {
    if (!activePosition || !marketInfo) return
    let alive = true

    const poll = async () => {
      const prices = await fetchMarketPrices()
      if (!alive) return
      const data = prices[marketInfo.symbol]
      if (data?.price) {
        updatePositionPrice(data.price)
        const point = { time: Math.floor(Date.now() / 1000) as import("lightweight-charts").UTCTimestamp, value: data.price }
        priceDataRef.current = [...priceDataRef.current.slice(-200), point]
        if (seriesRef.current) {
          seriesRef.current.update(point)
          chartRef.current?.timeScale().scrollToRealTime()
        }
      }
    }

    poll()
    const iv = setInterval(poll, 3_000)
    return () => { alive = false; clearInterval(iv) }
  }, [activePosition?.marketKey, marketInfo?.symbol, updatePositionPrice])

  // Sync on-chain position data when it arrives
  useEffect(() => {
    if (!activePosition || !onChainPositions) return
    const chainPos = onChainPositions.find(
      (p) => p.market.toLowerCase() === activePosition.marketAddress.toLowerCase() && p.isLong === activePosition.isLong
    )
    if (chainPos && !activePosition.isOnChain) {
      updatePositionOnChain({
        isOnChain: true,
        entryPrice: chainPos.averageEntryPrice || chainPos.entryPrice,
        sizeUsd: chainPos.sizeInUsd || activePosition.sizeUsd,
        collateralUsd: chainPos.collateralAmount || activePosition.collateralUsd,
      })
    }
  }, [onChainPositions, activePosition, updatePositionOnChain])

  // Close handler - must be before early return
  const handleClose = useCallback(async () => {
    if (!activePosition) return
    try {
      setClosePhase("signing")
      const result = await closePosition.mutateAsync({
        marketAddress: activePosition.marketAddress,
        isLong: activePosition.isLong,
        sizeUsd: activePosition.sizeUsd,
        collateralToken: TOKENS.USDC,
        currentPrice: activePosition.currentPrice,
      })
      setClosePhase("keeper")
      updatePositionOnChain({ closeTxHash: result.txHash })

      setTimeout(() => {
        setActivePosition(null)
        setOrderPhase("idle")
        setClosePhase("idle")
        priceDataRef.current = []
        setShowShare(true)
      }, 5_000)
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : "Close failed"
      setCloseError(message)
    }
  }, [activePosition, closePosition, setClosePhase, updatePositionOnChain, setActivePosition, setOrderPhase, setCloseError])

  if (!activePosition) return null

  const isLong = activePosition.isLong
  const pnlPositive = activePosition.pnlUsd >= 0
  const lineColor = isLong ? "#22c55e" : "#ef4444"

  const isClosing = closePhase === "signing" || closePhase === "keeper" || closePosition.isPending

  return (
    <div className="min-h-screen flex flex-col bg-[#0a0a0f]">
      {/* Header */}
      <header className="flex items-center justify-between px-4 py-3 border-b border-[#1e1e30]">
        <div className="flex items-center gap-2">
          <span className="text-lg leading-none">{marketInfo?.icon}</span>
          <span className="font-semibold text-sm">{activePosition.marketKey}</span>
          <span
            className={`text-[10px] font-bold px-1.5 py-0.5 rounded tracking-wider
              ${isLong ? "bg-[#22c55e]/15 text-[#22c55e]" : "bg-[#ef4444]/15 text-[#ef4444]"}`}
          >
            {isLong ? "LONG" : "SHORT"}
          </span>
        </div>
        <div className="flex items-center gap-1.5">
          {activePosition.isOnChain ? (
            <span className="inline-block w-1.5 h-1.5 rounded-full bg-[#22c55e] animate-pulse" />
          ) : (
            <span className="inline-block w-1.5 h-1.5 rounded-full bg-yellow-500 animate-pulse" />
          )}
          <span className="text-[11px] text-muted-foreground">
            {activePosition.isOnChain ? "On-chain" : "Confirming..."}
          </span>
        </div>
      </header>

      {/* Chart */}
      <div ref={chartContainerRef} className="w-full shrink-0" />

      {/* Prices row */}
      <div className="px-4 py-2.5 flex justify-between border-b border-[#1e1e30] text-sm">
        <div>
          <span className="text-muted-foreground text-[11px]">Entry </span>
          <span className="font-mono tabular-nums">${formatUsd(activePosition.entryPrice)}</span>
        </div>
        <div>
          <span className="text-muted-foreground text-[11px]">Now </span>
          <span className={`font-mono tabular-nums font-semibold ${pnlPositive ? "text-[#22c55e]" : "text-[#ef4444]"}`}>
            ${formatUsd(activePosition.currentPrice)}
          </span>
        </div>
      </div>

      {/* P&L hero */}
      <div className="px-4 py-6 text-center" style={{ backgroundColor: `${lineColor}08` }}>
        <div className="text-[11px] text-muted-foreground mb-1.5">
          {leverage}x {isLong ? "Long" : "Short"} &middot; ${formatUsd(activePosition.sizeUsd)}
        </div>
        <div
          className={`text-4xl font-bold font-mono tabular-nums ${pnlPositive ? "text-[#22c55e]" : "text-[#ef4444]"}`}
        >
          {formatPnl(activePosition.pnlUsd)}
        </div>
        <div
          className={`text-sm font-mono tabular-nums mt-0.5 ${pnlPositive ? "text-[#22c55e]/70" : "text-[#ef4444]/70"}`}
        >
          {activePosition.pnlPercent >= 0 ? "+" : ""}{activePosition.pnlPercent.toFixed(2)}%
        </div>
      </div>

      {/* Details */}
      <div className="px-4 py-3 space-y-2 border-t border-[#1e1e30]">
        {([
          ["Collateral", `$${formatUsd(activePosition.collateralUsd)}`, ""],
          ["Liquidation", `$${formatUsd(activePosition.liquidationPrice)}`, "text-[#ef4444]/70"],
          ["Borrow fee", `~$${activePosition.borrowFeeHourly.toFixed(4)}/hr`, "text-muted-foreground"],
          ["Funding", activePosition.fundingRateAnnual !== 0 ? `${(activePosition.fundingRateAnnual * 100).toFixed(4)}%` : "Loading...", "text-muted-foreground"],
        ] as const).map(([label, value, cls]) => (
          <div key={label} className="flex justify-between text-sm">
            <span className="text-muted-foreground">{label}</span>
            <span className={`font-mono tabular-nums ${cls}`}>{value}</span>
          </div>
        ))}
      </div>

      {/* Close error */}
      {closeError && (
        <div className="mx-4 rounded-xl bg-[#ef4444]/10 border border-[#ef4444]/20 p-3 text-sm text-[#ef4444]">
          {closeError}
        </div>
      )}

      {/* Actions */}
      <div className="mt-auto px-4 py-4 space-y-2 border-t border-[#1e1e30]">
        {isClosing ? (
          <div className="w-full h-14 rounded-xl bg-[#12121a] border border-[#1e1e30] flex items-center justify-center gap-3">
            <div className="w-4 h-4 border-2 border-[#418cf5] border-t-transparent rounded-full animate-spin" />
            <span className="text-sm text-muted-foreground">
              {closePhase === "signing" ? "Check wallet to close..." : "Closing position... waiting for keeper"}
            </span>
          </div>
        ) : (
          <>
            <button
              onClick={handleClose}
              className="w-full h-12 rounded-xl font-semibold text-sm bg-[#22c55e]/10 text-[#22c55e] border border-[#22c55e]/20
                         hover:bg-[#22c55e]/20 active:scale-[0.98] transition-all duration-150"
            >
              Take Profit
            </button>
            <button
              onClick={handleClose}
              className="w-full h-12 rounded-xl font-semibold text-sm bg-[#ef4444]/10 text-[#ef4444] border border-[#ef4444]/20
                         hover:bg-[#ef4444]/20 active:scale-[0.98] transition-all duration-150"
            >
              Cut Loss
            </button>
          </>
        )}

        {/* Arbiscan links */}
        <div className="flex justify-center gap-3 pt-1">
          {activePosition.openTxHash && (
            <a
              href={arbiscanTxLink(activePosition.openTxHash)}
              target="_blank"
              rel="noopener noreferrer"
              className="text-[10px] text-[#418cf5]/50 hover:text-[#418cf5] transition-colors"
            >
              Open tx &rarr;
            </a>
          )}
          {activePosition.closeTxHash && (
            <a
              href={arbiscanTxLink(activePosition.closeTxHash)}
              target="_blank"
              rel="noopener noreferrer"
              className="text-[10px] text-[#418cf5]/50 hover:text-[#418cf5] transition-colors"
            >
              Close tx &rarr;
            </a>
          )}
        </div>
      </div>

      {/* Share overlay */}
      {showShare && <ShareOverlay onClose={() => setShowShare(false)} />}
    </div>
  )
}
