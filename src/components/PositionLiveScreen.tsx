"use client"

import { useAccount } from "wagmi"
import { useEffect, useCallback, useState } from "react"
import { useTradeStore } from "@/lib/store"
import { useClosePosition, userFacingGmxError, arbiscanTxLink } from "@/lib/order"
import { MARKET_LIST, TOKENS } from "@/lib/contracts"
import { closedTradeFromPosition, findMatchingPosition, mergePositionPrice, useEasyPositions } from "@/lib/gmxPositions"
import { useEasyMarkets } from "@/lib/gmxMarketData"
import { MarketChart } from "@/components/MarketChart"
import { ReferralDebugStrip } from "@/components/ReferralDebugStrip"

const CHART_HEIGHT = "clamp(170px, 30vw, 500px)"

function formatUsd(n: number): string {
  if (!Number.isFinite(n)) return "-"
  if (Math.abs(n) >= 1) return n.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })
  if (Math.abs(n) >= 0.01) return n.toFixed(4)
  return n.toFixed(6)
}

function formatPnl(n: number): string {
  const sign = n >= 0 ? "+" : "-"
  return `${sign}$${formatUsd(Math.abs(n))}`
}

export function PositionLiveScreen() {
  const {
    activePosition,
    updateActivePosition,
    setActivePosition,
    setLastClosedTrade,
    setOrderPhase,
    setClosePhase,
    setCloseError,
    closePhase,
    closeError,
    liveChartTimeframe,
    setLiveChartTimeframe,
  } = useTradeStore()
  const { address } = useAccount()
  const closePosition = useClosePosition()
  const { data: positions } = useEasyPositions(address, activePosition)
  const { data: markets } = useEasyMarkets()
  const [closeStartedAt, setCloseStartedAt] = useState<number | null>(null)
  const [showCloseReview, setShowCloseReview] = useState(false)

  const marketInfo = MARKET_LIST.find((m) => m.key === activePosition?.marketKey)

  useEffect(() => {
    if (!activePosition || !positions) return
    const chainPos = findMatchingPosition(positions, activePosition)
    if (chainPos) {
      updateActivePosition({
        ...chainPos,
        openTxHash: activePosition.openTxHash,
        closeTxHash: activePosition.closeTxHash,
        orderKey: activePosition.orderKey,
      })
    }
  }, [positions, activePosition, updateActivePosition])

  useEffect(() => {
    if (!activePosition || activePosition.isOnChain) return
    const market = markets?.[activePosition.marketKey]
    if (market?.price) {
      updateActivePosition(mergePositionPrice(activePosition, market.price))
    }
  }, [markets, activePosition, updateActivePosition])

  useEffect(() => {
    if (!activePosition || closePhase !== "keeper" || !positions || !activePosition.closeTxHash) return
    const stillOpen = findMatchingPosition(positions, activePosition)
    if (!stillOpen) {
      setLastClosedTrade(closedTradeFromPosition(activePosition))
      setActivePosition(null)
      setOrderPhase("idle")
      setClosePhase("idle")
    }
  }, [positions, activePosition, closePhase, setLastClosedTrade, setActivePosition, setOrderPhase, setClosePhase])

  useEffect(() => {
    if (closePhase !== "keeper" || !closeStartedAt) return
    const id = setInterval(() => {
      if (Date.now() - closeStartedAt > 75_000) {
        setCloseError("GMX is taking longer than expected to confirm the close. Check GMX or Arbiscan before trying again.")
        setClosePhase("idle")
        clearInterval(id)
      }
    }, 5_000)
    return () => clearInterval(id)
  }, [closePhase, closeStartedAt, setCloseError, setClosePhase])

  const handleClose = useCallback(async () => {
    if (!activePosition) return
    setShowCloseReview(false)
    try {
      setCloseError(null)
      setClosePhase("signing")
      const result = await closePosition.mutateAsync({
        marketAddress: activePosition.marketAddress,
        isLong: activePosition.isLong,
        sizeUsd: activePosition.sizeUsd,
        collateralToken: TOKENS.USDC,
        currentPrice: activePosition.currentPrice,
      })
      updateActivePosition({ closeTxHash: result.txHash })
      setCloseStartedAt(Date.now())
      setClosePhase("keeper")
    } catch (err) {
      setCloseError(userFacingGmxError(err, "GMX could not close this position. Your position is still open on GMX. Try again or manage it on GMX."))
      setClosePhase("idle")
    }
  }, [activePosition, closePosition, setClosePhase, updateActivePosition, setCloseError])

  if (!activePosition) return null

  const isLong = activePosition.isLong
  const pnlPositive = activePosition.pnlUsd >= 0
  const directionLabel = activePosition.direction === "up" ? "Price Up" : "Price Down"
  const marketLabel = marketInfo?.symbol ?? activePosition.marketKey
  const isClosing = closePhase === "signing" || closePhase === "keeper" || closePosition.isPending
  const closeButtonLabel = isClosing
    ? (closePhase === "signing" ? "Check wallet to close position..." : "Closing position on GMX...")
    : "Close full position"
  const confirmCloseLabel = `Close ${marketLabel} position`

  const closeButton = (
    <button
      onClick={() => !isClosing && setShowCloseReview(true)}
      disabled={isClosing}
      className="w-full min-h-14 rounded-xl font-semibold text-sm border transition-all duration-150 active:scale-[0.98] disabled:opacity-50
        bg-[#12121a] text-foreground border-[#1e1e30] hover:border-[#418cf5]/30"
    >
      {closeButtonLabel}
    </button>
  )

  return (
    <div className="app-screen">
      <header className="app-header">
        <div className="app-header-title flex items-center justify-center gap-2 min-w-0">
          <span className="text-lg leading-none shrink-0">{marketInfo?.icon}</span>
          <span className="font-semibold text-sm truncate">{marketInfo?.symbol} {directionLabel}</span>
          <span className="text-[10px] font-bold px-1.5 py-0.5 rounded tracking-wider bg-[#418cf5]/15 text-[#418cf5] shrink-0">
            {activePosition.leverage}x
          </span>
        </div>
        <div className="flex items-center gap-1.5 shrink-0">
          <span className={`inline-block w-1.5 h-1.5 rounded-full animate-pulse ${activePosition.isOnChain ? "bg-[#22c55e]" : "bg-yellow-500"}`} />
          <span className="text-[11px] text-muted-foreground">
            {activePosition.isOnChain ? "GMX synced" : "Confirming..."}
          </span>
        </div>
      </header>

      <ReferralDebugStrip />

      <div className="live-position-body">
        <div className="live-position-grid">
          <div className="live-position-chart-card">
            <MarketChart
              marketKey={activePosition.marketKey}
              timeframe={liveChartTimeframe}
              onTimeframeChange={setLiveChartTimeframe}
              entryPrice={activePosition.entryPrice}
              isLong={isLong}
              chartHeight={CHART_HEIGHT}
            />
            <div className="mt-3 pt-3 border-t border-[#1e1e30] flex justify-between text-sm">
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
          </div>

          <div className="live-position-summary-card space-y-4">
            <div className="text-center">
              <div className="text-[11px] text-muted-foreground mb-1.5">
                Risk ${formatUsd(activePosition.riskUsd)} &middot; Position ${formatUsd(activePosition.sizeUsd)}
              </div>
              <div className={`text-4xl font-bold font-mono tabular-nums ${pnlPositive ? "text-[#22c55e]" : "text-[#ef4444]"}`}>
                {formatPnl(activePosition.pnlUsd)}
              </div>
              <div className={`text-sm font-mono tabular-nums mt-0.5 ${pnlPositive ? "text-[#22c55e]/70" : "text-[#ef4444]/70"}`}>
                {activePosition.pnlPercent >= 0 ? "+" : ""}{activePosition.pnlPercent.toFixed(2)}%
              </div>
            </div>

            <div className="space-y-2 pt-2 border-t border-[#1e1e30]">
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">Liquidation</span>
                <span className="font-mono tabular-nums text-[#ef4444]/70">${formatUsd(activePosition.liquidationPrice)}</span>
              </div>
              <details className="text-sm">
                <summary className="cursor-pointer text-[#418cf5]/70 text-[11px]">Details</summary>
                <div className="pt-2 space-y-1 text-[11px] text-muted-foreground">
                  <p>Position size: ${formatUsd(activePosition.sizeUsd)}</p>
                  <p>Risk amount: ${formatUsd(activePosition.riskUsd)}</p>
                  <p>Borrow fee: ${formatUsd(activePosition.borrowFeeUsd ?? 0)}</p>
                  <p>Funding fee: ${formatUsd(activePosition.fundingFeeUsd ?? 0)}</p>
                  {activePosition.openTxHash && (
                    <a href={arbiscanTxLink(activePosition.openTxHash)} target="_blank" rel="noopener noreferrer" className="block text-[#418cf5]/70">
                      Open transaction &rarr;
                    </a>
                  )}
                  {activePosition.closeTxHash && (
                    <a href={arbiscanTxLink(activePosition.closeTxHash)} target="_blank" rel="noopener noreferrer" className="block text-[#418cf5]/70">
                      Close transaction &rarr;
                    </a>
                  )}
                </div>
              </details>
            </div>

            {closeError && (
              <div className="hidden lg:block rounded-xl bg-[#ef4444]/10 border border-[#ef4444]/20 p-3 text-sm text-[#ef4444]">
                {closeError}
              </div>
            )}

            <div className="live-close-action--desktop hidden lg:block pt-2">
              {closeButton}
            </div>
          </div>
        </div>
      </div>

      <div className="live-close-action lg:hidden">
        {closeError && (
          <div className="mb-3 rounded-xl bg-[#ef4444]/10 border border-[#ef4444]/20 p-3 text-sm text-[#ef4444]">
            {closeError}
          </div>
        )}
        {closeButton}
      </div>

      {showCloseReview && (
        <div className="responsive-dialog-shell">
          <div className="responsive-dialog-panel space-y-4">
            <h2 className="text-lg font-bold">Close full position</h2>
            <p className="text-sm text-muted-foreground leading-relaxed">
              This closes your entire GMX position for this market and direction. This cannot be undone from EasyGMX.
            </p>
            <div className="rounded-xl bg-[#0a0a0f] border border-[#1e1e30] p-4 space-y-2 text-sm">
              <div className="flex justify-between">
                <span className="text-muted-foreground">Market</span>
                <span>{marketLabel}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Direction</span>
                <span className={isLong ? "text-[#22c55e]" : "text-[#ef4444]"}>{directionLabel}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Position size</span>
                <span className="font-mono tabular-nums">${formatUsd(activePosition.sizeUsd)}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Collateral at risk</span>
                <span className="font-mono tabular-nums">${formatUsd(activePosition.riskUsd)}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Current PnL</span>
                <span className={`font-mono tabular-nums ${pnlPositive ? "text-[#22c55e]" : "text-[#ef4444]"}`}>
                  {formatPnl(activePosition.pnlUsd)}
                </span>
              </div>
            </div>
            <div className="flex flex-col gap-2">
              <button
                type="button"
                onClick={handleClose}
                className="w-full min-h-12 rounded-xl bg-[#ef4444] text-white font-semibold transition-all active:scale-[0.98]"
              >
                {confirmCloseLabel}
              </button>
              <button
                type="button"
                onClick={() => setShowCloseReview(false)}
                className="w-full min-h-11 rounded-xl text-sm text-muted-foreground hover:text-foreground transition-colors"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
