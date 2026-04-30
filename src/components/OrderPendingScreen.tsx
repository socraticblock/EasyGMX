"use client"

import { useTradeStore } from "@/lib/store"
import { useOrderStatus, arbiscanTxLink } from "@/lib/order"
import { MARKET_LIST } from "@/lib/contracts"
import { useEffect } from "react"

// Shown after tx is submitted, while waiting for keeper to execute the order
export function OrderPendingScreen() {
  const { activePosition, setOrderPhase, setSelectedMarket } = useTradeStore()
  const { data: orderStatus } = useOrderStatus(activePosition?.orderKey ?? null)

  const marketInfo = MARKET_LIST.find((m) => m.key === activePosition?.marketKey)
  const isLong = activePosition?.isLong ?? true
  const lineColor = isLong ? "#22c55e" : "#ef4444"

  // When keeper confirms, move to live position view
  useEffect(() => {
    if (orderStatus === "executed" && activePosition) {
      setOrderPhase("confirmed")
    }
  }, [orderStatus, activePosition, setOrderPhase])

  return (
    <div className="min-h-screen flex flex-col items-center justify-center px-4">
      <div className="max-w-sm w-full text-center space-y-6">
        {/* Spinner */}
        <div className="flex justify-center">
          <div className="w-16 h-16 relative">
            <div
              className="w-16 h-16 border-4 rounded-full animate-spin"
              style={{ borderColor: `${lineColor}30`, borderTopColor: lineColor }}
            />
          </div>
        </div>

        {/* Status text */}
        <div className="space-y-2">
          <h2 className="text-xl font-bold">Opening Position</h2>
          <p className="text-sm text-muted-foreground leading-relaxed">
            Your order has been submitted. A GMX keeper will execute it within a few seconds.
          </p>
        </div>

        {/* Order details */}
        <div className="rounded-xl bg-[#12121a] border border-[#1e1e30] p-4 space-y-2 text-left">
          <div className="flex justify-between text-sm">
            <span className="text-muted-foreground">Market</span>
            <span className="font-semibold">{marketInfo?.icon} {activePosition?.marketKey}</span>
          </div>
          <div className="flex justify-between text-sm">
            <span className="text-muted-foreground">Direction</span>
            <span
              className={`font-semibold ${isLong ? "text-[#22c55e]" : "text-[#ef4444]"}`}
            >
              {isLong ? "Long" : "Short"}
            </span>
          </div>
          <div className="flex justify-between text-sm">
            <span className="text-muted-foreground">Size</span>
            <span className="font-mono tabular-nums">${activePosition?.sizeUsd.toFixed(2)}</span>
          </div>
          <div className="flex justify-between text-sm">
            <span className="text-muted-foreground">Collateral</span>
            <span className="font-mono tabular-nums">${activePosition?.collateralUsd.toFixed(2)}</span>
          </div>
        </div>

        {/* Transaction link */}
        {activePosition?.openTxHash && (
          <a
            href={arbiscanTxLink(activePosition.openTxHash)}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1.5 text-xs text-[#418cf5]/70 hover:text-[#418cf5] transition-colors"
          >
            View transaction on Arbiscan &rarr;
          </a>
        )}

        {/* Keeper explanation */}
        <div className="rounded-xl bg-[#418cf5]/5 border border-[#418cf5]/10 p-3 text-[11px] text-muted-foreground/80 leading-relaxed">
          <p>
            GMX V2 uses keepers (automated bots) to execute orders with fresh oracle prices.
            This typically takes 2-10 seconds. Your funds are safe in the OrderVault until the keeper fills your order.
          </p>
        </div>
      </div>
    </div>
  )
}
