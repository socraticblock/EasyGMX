"use client"

import { useAccount, useBalance } from "wagmi"
import { WalletButton } from "@/components/WalletButton"
import { ReferralDebugStrip } from "@/components/ReferralDebugStrip"
import { useGmxExecutionFee } from "@/hooks/useGmxExecutionFee"
import { useState, useEffect, useCallback } from "react"
import { useTradeStore } from "@/lib/store"
import { ARBITRUM_CHAIN_ID, DEFAULT_EXECUTION_FEE_ETH, MARKET_LIST, MIN_RISK_USD, SLIPPAGE_BPS, TOKENS } from "@/lib/contracts"
import { estimateFeeBreakdown } from "@/lib/gmxQuote"
import { useUsdcApproval, useCreateOrder, userFacingGmxError } from "@/lib/order"
import { useUsdcBalance } from "@/hooks/useUsdcBalance"
import { useEasyMarkets } from "@/lib/gmxMarketData"
import { buildEasyTradeQuote } from "@/lib/gmxQuote"
import { findMatchingPosition, useEasyPositions } from "@/lib/gmxPositions"
import { MarketChart } from "@/components/MarketChart"

function formatUsd(n: number): string {
  if (!Number.isFinite(n)) return "-"
  if (Math.abs(n) >= 1) return n.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })
  if (Math.abs(n) >= 0.01) return n.toFixed(4)
  return n.toFixed(6)
}

export function TradeSetupScreen() {
  const store = useTradeStore()
  const { direction, riskUsd, leverage, chartTimeframe, hasAcknowledgedRisk } = store
  const [customAmount, setCustomAmount] = useState(String(riskUsd))
  const [showDetails, setShowDetails] = useState(false)
  const [showAdvanced, setShowAdvanced] = useState(false)
  const [approveAll, setApproveAll] = useState(false)
  const [showRiskAck, setShowRiskAck] = useState(false)
  const { address } = useAccount()
  const { balance } = useUsdcBalance(address)
  const { data: ethBalance } = useBalance({ address, chainId: ARBITRUM_CHAIN_ID })
  const { data: markets } = useEasyMarkets()
  const { data: executionFee } = useGmxExecutionFee(store.selectedMarket)
  const ethUsdPrice = markets?.["ETH/USD"]?.price
  const { data: walletPositions } = useEasyPositions(address)
  const marketInfo = MARKET_LIST.find((m) => m.key === store.selectedMarket)
  const market = store.selectedMarket ? markets?.[store.selectedMarket] : undefined
  const isLong = direction === "up"
  const hasExistingSameDirectionPosition = !!(marketInfo && walletPositions && findMatchingPosition(walletPositions, {
    marketAddress: marketInfo.address,
    isLong,
  }))
  const quote = buildEasyTradeQuote({
    market,
    direction,
    riskUsd,
    leverage,
    usdcBalance: balance.value,
    ethBalance: ethBalance ? Number(ethBalance.value) / 1e18 : 0,
    executionFeeEth: executionFee?.eth,
    ethUsdPrice,
    hasExistingSameDirectionPosition,
  })
  const feeBreakdown = quote
    ? estimateFeeBreakdown(quote.sizeUsd, executionFee?.eth, ethUsdPrice)
    : null
  const executionFeeEth = executionFee?.eth ?? DEFAULT_EXECUTION_FEE_ETH
  const collateralRaw = BigInt(Math.round(riskUsd * 1e6))
  const approval = useUsdcApproval(collateralRaw, approveAll)
  const createOrder = useCreateOrder()

  useEffect(() => {
    const acknowledged = typeof window !== "undefined" && window.localStorage.getItem("easygmx:riskAcknowledged") === "true"
    if (acknowledged && !hasAcknowledgedRisk) store.setHasAcknowledgedRisk(true)
  }, [hasAcknowledgedRisk, store])

  const handleAmountInput = useCallback((val: string) => {
    setCustomAmount(val)
    const parsed = parseFloat(val)
    if (Number.isFinite(parsed)) store.setRiskUsd(parsed)
    if (val === "") store.setRiskUsd(0)
  }, [store])

  const acknowledgeRisk = useCallback(() => {
    window.localStorage.setItem("easygmx:riskAcknowledged", "true")
    store.setHasAcknowledgedRisk(true)
    setShowRiskAck(false)
  }, [store])

  async function handleTrade() {
    if (!quote || !marketInfo || !market || !quote.canTrade) return
    if (!store.hasAcknowledgedRisk) {
      setShowRiskAck(true)
      return
    }

    try {
      store.setOrderError(null)
      if (approval.needsApproval) {
        store.setOrderPhase("approval")
        await approval.approveAsync()
      }

      store.setOrderPhase("signing")
      const result = await createOrder.mutateAsync({
        marketKey: quote.marketKey,
        isLong: quote.isLong,
        collateralUsd: quote.riskUsd,
        sizeUsd: quote.sizeUsd,
        currentPrice: quote.estimatedEntryPrice,
      })

      store.setOrderPhase("keeper")
      store.setActivePosition({
        marketKey: quote.marketKey,
        marketAddress: marketInfo.address,
        direction: quote.direction,
        isLong: quote.isLong,
        riskUsd: quote.riskUsd,
        sizeUsd: quote.sizeUsd,
        leverage: quote.leverage,
        entryPrice: quote.estimatedEntryPrice,
        currentPrice: quote.estimatedEntryPrice,
        liquidationPrice: quote.liquidationPrice,
        pnlUsd: 0,
        pnlPercent: 0,
        borrowFeeUsd: 0,
        fundingFeeUsd: 0,
        orderKey: result.orderKey,
        openTxHash: result.txHash,
        closeTxHash: null,
        isOnChain: false,
      })
    } catch (err) {
      store.setOrderError(userFacingGmxError(err, "GMX could not open this trade. Your funds were not used. Try again or choose a smaller amount."))
    }
  }

  const buttonDisabled = !quote || !quote.canTrade || store.orderPhase === "approval" || store.orderPhase === "signing" || createOrder.isPending
  const buttonLabel = (() => {
    if (!quote) return "Loading market..."
    if (!quote.canTrade) return quote.cannotTradeReason ?? "Trade unavailable"
    if (store.orderPhase === "approval") return "Approving USDC..."
    if (store.orderPhase === "signing" || createOrder.isPending) return "Check wallet..."
    if (approval.needsApproval) return approveAll ? "Approve all USDC and start trade" : `Approve $${formatUsd(riskUsd)} USDC and start`
    return "Start Trade"
  })()

  return (
    <div className="min-h-screen flex flex-col">
      <header className="flex items-center gap-3 px-4 py-3 border-b border-[#1e1e30]">
        <button
          onClick={() => {
            store.setSelectedMarket(null)
            store.resetOrderFlow()
          }}
          className="text-muted-foreground hover:text-foreground transition-colors text-sm"
        >
          &larr; Back
        </button>
        <div className="flex-1 text-center">
          <span className="font-semibold text-sm">{marketInfo?.icon} {marketInfo?.symbol}</span>
          <span className="ml-2 font-mono text-xs tabular-nums text-muted-foreground">
            {market ? `$${formatUsd(market.price)}` : "-"}
          </span>
        </div>
        <WalletButton />
      </header>

      <ReferralDebugStrip />

      <div className="flex-1 px-4 py-5 space-y-5 max-w-lg mx-auto w-full">
        <MarketChart
          marketKey={store.selectedMarket}
          timeframe={chartTimeframe}
          onTimeframeChange={store.setChartTimeframe}
          isLong={isLong}
        />

        <div className="space-y-2">
          <label className="text-[11px] font-semibold text-muted-foreground tracking-[0.15em] uppercase">
            What do you think?
          </label>
          <div className="grid grid-cols-2 gap-2">
            <button
              onClick={() => store.setDirection("up")}
              className={`h-12 rounded-xl font-semibold transition-all duration-150
                ${direction === "up"
                  ? "bg-[#22c55e] text-white shadow-lg shadow-[#22c55e]/20"
                  : "bg-[#12121a] border border-[#1e1e30] text-muted-foreground hover:border-[#22c55e]/30"}`}
            >
              Price Up
            </button>
            <button
              onClick={() => store.setDirection("down")}
              className={`h-12 rounded-xl font-semibold transition-all duration-150
                ${direction === "down"
                  ? "bg-[#ef4444] text-white shadow-lg shadow-[#ef4444]/20"
                  : "bg-[#12121a] border border-[#1e1e30] text-muted-foreground hover:border-[#ef4444]/30"}`}
            >
              Price Down
            </button>
          </div>
        </div>

        <div className="space-y-2">
          <div className="flex justify-between items-center">
            <label className="text-[11px] font-semibold text-muted-foreground tracking-[0.15em] uppercase">
              Risk amount
            </label>
            <span className="text-[11px] text-muted-foreground">Balance: {balance.value.toFixed(2)} USDC</span>
          </div>
          <div className="grid grid-cols-4 gap-2">
            {[10, 25, 50, 100].map((v) => (
              <button
                key={v}
                onClick={() => {
                  store.setRiskUsd(v)
                  setCustomAmount(String(v))
                }}
                className={`h-9 rounded-lg text-xs font-medium transition-all
                  ${riskUsd === v
                    ? "bg-[#418cf5]/15 text-[#418cf5] border border-[#418cf5]/30"
                    : "bg-[#12121a] border border-[#1e1e30] text-muted-foreground hover:border-[#418cf5]/20"}`}
              >
                ${v}
              </button>
            ))}
          </div>
          <input
            type="number"
            value={customAmount}
            onChange={(e) => handleAmountInput(e.target.value)}
            placeholder="10.00"
            min={MIN_RISK_USD}
            max={1000}
            step="0.01"
            inputMode="decimal"
            className="w-full h-12 rounded-xl bg-[#12121a] border border-[#1e1e30] px-4 text-base font-mono tabular-nums
                       focus:outline-none focus:border-[#418cf5]/40 focus:ring-1 focus:ring-[#418cf5]/20 transition-all"
          />
        </div>

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

        <div className="rounded-xl bg-[#12121a] border border-[#1e1e30] p-4 space-y-2.5">
          <div className="flex justify-between text-sm">
            <span className="text-muted-foreground">Market</span>
            <span>{marketInfo?.symbol} {direction === "up" ? "Price Up" : "Price Down"}</span>
          </div>
          <div className="flex justify-between text-sm">
            <span className="text-muted-foreground">Risk</span>
            <span className="font-mono tabular-nums">${formatUsd(riskUsd)}</span>
          </div>
          <div className="flex justify-between text-sm">
            <span className="text-muted-foreground">Position</span>
            <span className="font-mono tabular-nums">${formatUsd(quote?.sizeUsd ?? 0)} at {leverage}x</span>
          </div>
          <div className="flex justify-between text-sm">
            <span className="text-muted-foreground">Estimated entry</span>
            <span className="font-mono tabular-nums">${formatUsd(quote?.estimatedEntryPrice ?? 0)}</span>
          </div>
          <div className="flex justify-between text-sm">
            <span className="text-muted-foreground">Max collateral at risk</span>
            <span className="font-mono tabular-nums text-[#ef4444]/90">${formatUsd(riskUsd)}</span>
          </div>
          <div className="flex justify-between text-sm">
            <span className="text-muted-foreground">Liquidation (est.)</span>
            <span className="font-mono tabular-nums">${formatUsd(quote?.liquidationPrice ?? 0)}</span>
          </div>
          {feeBreakdown && (
            <div className="flex justify-between text-sm">
              <span className="text-muted-foreground">Est. GMX fees</span>
              <span className="font-mono tabular-nums text-right text-xs">
                ${feeBreakdown.totalLowUsd.toFixed(2)}–${feeBreakdown.totalHighUsd.toFixed(2)}
              </span>
            </div>
          )}
          <div className="flex justify-between text-sm">
            <span className="text-muted-foreground">Network / execution (est.)</span>
            <span className="font-mono tabular-nums text-xs">
              ~{executionFeeEth.toFixed(6)} ETH
              {feeBreakdown && ethUsdPrice ? ` (~$${feeBreakdown.executionFeeUsd.toFixed(2)})` : ""}
            </span>
          </div>
          <div className="flex justify-between text-sm">
            <span className="text-muted-foreground">Slippage tolerance</span>
            <span>{(SLIPPAGE_BPS / 100).toFixed(1)}%</span>
          </div>
          <p className="text-[11px] text-muted-foreground/80 leading-relaxed pt-1 border-t border-[#1e1e30]">
            Estimated GMX position fee (0.04%–0.06%). Final fees may differ based on GMX market state, price impact, funding, borrowing, and execution. Final entry price may differ from the estimate.
          </p>
          <p className="text-[11px] text-amber-500/80 leading-relaxed">
            Borrow and funding fees are variable and can change while your position is open.
          </p>
          <button
            onClick={() => setShowDetails(!showDetails)}
            className="text-[11px] text-[#418cf5]/70 hover:text-[#418cf5]"
          >
            More details
          </button>
          {showDetails && quote && (
            <div className="text-[11px] text-muted-foreground/80 space-y-1 pt-2 border-t border-[#1e1e30] leading-relaxed">
              <p>Powered by GMX V2. No extra EasyGMX trading fee.</p>
              <p>Borrow rate: {quote.borrowRate?.toFixed(6) ?? "-"}%</p>
              <p>Funding rate: {quote.fundingRate?.toFixed(6) ?? "-"}%</p>
            </div>
          )}
        </div>

        {approval.needsApproval && (
          <div className="rounded-xl bg-[#12121a] border border-[#1e1e30] p-4 space-y-3">
            <p className="text-sm">Allow GMX to use ${formatUsd(riskUsd)} USDC for this trade.</p>
            <p className="text-[11px] text-muted-foreground leading-relaxed">
              Approval lets GMX use your USDC for this trade. Your funds stay in your wallet until you confirm the trade.
            </p>
            <button onClick={() => setShowAdvanced(!showAdvanced)} className="text-[11px] text-[#418cf5]/70">
              Advanced
            </button>
            {showAdvanced && (
              <label className="flex items-center gap-2 text-xs text-muted-foreground">
                <input type="checkbox" checked={approveAll} onChange={(e) => setApproveAll(e.target.checked)} />
                Allow GMX to use USDC for future trades.
              </label>
            )}
          </div>
        )}

        {(store.orderError || approval.approveError) && (
          <div className="rounded-xl bg-[#ef4444]/10 border border-[#ef4444]/20 p-3 text-sm text-[#ef4444]">
            {store.orderError || userFacingGmxError(approval.approveError)}
          </div>
        )}

        <button
          onClick={handleTrade}
          disabled={buttonDisabled}
          className={`w-full min-h-14 rounded-xl font-bold text-base px-3 transition-all duration-150 active:scale-[0.98]
            ${isLong
              ? "bg-[#22c55e] hover:bg-[#22c55e]/90 text-white shadow-lg shadow-[#22c55e]/20 disabled:opacity-40"
              : "bg-[#ef4444] hover:bg-[#ef4444]/90 text-white shadow-lg shadow-[#ef4444]/20 disabled:opacity-40"}`}
        >
          {buttonLabel}
        </button>

        <p className="text-[11px] text-muted-foreground/50 text-center leading-relaxed">
          This opens a real GMX V2 leveraged position. You can lose your full collateral/risk amount. EasyGMX simplifies the interface; it does not remove trading risk.
        </p>
      </div>

      {showRiskAck && (
        <div className="fixed inset-0 z-50 bg-black/80 flex items-center justify-center px-4">
          <div className="max-w-sm w-full rounded-xl bg-[#12121a] border border-[#1e1e30] p-5 space-y-4">
            <h2 className="text-lg font-bold">Real GMX trade</h2>
            <p className="text-sm text-muted-foreground leading-relaxed">
              EasyGMX uses real GMX trades. You can lose your full risk amount. Prices can move quickly. Only trade what you are willing to lose.
            </p>
            <button onClick={acknowledgeRisk} className="w-full h-11 rounded-xl bg-[#418cf5] text-white font-semibold">
              I understand
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
