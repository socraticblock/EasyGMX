"use client"

import { useAccount } from "wagmi"
import { useTradeStore } from "@/lib/store"
import { arbiscanTxLink } from "@/lib/order"
import { MARKET_LIST } from "@/lib/contracts"
import { findMatchingPosition, useEasyPositions } from "@/lib/gmxPositions"
import { useEffect, useRef, useState } from "react"
import { ReferralDebugStrip } from "@/components/ReferralDebugStrip"

const GMX_APP_URL = "https://app.gmx.io"
const PENDING_TIMEOUT_MS = 75_000
const POLL_INTERVAL_MS = 5_000

export function OrderPendingScreen() {
  const { address } = useAccount()
  const { activePosition, orderPhase, setOrderPhase, updateActivePosition } = useTradeStore()
  const { data: positions } = useEasyPositions(address, activePosition)
  const [startedAt, setStartedAt] = useState(() => Date.now())
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null)

  const isRecovery = orderPhase === "recovery"
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
    if (isRecovery) return

    intervalRef.current = setInterval(() => {
      if (Date.now() - startedAt > PENDING_TIMEOUT_MS) {
        setOrderPhase("recovery")
      }
    }, POLL_INTERVAL_MS)

    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current)
    }
  }, [startedAt, isRecovery, setOrderPhase])

  const handleContinueChecking = () => {
    setStartedAt(Date.now())
    setOrderPhase("keeper")
  }

  return (
    <div className="min-h-screen flex flex-col">
      <ReferralDebugStrip />
      <div className="flex-1 flex flex-col items-center justify-center px-4">
        <div className="max-w-sm w-full text-center space-y-6">
          {!isRecovery && (
            <div className="flex justify-center">
              <div
                className="w-16 h-16 border-4 rounded-full animate-spin"
                style={{ borderColor: `${lineColor}30`, borderTopColor: lineColor }}
              />
            </div>
          )}

          <div className="space-y-2">
            {isRecovery ? (
              <>
                <h2 className="text-xl font-bold">GMX is taking longer than expected</h2>
                <p className="text-sm text-muted-foreground leading-relaxed">
                  Your order transaction was sent. Do not open another same-direction trade until you check GMX or Arbiscan.
                </p>
              </>
            ) : (
              <>
                <h2 className="text-xl font-bold">Opening your {marketInfo?.symbol} {directionLabel} trade...</h2>
                <p className="text-sm text-muted-foreground leading-relaxed">
                  GMX is confirming your trade. This usually takes a few seconds.
                  {activePosition?.openTxHash ? " A keeper is executing your order." : ""}
                </p>
              </>
            )}
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

          <div className="flex flex-col gap-2">
            {isRecovery && (
              <>
                {activePosition?.openTxHash && (
                  <a
                    href={arbiscanTxLink(activePosition.openTxHash)}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center justify-center gap-1.5 min-h-11 rounded-xl bg-[#12121a] border border-[#1e1e30] text-sm text-[#418cf5] hover:border-[#418cf5]/30 transition-colors"
                  >
                    View transaction &rarr;
                  </a>
                )}
                <button
                  type="button"
                  onClick={handleContinueChecking}
                  className="min-h-11 rounded-xl bg-[#418cf5] text-white font-semibold text-sm transition-all active:scale-[0.98]"
                >
                  Continue checking
                </button>
                <a
                  href={GMX_APP_URL}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center justify-center min-h-11 rounded-xl bg-[#12121a] border border-[#1e1e30] text-sm text-muted-foreground hover:text-foreground hover:border-[#418cf5]/30 transition-colors"
                >
                  Open GMX &rarr;
                </a>
              </>
            )}
          </div>

          {!isRecovery && activePosition?.openTxHash && (
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
            <p className="pt-2">
              GMX uses keepers to execute orders with fresh prices. EasyGMX keeps checking until your position appears or you leave this screen.
            </p>
            {isRecovery && (
              <p className="pt-2 text-amber-500/80">
                Refreshing the page will return you to the home screen. Your transaction may still execute on GMX — check Arbiscan or GMX directly.
              </p>
            )}
          </details>
        </div>
      </div>
    </div>
  )
}
