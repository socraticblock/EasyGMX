"use client"

import { useAccount } from "wagmi"
import { useTradeStore } from "@/lib/store"
import { arbiscanTxLink } from "@/lib/order"
import { MARKET_LIST } from "@/lib/contracts"
import { findMatchingPosition, useEasyPositions } from "@/lib/gmxPositions"
import { useEffect, useState } from "react"

export function OrderPendingScreen() {
  const { address } = useAccount()
  const { activePosition, setOrderPhase, updateActivePosition, setOrderError } = useTradeStore()
  const { data: positions } = useEasyPositions(address, activePosition)
  const [startedAt] = useState(() => Date.now())

  const marketInfo = MARKET_LIST.find((m) => m.key === activePosition?.marketKey)
  const isLong = activePosition?.isLong ?? true
  const lineColor = isLong ? "#22c55e" : "#ef4444"
  const directionLabel = activePosition?.direction === "down" ? "Price Down" : "Price Up"

  useEffect(() => {
    if (!activePosition || !positions) return
    const confirmed = findMatchingPosition(positions, activePosition)
    if (confirmed) {
      updateActivePosition({ ...confirmed, openTxHash: activePosition.openTxHash, orderKey: activePosition.orderKey })
      setOrderPhase("confirmed")
    }
  }, [positions, activePosition, updateActivePosition, setOrderPhase])

  useEffect(() => {
    const id = setInterval(() => {
      if (Date.now() - startedAt > 75_000) {
        setOrderError("GMX is taking longer than expected to confirm this trade. Check GMX or Arbiscan before trying again.")
        useTradeStore.getState().setActivePosition(null)
        clearInterval(id)
      }
    }, 5_000)
    return () => clearInterval(id)
  }, [startedAt, setOrderError])

  return (
    <div className="min-h-screen flex flex-col items-center justify-center px-4">
      <div className="max-w-sm w-full text-center space-y-6">
        <div className="flex justify-center">
          <div
            className="w-16 h-16 border-4 rounded-full animate-spin"
            style={{ borderColor: `${lineColor}30`, borderTopColor: lineColor }}
          />
        </div>

        <div className="space-y-2">
          <h2 className="text-xl font-bold">Opening your {marketInfo?.symbol} {directionLabel} trade...</h2>
          <p className="text-sm text-muted-foreground leading-relaxed">
            GMX is confirming your trade. This usually takes a few seconds.
          </p>
        </div>

        <div className="rounded-xl bg-[#12121a] border border-[#1e1e30] p-4 space-y-2 text-left">
          <div className="flex justify-between text-sm">
            <span className="text-muted-foreground">Market</span>
            <span className="font-semibold">{marketInfo?.icon} {activePosition?.marketKey}</span>
          </div>
          <div className="flex justify-between text-sm">
            <span className="text-muted-foreground">Direction</span>
            <span className={`font-semibold ${isLong ? "text-[#22c55e]" : "text-[#ef4444]"}`}>
              {directionLabel}
            </span>
          </div>
          <div className="flex justify-between text-sm">
            <span className="text-muted-foreground">Risk</span>
            <span className="font-mono tabular-nums">${activePosition?.riskUsd.toFixed(2)}</span>
          </div>
        </div>

        {activePosition?.openTxHash && (
          <a
            href={arbiscanTxLink(activePosition.openTxHash)}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1.5 text-xs text-[#418cf5]/70 hover:text-[#418cf5] transition-colors"
          >
            View transaction &rarr;
          </a>
        )}

        <details className="rounded-xl bg-[#418cf5]/5 border border-[#418cf5]/10 p-3 text-[11px] text-muted-foreground/80 leading-relaxed">
          <summary className="cursor-pointer">Details</summary>
          <p className="pt-2">GMX uses keepers to execute orders with fresh prices.</p>
        </details>
      </div>
    </div>
  )
}
