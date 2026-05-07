"use client"

import { useCallback } from "react"
import { useTradeStore } from "@/lib/store"
import { MARKET_LIST } from "@/lib/contracts"

function formatUsd(n: number): string {
  if (!Number.isFinite(n)) return "-"
  return n.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })
}

function formatPnl(n: number): string {
  const sign = n >= 0 ? "+" : "-"
  return `${sign}$${formatUsd(Math.abs(n))}`
}

export function TradeClosedScreen() {
  const { lastClosedTrade, tradeAgain } = useTradeStore()

  const handleShare = useCallback(async () => {
    if (!lastClosedTrade || typeof navigator === "undefined") return
    const marketInfo = MARKET_LIST.find((m) => m.key === lastClosedTrade.marketKey)
    const text = `EasyGMX ${marketInfo?.symbol ?? lastClosedTrade.marketKey} ${lastClosedTrade.direction === "up" ? "Price Up" : "Price Down"} ${lastClosedTrade.leverage}x\n${lastClosedTrade.pnlUsd >= 0 ? "Profit" : "Loss"}: ${formatPnl(lastClosedTrade.pnlUsd)} (${lastClosedTrade.pnlPercent >= 0 ? "+" : ""}${lastClosedTrade.pnlPercent.toFixed(2)}%)`
    try {
      if (typeof navigator.share === "function") {
        await navigator.share({ title: "EasyGMX Trade", text })
      } else if (navigator.clipboard?.writeText) {
        await navigator.clipboard.writeText(text)
      }
    } catch {}
  }, [lastClosedTrade])

  if (!lastClosedTrade) return null

  const marketInfo = MARKET_LIST.find((m) => m.key === lastClosedTrade.marketKey)
  const positive = lastClosedTrade.pnlUsd >= 0
  const directionLabel = lastClosedTrade.direction === "up" ? "Price Up" : "Price Down"

  return (
    <div className="min-h-screen flex flex-col items-center justify-center px-4">
      <div className="max-w-sm w-full text-center space-y-6">
        <div className="space-y-2">
          <h1 className="text-2xl font-bold">Trade closed</h1>
          <p className="text-sm text-muted-foreground">
            {marketInfo?.icon} {marketInfo?.symbol} {directionLabel} &middot; {lastClosedTrade.leverage}x
          </p>
        </div>

        <div className="rounded-xl bg-[#12121a] border border-[#1e1e30] p-6 space-y-2">
          <div className="text-sm text-muted-foreground">{positive ? "Profit" : "Loss"}</div>
          <div className={`text-4xl font-bold font-mono tabular-nums ${positive ? "text-[#22c55e]" : "text-[#ef4444]"}`}>
            {formatPnl(lastClosedTrade.pnlUsd)}
          </div>
          <div className={`text-sm font-mono tabular-nums ${positive ? "text-[#22c55e]/70" : "text-[#ef4444]/70"}`}>
            {lastClosedTrade.pnlPercent >= 0 ? "+" : ""}{lastClosedTrade.pnlPercent.toFixed(2)}%
          </div>
        </div>

        <div className="space-y-2">
          {positive && (
            <button onClick={handleShare} className="w-full h-12 rounded-xl bg-[#418cf5] text-white font-semibold">
              Share
            </button>
          )}
          <button onClick={tradeAgain} className="w-full h-12 rounded-xl bg-[#12121a] border border-[#1e1e30] font-semibold">
            Trade again
          </button>
        </div>
      </div>
    </div>
  )
}
