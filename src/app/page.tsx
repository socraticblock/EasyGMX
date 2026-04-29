"use client"

import { useAccount, useBalance } from "wagmi"
import { useTradeStore } from "@/lib/store"
import { TOKENS, MARKET_LIST, type MarketKey } from "@/lib/contracts"
import { fetchMarketPrices, estimateFee, estimateLiquidationPrice } from "@/lib/api"
import { useState, useEffect, useRef } from "react"
import { createChart, type IChartApi, type ISeriesApi } from "lightweight-charts"
import { ConnectKitButton } from "connectkit"

// ─── Helpers ──────────────────────────────────────────────

function formatUsd(n: number): string {
  if (Math.abs(n) >= 1)
    return n.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })
  if (Math.abs(n) >= 0.01) return n.toFixed(4)
  return n.toFixed(6)
}

function formatPnl(n: number): string {
  const sign = n >= 0 ? "+" : "-"
  return `${sign}$${formatUsd(Math.abs(n))}`
}

// ─── Screen 1: Landing ────────────────────────────────────

function LandingScreen() {
  return (
    <div className="min-h-screen flex flex-col items-center justify-center px-4">
      <div className="max-w-md w-full text-center space-y-8">
        <div className="space-y-3">
          <div className="inline-flex items-center gap-2 text-xs text-muted-foreground tracking-[0.2em] uppercase">
            <span className="inline-block w-1.5 h-1.5 rounded-full bg-[#22c55e] animate-pulse" />
            Powered by GMX V2
          </div>
          <h1 className="text-5xl font-bold tracking-tight">
            Easy<span className="text-[#418cf5]">GMX</span>
          </h1>
          <p className="text-base text-muted-foreground leading-relaxed max-w-xs mx-auto">
            Trade perpetuals in 4 clicks. No complexity, real positions, real P&amp;L.
          </p>
        </div>

        <div className="space-y-3">
          <ConnectKitButton />
        </div>

        <div className="grid grid-cols-3 gap-3 text-center pt-2">
          {[["4 clicks", "to trade"], ["5x / 10x", "preset leverage"], ["Gasless", "one-click mode"]].map(
            ([title, sub]) => (
              <div key={title} className="space-y-1">
                <div className="text-sm font-semibold">{title}</div>
                <div className="text-[11px] text-muted-foreground">{sub}</div>
              </div>
            )
          )}
        </div>

        <p className="text-[11px] text-muted-foreground/50 pt-2 leading-relaxed">
          Simplified interface to GMX V2 on Arbitrum. All trades are real leveraged positions.
          You can lose your entire investment. Not financial advice.
        </p>
      </div>
    </div>
  )
}

// ─── Screen 2: Market Select ──────────────────────────────

function MarketSelectScreen() {
  const { setSelectedMarket } = useTradeStore()
  const [prices, setPrices] = useState<Record<string, number>>({})
  const { address } = useAccount()
  const { data: usdcBalance } = useBalance({ address, token: TOKENS.USDC, chainId: 42161 })

  useEffect(() => {
    let alive = true
    const load = async () => {
      const p = await fetchMarketPrices()
      if (alive) setPrices(p)
    }
    load()
    const iv = setInterval(load, 5000)
    return () => {
      alive = false
      clearInterval(iv)
    }
  }, [])

  return (
    <div className="min-h-screen flex flex-col">
      <header className="flex items-center justify-between px-4 py-3 border-b border-[#1e1e30]">
        <h1 className="text-lg font-bold tracking-tight">
          Easy<span className="text-[#418cf5]">GMX</span>
        </h1>
        <div className="flex items-center gap-3">
          <span className="text-sm font-mono tabular-nums text-muted-foreground">
            {usdcBalance ? `${parseFloat(usdcBalance.formatted).toFixed(2)} USDC` : "—"}
          </span>
          <ConnectKitButton size="sm" />
        </div>
      </header>

      <div className="flex-1 px-4 py-5 space-y-4">
        <h2 className="text-[11px] font-semibold text-muted-foreground tracking-[0.15em] uppercase">
          Select a market
        </h2>
        <div className="space-y-2">
          {MARKET_LIST.map((m) => {
            const price = prices[m.symbol]
            return (
              <button
                key={m.key}
                onClick={() => setSelectedMarket(m.key)}
                className="w-full flex items-center justify-between p-4 rounded-xl bg-[#12121a] border border-[#1e1e30]
                           hover:border-[#418cf5]/30 active:scale-[0.995] transition-all duration-150"
              >
                <div className="flex items-center gap-3">
                  <span className="text-2xl leading-none">{m.icon}</span>
                  <div className="text-left">
                    <div className="font-semibold text-sm">{m.symbol}</div>
                    <div className="text-[11px] text-muted-foreground">{m.key} Perp</div>
                  </div>
                </div>
                <div className="text-right">
                  <div className="font-mono font-semibold text-sm tabular-nums">
                    {price ? `$${formatUsd(price)}` : "—"}
                  </div>
                  <div className="text-[11px] text-muted-foreground">Oracle</div>
                </div>
              </button>
            )
          })}
        </div>
      </div>
    </div>
  )
}

// ─── Screen 3: Trade Setup ────────────────────────────────

function TradeSetupScreen() {
  const store = useTradeStore()
  const { direction, amount, leverage } = store
  const [prices, setPrices] = useState<Record<string, number>>({})
  const [showFeeInfo, setShowFeeInfo] = useState(false)
  const { address } = useAccount()
  const { data: usdcBalance } = useBalance({ address, token: TOKENS.USDC, chainId: 42161 })

  const marketInfo = MARKET_LIST.find((m) => m.key === store.selectedMarket)
  const currentPrice = marketInfo ? (prices[marketInfo.symbol] ?? 0) : 0
  const sizeUsd = amount * leverage
  const fee = estimateFee(sizeUsd)
  const liqPrice = currentPrice > 0 ? estimateLiquidationPrice(currentPrice, direction === "long", leverage) : 0
  const balance = usdcBalance ? parseFloat(usdcBalance.formatted) : 0
  const isLong = direction === "long"

  useEffect(() => {
    let alive = true
    const load = async () => {
      const p = await fetchMarketPrices()
      if (alive) setPrices(p)
    }
    load()
    const iv = setInterval(load, 3000)
    return () => {
      alive = false
      clearInterval(iv)
    }
  }, [])

  const handleTrade = () => {
    if (!marketInfo || currentPrice <= 0 || amount <= 0) return
    store.setOrderPending(true)
    store.setActivePosition({
      marketKey: store.selectedMarket!,
      marketAddress: marketInfo.address,
      isLong,
      sizeUsd,
      collateralUsd: amount,
      entryPrice: currentPrice,
      currentPrice,
      pnlUsd: 0,
      pnlPercent: 0,
      liquidationPrice: liqPrice,
      borrowFeeRate: 0,
      fundingFeeRate: 0,
    })
  }

  return (
    <div className="min-h-screen flex flex-col">
      <header className="flex items-center gap-3 px-4 py-3 border-b border-[#1e1e30]">
        <button
          onClick={() => store.setSelectedMarket(null as unknown as MarketKey)}
          className="text-muted-foreground hover:text-foreground transition-colors text-sm"
        >
          ← Back
        </button>
        <div className="flex-1 text-center">
          <span className="font-semibold text-sm">
            {marketInfo?.icon} {marketInfo?.key}
          </span>
          <span className="ml-2 font-mono text-xs tabular-nums text-muted-foreground">
            ${currentPrice > 0 ? formatUsd(currentPrice) : "—"}
          </span>
        </div>
        <ConnectKitButton size="sm" />
      </header>

      <div className="flex-1 px-4 py-5 space-y-5 max-w-lg mx-auto w-full">
        {/* Direction */}
        <div className="space-y-2">
          <label className="text-[11px] font-semibold text-muted-foreground tracking-[0.15em] uppercase">
            Direction
          </label>
          <div className="grid grid-cols-2 gap-2">
            <button
              onClick={() => store.setDirection("long")}
              className={`h-12 rounded-xl font-semibold transition-all duration-150
                ${isLong
                  ? "bg-[#22c55e] text-white shadow-lg shadow-[#22c55e]/20"
                  : "bg-[#12121a] border border-[#1e1e30] text-muted-foreground hover:border-[#22c55e]/30"}`}
            >
              ↑ Up
            </button>
            <button
              onClick={() => store.setDirection("short")}
              className={`h-12 rounded-xl font-semibold transition-all duration-150
                ${!isLong
                  ? "bg-[#ef4444] text-white shadow-lg shadow-[#ef4444]/20"
                  : "bg-[#12121a] border border-[#1e1e30] text-muted-foreground hover:border-[#ef4444]/30"}`}
            >
              ↓ Down
            </button>
          </div>
        </div>

        {/* Amount */}
        <div className="space-y-2">
          <div className="flex justify-between items-center">
            <label className="text-[11px] font-semibold text-muted-foreground tracking-[0.15em] uppercase">
              Amount (USDC)
            </label>
            <span className="text-[11px] text-muted-foreground">
              Balance: {balance.toFixed(2)}
            </span>
          </div>
          <div className="flex gap-2">
            {[10, 25, 50, 100].map((v) => (
              <button
                key={v}
                onClick={() => store.setAmount(v)}
                className={`flex-1 h-9 rounded-lg text-xs font-medium transition-all
                  ${amount === v
                    ? "bg-[#418cf5]/15 text-[#418cf5] border border-[#418cf5]/30"
                    : "bg-[#12121a] border border-[#1e1e30] text-muted-foreground hover:border-[#418cf5]/20"}`}
              >
                ${v}
              </button>
            ))}
          </div>
          <input
            type="number"
            value={amount || ""}
            onChange={(e) => store.setAmount(parseFloat(e.target.value) || 0)}
            placeholder="0.00"
            className="w-full h-12 rounded-xl bg-[#12121a] border border-[#1e1e30] px-4 text-base font-mono tabular-nums
                       focus:outline-none focus:border-[#418cf5]/40 focus:ring-1 focus:ring-[#418cf5]/20 transition-all"
          />
        </div>

        {/* Leverage */}
        <div className="space-y-2">
          <label className="text-[11px] font-semibold text-muted-foreground tracking-[0.15em] uppercase">
            Leverage
          </label>
          <div className="grid grid-cols-2 gap-2">
            {([5, 10] as const).map((l) => (
              <button
                key={l}
                onClick={() => store.setLeverage(l)}
                className={`h-10 rounded-lg text-sm font-semibold transition-all
                  ${leverage === l
                    ? "bg-[#418cf5]/15 text-[#418cf5] border border-[#418cf5]/30"
                    : "bg-[#12121a] border border-[#1e1e30] text-muted-foreground hover:border-[#418cf5]/20"}`}
              >
                {l}x
              </button>
            ))}
          </div>
        </div>

        {/* Summary */}
        <div className="rounded-xl bg-[#12121a] border border-[#1e1e30] p-4 space-y-2.5">
          <div className="flex justify-between text-sm">
            <span className="text-muted-foreground">Position size</span>
            <span className="font-mono tabular-nums">${formatUsd(sizeUsd)}</span>
          </div>
          <div className="flex justify-between text-sm">
            <span className="text-muted-foreground">
              Est. fee{" "}
              <button
                onClick={() => setShowFeeInfo(!showFeeInfo)}
                className="text-[#418cf5]/60 hover:text-[#418cf5] ml-0.5"
              >
                ⓘ
              </button>
            </span>
            <span className="font-mono tabular-nums">${fee.toFixed(2)}</span>
          </div>
          <div className="flex justify-between text-sm">
            <span className="text-muted-foreground">Max risk</span>
            <span className="font-mono tabular-nums text-[#ef4444]">${amount.toFixed(2)}</span>
          </div>
          {liqPrice > 0 && (
            <div className="flex justify-between text-sm">
              <span className="text-muted-foreground">Liquidation</span>
              <span className="font-mono tabular-nums text-[#ef4444]/70">${formatUsd(liqPrice)}</span>
            </div>
          )}
          {showFeeInfo && (
            <div className="text-[11px] text-muted-foreground/80 space-y-1 pt-2 border-t border-[#1e1e30] leading-relaxed">
              <p>Position fee: 0.05% of size (${(sizeUsd * 0.0005).toFixed(2)})</p>
              <p>Execution fee: ~$0.15 (network gas)</p>
              <p>Borrow fee: hourly rate while position is open</p>
              <p>Slippage tolerance: 0.5%</p>
            </div>
          )}
        </div>

        {/* Trade button */}
        <button
          onClick={handleTrade}
          disabled={amount <= 0 || balance < amount}
          className={`w-full h-14 rounded-xl font-bold text-base transition-all duration-150 active:scale-[0.98]
            ${isLong
              ? "bg-[#22c55e] hover:bg-[#22c55e]/90 text-white shadow-lg shadow-[#22c55e]/20 disabled:opacity-40"
              : "bg-[#ef4444] hover:bg-[#ef4444]/90 text-white shadow-lg shadow-[#ef4444]/20 disabled:opacity-40"}`}
        >
          {amount <= 0
            ? "Enter an amount"
            : balance < amount
              ? "Insufficient USDC"
              : `Open ${isLong ? "Long" : "Short"} — $${formatUsd(sizeUsd)}`}
        </button>

        <p className="text-[11px] text-muted-foreground/40 text-center leading-relaxed">
          This opens a real {leverage}x {isLong ? "long" : "short"} position on GMX V2.
        </p>
      </div>
    </div>
  )
}

// ─── Screen 4: Position Live ──────────────────────────────

function PositionLiveScreen() {
  const { activePosition, updatePositionPrice, setActivePosition, setOrderPending, leverage } =
    useTradeStore()
  const chartContainerRef = useRef<HTMLDivElement>(null)
  const chartRef = useRef<IChartApi | null>(null)
  const seriesRef = useRef<ISeriesApi<"Area"> | null>(null)
  const [closing, setClosing] = useState(false)
  const priceDataRef = useRef<{ time: number; value: number }[]>([])

  const marketInfo = MARKET_LIST.find((m) => m.key === activePosition?.marketKey)

  // Create chart once
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
    const series = chart.addAreaSeries({
      lineColor,
      topColor: `${lineColor}18`,
      bottomColor: "transparent",
      lineWidth: 2,
      priceLineVisible: false,
    })

    // Add entry price line
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
      const price = prices[marketInfo.symbol]
      if (price) {
        updatePositionPrice(price)
        const point = { time: Math.floor(Date.now() / 1000), value: price }
        priceDataRef.current = [...priceDataRef.current.slice(-200), point]
        if (seriesRef.current) {
          seriesRef.current.update(point)
          chartRef.current?.timeScale().scrollToRealTime()
        }
      }
    }

    poll()
    const iv = setInterval(poll, 3000)
    return () => {
      alive = false
      clearInterval(iv)
    }
  }, [activePosition?.marketKey, marketInfo?.symbol, updatePositionPrice])

  if (!activePosition) return null

  const isLong = activePosition.isLong
  const pnlPositive = activePosition.pnlUsd >= 0
  const lineColor = isLong ? "#22c55e" : "#ef4444"

  const handleClose = () => {
    setClosing(true)
    setTimeout(() => {
      setClosing(false)
      setOrderPending(false)
      setActivePosition(null)
      priceDataRef.current = []
    }, 3000)
  }

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
          <span className="inline-block w-1.5 h-1.5 rounded-full animate-pulse" style={{ backgroundColor: lineColor }} />
          <span className="text-[11px] text-muted-foreground">Live</span>
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
          <span
            className={`font-mono tabular-nums font-semibold ${pnlPositive ? "text-[#22c55e]" : "text-[#ef4444]"}`}
          >
            ${formatUsd(activePosition.currentPrice)}
          </span>
        </div>
      </div>

      {/* P&L hero */}
      <div className="px-4 py-6 text-center" style={{ backgroundColor: `${lineColor}08` }}>
        <div className="text-[11px] text-muted-foreground mb-1.5">
          {leverage}x {isLong ? "Long" : "Short"} · ${formatUsd(activePosition.sizeUsd)}
        </div>
        <div
          className={`text-4xl font-bold font-mono tabular-nums ${pnlPositive ? "text-[#22c55e]" : "text-[#ef4444]"}`}
        >
          {formatPnl(activePosition.pnlUsd)}
        </div>
        <div
          className={`text-sm font-mono tabular-nums mt-0.5 ${pnlPositive ? "text-[#22c55e]/70" : "text-[#ef4444]/70"}`}
        >
          {activePosition.pnlPercent >= 0 ? "+" : ""}
          {activePosition.pnlPercent.toFixed(2)}%
        </div>
      </div>

      {/* Details */}
      <div className="px-4 py-3 space-y-2 border-t border-[#1e1e30]">
        {[
          ["Collateral", `$${formatUsd(activePosition.collateralUsd)}`, ""],
          ["Liquidation", `$${formatUsd(activePosition.liquidationPrice)}`, "text-[#ef4444]/70"],
          ["Borrow fee", "~$0.002/hr ⓘ", "text-muted-foreground"],
        ].map(([label, value, cls]) => (
          <div key={label} className="flex justify-between text-sm">
            <span className="text-muted-foreground">{label}</span>
            <span className={`font-mono tabular-nums ${cls}`}>{value}</span>
          </div>
        ))}
      </div>

      {/* Actions */}
      <div className="mt-auto px-4 py-4 space-y-2 border-t border-[#1e1e30]">
        {closing ? (
          <div className="w-full h-14 rounded-xl bg-[#12121a] border border-[#1e1e30] flex items-center justify-center gap-3">
            <div className="w-4 h-4 border-2 border-[#418cf5] border-t-transparent rounded-full animate-spin" />
            <span className="text-sm text-muted-foreground">Closing position... waiting for keeper</span>
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
      </div>
    </div>
  )
}

// ─── App Router ───────────────────────────────────────────

export default function EasyGMX() {
  const { isConnected } = useAccount()
  const { selectedMarket, activePosition } = useTradeStore()

  if (!isConnected) return <LandingScreen />
  if (activePosition) return <PositionLiveScreen />
  if (selectedMarket) return <TradeSetupScreen />
  return <MarketSelectScreen />
}
