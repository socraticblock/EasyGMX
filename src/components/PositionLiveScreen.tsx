"use client"

import { useAccount } from "wagmi"
import { useEffect, useCallback, useState } from "react"
import { useTradeStore } from "@/lib/store"
import { useClosePosition, userFacingGmxError, arbiscanTxLink } from "@/lib/order"
import { MARKET_LIST, TOKENS } from "@/lib/contracts"
import { closedTradeFromPosition, findMatchingPosition, mergePositionPrice, useEasyPositions } from "@/lib/gmxPositions"
import { useEasyMarkets } from "@/lib/gmxMarketData"
import { MarketChart } from "@/components/MarketChart"

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
        clearInterval(id)
      }
    }, 5_000)
    return () => clearInterval(id)
  }, [closePhase, closeStartedAt, setCloseError])

  const handleClose = useCallback(async () => {
    if (!activePosition) return
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
      setCloseError(userFacingGmxError(err, "GMX could not close this trade. Try again or manage the position on GMX."))
    }
  }, [activePosition, closePosition, setClosePhase, updateActivePosition, setCloseError])

  if (!activePosition) return null

  const isLong = activePosition.isLong
  const pnlPositive = activePosition.pnlUsd >= 0
  const closeLabel = pnlPositive ? "Take Profit" : "Cut Loss"
  const directionLabel = activePosition.direction === "up" ? "Price Up" : "Price Down"
  const isClosing = closePhase === "signing" || closePhase === "keeper" || closePosition.isPending

  return (
    <div className="min-h-screen flex flex-col bg-[#0a0a0f]">
      <header className="flex items-center justify-between px-4 py-3 border-b border-[#1e1e30]">
        <div className="flex items-center gap-2">
          <span className="text-lg leading-none">{marketInfo?.icon}</span>
          <span className="font-semibold text-sm">{marketInfo?.symbol} {directionLabel}</span>
          <span className="text-[10px] font-bold px-1.5 py-0.5 rounded tracking-wider bg-[#418cf5]/15 text-[#418cf5]">
            {activePosition.leverage}x
          </span>
        </div>
        <div className="flex items-center gap-1.5">
          <span className={`inline-block w-1.5 h-1.5 rounded-full animate-pulse ${activePosition.isOnChain ? "bg-[#22c55e]" : "bg-yellow-500"}`} />
          <span className="text-[11px] text-muted-foreground">
            {activePosition.isOnChain ? "GMX synced" : "Confirming..."}
          </span>
        </div>
      </header>

      <div className="px-4 py-4">
        <MarketChart
          marketKey={activePosition.marketKey}
          timeframe={liveChartTimeframe}
          onTimeframeChange={setLiveChartTimeframe}
          entryPrice={activePosition.entryPrice}
          isLong={isLong}
        />
      </div>

      <div className="px-4 py-2.5 flex justify-between border-y border-[#1e1e30] text-sm">
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

      <div className="px-4 py-6 text-center">
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

      <div className="px-4 py-3 space-y-2 border-t border-[#1e1e30]">
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
        <div className="mx-4 rounded-xl bg-[#ef4444]/10 border border-[#ef4444]/20 p-3 text-sm text-[#ef4444]">
          {closeError}
        </div>
      )}

      <div className="mt-auto px-4 py-4 border-t border-[#1e1e30]">
        <button
          onClick={handleClose}
          disabled={isClosing}
          className={`w-full min-h-14 rounded-xl font-semibold text-sm border transition-all duration-150 active:scale-[0.98] disabled:opacity-50
            ${pnlPositive
              ? "bg-[#22c55e]/10 text-[#22c55e] border-[#22c55e]/20 hover:bg-[#22c55e]/20"
              : "bg-[#ef4444]/10 text-[#ef4444] border-[#ef4444]/20 hover:bg-[#ef4444]/20"}`}
        >
          {isClosing ? (closePhase === "signing" ? "Check wallet to close..." : "Closing trade...") : closeLabel}
        </button>
      </div>
    </div>
  )
}
