"use client"

import { useAccount, useBalance, useConnect, useSwitchChain } from "wagmi"
import { WalletButton } from "@/components/WalletButton"
import { ReferralDebugStrip } from "@/components/ReferralDebugStrip"
import { useGmxExecutionFee } from "@/hooks/useGmxExecutionFee"
import { useState, useEffect, useCallback } from "react"
import { useTradeStore } from "@/lib/store"
import { ARBITRUM_CHAIN_ID, DEFAULT_EXECUTION_FEE_ETH, MARKET_LIST, MIN_RISK_USD, SLIPPAGE_BPS, TOKENS } from "@/lib/contracts"
import {
  estimateFeeBreakdown,
  buildEasyTradeQuote,
  getTradeBlockButtonLabel,
  getTradeBlockExplanation,
} from "@/lib/gmxQuote"
import { useUsdcApproval, useCreateOrder, userFacingGmxError } from "@/lib/order"
import { useUsdcBalance } from "@/hooks/useUsdcBalance"
import { useEasyMarkets } from "@/lib/gmxMarketData"
import { findMatchingPosition, useEasyPositions } from "@/lib/gmxPositions"
import { MarketChart } from "@/components/MarketChart"
import "@/app/trade-setup.css"

function formatUsdcAmount(n: number): string {
  if (!Number.isFinite(n)) return "-"
  return n.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })
}

function formatUsd(n: number): string {
  if (!Number.isFinite(n)) return "-"
  if (Math.abs(n) >= 1) return n.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })
  if (Math.abs(n) >= 0.01) return n.toFixed(4)
  return n.toFixed(6)
}

const CHART_HEIGHT = "clamp(170px, 30vw, 500px)"

export function TradeSetupScreen() {
  const store = useTradeStore()
  const { direction, riskUsd, leverage, chartTimeframe, hasAcknowledgedRisk } = store
  const [customAmount, setCustomAmount] = useState(String(riskUsd))
  const [showDetails, setShowDetails] = useState(false)
  const [showAdvanced, setShowAdvanced] = useState(false)
  const [approveAll, setApproveAll] = useState(false)
  const [showRiskAck, setShowRiskAck] = useState(false)
  const { address, isConnected, chainId } = useAccount()
  const { connectors, connect, isPending: connectPending } = useConnect()
  const { switchChain, isPending: switchPending } = useSwitchChain()
  const { balance, legacyBalance, isLoading: balanceLoading } = useUsdcBalance(address)
  const { data: ethBalance } = useBalance({ address, chainId: ARBITRUM_CHAIN_ID })
  const { data: markets, dataUpdatedAt: marketsUpdatedAt, refetch: refetchMarkets, isFetching: marketsFetching } = useEasyMarkets()
  const { data: executionFee } = useGmxExecutionFee(store.selectedMarket)
  const ethUsdPrice = markets?.["ETH/USD"]?.price
  const { data: walletPositions } = useEasyPositions(address)
  const marketInfo = MARKET_LIST.find((m) => m.key === store.selectedMarket)
  const market = store.selectedMarket ? markets?.[store.selectedMarket] : undefined
  const isLong = direction === "up"
  const marketLabel = marketInfo?.symbol ?? "Market"
  const directionLabel = direction === "up" ? "Price Up" : "Price Down"
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

  const walletReady = isConnected && chainId === ARBITRUM_CHAIN_ID
  const quoteAgeMs = marketsUpdatedAt ? Date.now() - marketsUpdatedAt : 0
  const quoteIsStale = walletReady && !!quote && quoteAgeMs > 90_000
  const canTrade = !!(quote?.canTrade && walletReady && !quoteIsStale)
  const quoteBlocked = walletReady && quote && !quote.canTrade
  const showApproval = canTrade && !approval.loadingAllowance && approval.needsApproval
  const showOpenTrade = canTrade && !approval.loadingAllowance && !approval.needsApproval
  const isBusy = store.orderPhase === "approval" || store.orderPhase === "signing" || createOrder.isPending

  const primaryConnector =
    connectors.find((c) => c.id === "injected" || c.type === "injected") ?? connectors[0]

  const handleConnectWallet = () => {
    if (primaryConnector) connect({ connector: primaryConnector })
  }

  const handleSwitchNetwork = () => {
    switchChain({ chainId: ARBITRUM_CHAIN_ID })
  }

  const effectiveBlockReason = quoteIsStale ? "stale_quote" : quote?.blockReason
  const quoteBlockExplanation = walletReady && quote && effectiveBlockReason
    ? getTradeBlockExplanation(effectiveBlockReason, {
        riskUsd,
        usdcBalance: balance.value,
        marketLabel,
        directionLabel,
      })
    : null

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

  async function handleApprove() {
    if (!canTrade) return
    try {
      store.setOrderError(null)
      store.setOrderPhase("approval")
      await approval.approveAsync()
      store.setOrderPhase("idle")
    } catch (err) {
      store.setOrderError(userFacingGmxError(err, "USDC approval failed. Try again in your wallet."))
      store.setOrderPhase("idle")
    }
  }

  async function handleOpenTrade() {
    if (!quote || !marketInfo || !market || !canTrade) return
    if (!store.hasAcknowledgedRisk) {
      setShowRiskAck(true)
      return
    }

    try {
      store.setOrderError(null)
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
      store.setOrderPhase("idle")
    }
  }

  const approvalLabel = (() => {
    if (store.orderPhase === "approval") return "Approving USDC..."
    if (approveAll) return "Allow GMX to use USDC"
    return `Allow GMX to use ${formatUsdcAmount(riskUsd)} USDC`
  })()
  const tradeLabel = (() => {
    if (store.orderPhase === "signing" || createOrder.isPending) return "Check wallet..."
    return `Open ${marketLabel} ${directionLabel} trade`
  })()

  const change1d = market?.change1dPercent ?? 0
  const changePositive = change1d >= 0

  const tradeActions = (
    <>
      {(store.orderError || approval.approveError) && (
        <div className="rounded-xl bg-[#ef4444]/10 border border-[#ef4444]/20 p-3 text-sm text-[#ef4444]">
          {store.orderError || userFacingGmxError(approval.approveError)}
        </div>
      )}

      {!isConnected ? (
        <div>
          <button
            type="button"
            onClick={handleConnectWallet}
            disabled={!primaryConnector || connectPending}
            className="trade-action-btn trade-action-btn--wallet"
          >
            {connectPending ? "Connecting..." : "Connect wallet"}
          </button>
          <p className="trade-block-explanation">
            Connect your wallet to review and open a real GMX V2 trade.
          </p>
        </div>
      ) : chainId !== ARBITRUM_CHAIN_ID ? (
        <div>
          <button
            type="button"
            onClick={handleSwitchNetwork}
            disabled={switchPending}
            className="trade-action-btn trade-action-btn--wallet"
          >
            {switchPending ? "Switching..." : "Switch to Arbitrum"}
          </button>
          <p className="trade-block-explanation">
            Switch your wallet to Arbitrum to trade on GMX V2.
          </p>
        </div>
      ) : !quote ? (
        <div>
          <button type="button" disabled className="trade-action-btn trade-action-btn--blocked">
            Loading market...
          </button>
        </div>
      ) : quoteBlocked || quoteIsStale ? (
        <div>
          <button type="button" disabled className="trade-action-btn trade-action-btn--blocked">
            {getTradeBlockButtonLabel(effectiveBlockReason)}
          </button>
          {quoteBlockExplanation && (
            <p className="trade-block-explanation">{quoteBlockExplanation}</p>
          )}
          {quoteIsStale && (
            <button
              type="button"
              onClick={() => refetchMarkets()}
              disabled={marketsFetching}
              className="mt-2 w-full min-h-10 rounded-xl border border-[#418cf5]/25 bg-[#418cf5]/10 text-sm font-semibold text-[#418cf5] transition-colors hover:bg-[#418cf5]/15 disabled:opacity-60"
            >
              {marketsFetching ? "Refreshing..." : "Refresh quote"}
            </button>
          )}
        </div>
      ) : (
        <>
          <div className="trade-risk-strip">
            <p className="trade-risk-strip-main">
              Risk: You can lose your full {formatUsdcAmount(riskUsd)} USDC risk amount.
            </p>
            <p className="trade-risk-strip-sub">
              EasyGMX simplifies the interface; it does not remove GMX trading risk.
            </p>
          </div>

          {approval.loadingAllowance && (
            <button type="button" disabled className="trade-action-btn trade-action-btn--checking">
              Checking USDC allowance...
            </button>
          )}

          {showApproval && (
            <div className="space-y-2">
              <button
                onClick={handleApprove}
                disabled={isBusy}
                className="trade-action-btn trade-action-btn--approve"
              >
                {approvalLabel}
              </button>
              <p className="text-[11px] text-muted-foreground text-center leading-relaxed">
                This approval does not open a trade yet.
              </p>
              <button onClick={() => setShowAdvanced(!showAdvanced)} className="text-[11px] text-[#418cf5]/70 mx-auto block">
                Advanced
              </button>
              {showAdvanced && (
                <label className="flex items-center gap-2 text-xs text-muted-foreground justify-center">
                  <input type="checkbox" checked={approveAll} onChange={(e) => setApproveAll(e.target.checked)} />
                  Allow GMX to use USDC for future trades.
                </label>
              )}
            </div>
          )}

          {showOpenTrade && (
            <button
              onClick={handleOpenTrade}
              disabled={isBusy}
              className={`trade-action-btn ${isLong ? "trade-action-btn--long" : "trade-action-btn--short"}`}
            >
              {tradeLabel}
            </button>
          )}
        </>
      )}
    </>
  )

  return (
    <div className="app-screen">
      <header className="app-header">
        <button
          type="button"
          onClick={() => {
            store.setSelectedMarket(null)
            store.resetOrderFlow()
          }}
          className="text-sm text-muted-foreground hover:text-foreground transition-colors shrink-0"
        >
          &larr; Back
        </button>
        <div className="app-header-title">
          <span className="font-semibold text-sm">{marketInfo?.icon} {marketInfo?.symbol}</span>
          <span className="ml-2 font-mono text-xs tabular-nums text-muted-foreground">
            {market ? `$${formatUsd(market.price)}` : "-"}
          </span>
        </div>
        <div className="shrink-0">
          <WalletButton />
        </div>
      </header>

      <ReferralDebugStrip />

      <div className="trade-setup-body">
        <div className="trade-setup-grid">
          <div className="trade-setup-chart-col">
            <div className="trade-chart-shell">
              <MarketChart
                marketKey={store.selectedMarket}
                timeframe={chartTimeframe}
                onTimeframeChange={store.setChartTimeframe}
                isLong={isLong}
                chartHeight={CHART_HEIGHT}
              />
            </div>
            {market && (
              <div className="trade-market-note">
                <div className="trade-market-note-label">GMX market price</div>
                <div className="trade-market-note-price">${formatUsd(market.price)}</div>
                <div className={`trade-market-note-change ${changePositive ? "text-[#22c55e]" : "text-[#ef4444]"}`}>
                  24h {changePositive ? "+" : ""}{change1d.toFixed(2)}%
                </div>
                <p className="trade-market-note-caption">
                  Oracle price from GMX V2. Final entry may differ slightly at execution.
                </p>
              </div>
            )}
            <p className="trade-mobile-chart-hint">
              Chart shows GMX oracle price. Scroll the ticket below to review your order, or use the action at the bottom.
            </p>
          </div>

          <div className="trade-setup-ticket">
            <div className="trade-order-ticket-card">
              <div className="trade-ticket-section">
                <div className="trade-ticket-section-title">1. Direction</div>
                <p className="text-sm font-medium mb-2.5">Do you think {marketLabel} goes up or down?</p>
                <div className="grid grid-cols-2 gap-2">
                  <button
                    onClick={() => store.setDirection("up")}
                    className={`h-11 rounded-xl font-semibold text-sm transition-all duration-150
                      ${direction === "up"
                        ? "bg-[#22c55e] text-white shadow-lg shadow-[#22c55e]/20"
                        : "bg-[#12121a] border border-[#1e1e30] text-muted-foreground hover:border-[#22c55e]/30"}`}
                  >
                    Price Up
                  </button>
                  <button
                    onClick={() => store.setDirection("down")}
                    className={`h-11 rounded-xl font-semibold text-sm transition-all duration-150
                      ${direction === "down"
                        ? "bg-[#ef4444] text-white shadow-lg shadow-[#ef4444]/20"
                        : "bg-[#12121a] border border-[#1e1e30] text-muted-foreground hover:border-[#ef4444]/30"}`}
                  >
                    Price Down
                  </button>
                </div>
              </div>

              <div className="trade-ticket-section">
                <div className="trade-ticket-section-title">2. USDC risk</div>
                <div className="flex justify-between items-center gap-2 mb-2">
                  <p className="text-sm font-medium">How much USDC are you willing to put at risk?</p>
                  <span className="text-[11px] text-muted-foreground shrink-0">
                    {balanceLoading ? "Loading..." : `${balance.value.toFixed(2)} USDC`}
                  </span>
                </div>
                {walletReady && (
                  <div className="mb-3 rounded-xl border border-[#1e1e30] bg-[#12121a]/70 p-3 text-[11px] leading-relaxed text-muted-foreground">
                    <p>Arbitrum USDC available for GMX: <span className="font-mono text-foreground">{balance.formatted}</span></p>
                    {legacyBalance.value > 0 && (
                      <>
                        <p>Legacy USDC.e detected: <span className="font-mono text-amber-400">{legacyBalance.formatted}</span></p>
                        <p>GMX V2 uses native Arbitrum USDC for this flow.</p>
                      </>
                    )}
                  </div>
                )}
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
                  className="w-full h-11 mt-2 rounded-xl bg-[#12121a] border border-[#1e1e30] px-4 text-sm font-mono tabular-nums
                             focus:outline-none focus:border-[#418cf5]/40 focus:ring-1 focus:ring-[#418cf5]/20 transition-all"
                />
              </div>

              <div className="trade-ticket-section">
                <div className="trade-ticket-section-title">3. Leverage</div>
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
                {leverage === 10 && (
                  <p className="trade-leverage-warning mt-2">
                    10x leverage is higher risk. A smaller {marketLabel} price move can liquidate your position.
                  </p>
                )}
              </div>

              <div className="trade-ticket-section">
                <div className="trade-ticket-section-title">4. Review GMX order</div>
                <div className="trade-review-box space-y-0">
                  <div className="trade-review-row">
                    <span className="trade-review-label">Market</span>
                    <span className="trade-review-value">{marketInfo?.symbol} {directionLabel}</span>
                  </div>
                  <div className="trade-review-row">
                    <span className="trade-review-label">Risk</span>
                    <span className="trade-review-value">{formatUsdcAmount(riskUsd)} USDC</span>
                  </div>
                  <div className="trade-review-row">
                    <span className="trade-review-label">Position size</span>
                    <span className="trade-review-value">${formatUsd(quote?.sizeUsd ?? 0)} at {leverage}x</span>
                  </div>
                  <div className="trade-review-row">
                    <span className="trade-review-label">Estimated entry</span>
                    <span className="trade-review-value">${formatUsd(quote?.estimatedEntryPrice ?? 0)}</span>
                  </div>
                  <div className="trade-review-row">
                    <span className="trade-review-label">Estimated liquidation</span>
                    <span className="trade-review-value trade-review-value--liquidation">${formatUsd(quote?.liquidationPrice ?? 0)}</span>
                  </div>
                  <div className="trade-review-row">
                    <span className="trade-review-label">Max you can lose</span>
                    <span className="trade-review-value trade-review-value--loss">{formatUsdcAmount(riskUsd)} USDC</span>
                  </div>
                  {feeBreakdown && (
                    <div className="trade-review-row">
                      <span className="trade-review-label">Est. GMX fees</span>
                      <span className="trade-review-value text-xs">
                        ${feeBreakdown.totalLowUsd.toFixed(2)}–${feeBreakdown.totalHighUsd.toFixed(2)}
                      </span>
                    </div>
                  )}
                  <div className="trade-review-row">
                    <span className="trade-review-label">Network / execution (est.)</span>
                    <span className="trade-review-value text-xs">
                      ~{executionFeeEth.toFixed(6)} ETH
                      {feeBreakdown && ethUsdPrice ? ` (~$${feeBreakdown.executionFeeUsd.toFixed(2)})` : ""}
                    </span>
                  </div>
                  <div className="trade-review-row">
                    <span className="trade-review-label">Slippage tolerance</span>
                    <span className="trade-review-value">{(SLIPPAGE_BPS / 100).toFixed(1)}%</span>
                  </div>
                </div>
                <p className="text-[11px] text-muted-foreground/80 leading-relaxed mt-3">
                  Borrow and funding fees are variable and can change while your position is open.
                </p>
                <button
                  onClick={() => setShowDetails(!showDetails)}
                  className="text-[11px] text-[#418cf5]/70 hover:text-[#418cf5] mt-2"
                >
                  More details
                </button>
                {showDetails && quote && (
                  <div className="text-[11px] text-muted-foreground/80 space-y-1 pt-2 mt-2 border-t border-[#1e1e30] leading-relaxed">
                    <p>Powered by GMX V2. No extra EasyGMX trading fee.</p>
                    <p>Borrow rate: {quote.borrowRate?.toFixed(6) ?? "-"}%</p>
                    <p>Funding rate: {quote.fundingRate?.toFixed(6) ?? "-"}%</p>
                  </div>
                )}
              </div>
            </div>

            <div className="trade-action-region trade-action-region--desktop">
              {tradeActions}
            </div>
          </div>
        </div>
      </div>

      <div className="trade-action-sticky trade-action-sticky--mobile">
        {tradeActions}
      </div>

      {showRiskAck && (
        <div className="responsive-dialog-shell">
          <div className="responsive-dialog-panel space-y-4">
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
