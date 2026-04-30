"use client"

import { useAccount } from "wagmi"
import { ConnectKitButton } from "connectkit"
import { useTradeStore } from "@/lib/store"
import { MARKET_LIST } from "@/lib/contracts"
import { useUsdcApproval, useCreateOrder } from "@/lib/order"
import { useUsdcBalance } from "@/hooks/useUsdcBalance"
import { fetchMarketPrices, estimateFee, estimateLiquidationPrice, validateTradeAmount, type MarketPriceData } from "@/lib/api"
import { useState, useEffect, useCallback } from "react"

function formatUsd(n: number): string {
  if (!Number.isFinite(n)) return "\u2014"
  if (Math.abs(n) >= 1) return n.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })
  if (Math.abs(n) >= 0.01) return n.toFixed(4)
  return n.toFixed(6)
}

export function TradeSetupScreen() {
  const store = useTradeStore()
  const { direction, amount, leverage } = store
  const [prices, setPrices] = useState<Record<string, MarketPriceData>>({})
  const [showFeeInfo, setShowFeeInfo] = useState(false)
  const [customAmount, setCustomAmount] = useState("")
  const { address } = useAccount()
  const { balance } = useUsdcBalance(address)

  const marketInfo = MARKET_LIST.find((m) => m.key === store.selectedMarket)
  const marketData = marketInfo ? prices[marketInfo.symbol] : undefined
  const currentPrice = marketData?.price ?? 0
  const isLong = direction === "long"
  const sizeUsd = amount * leverage
  const fee = estimateFee(sizeUsd, marketData?.borrowRateLong)
  const liqPrice = currentPrice > 0 ? estimateLiquidationPrice(currentPrice, isLong, leverage) : 0
  const validationError = amount > 0 ? validateTradeAmount(amount, balance.value) : null

  // Approval
  const collateralRaw = BigInt(Math.round(amount * Math.pow(10, 6)))
  const approval = useUsdcApproval(collateralRaw)
  const createOrder = useCreateOrder()

  // Price polling
  useEffect(() => {
    let alive = true
    const load = async () => {
      const p = await fetchMarketPrices()
      if (alive) setPrices(p)
    }
    load()
    const iv = setInterval(load, 3_000)
    return () => { alive = false; clearInterval(iv) }
  }, [])

  // Max button
  const setMaxAmount = useCallback(() => {
    const maxAmount = Math.floor(balance.value * 0.95 * 100) / 100 // leave 5% for fees
    if (maxAmount > 0) {
      store.setAmount(maxAmount)
      setCustomAmount(maxAmount.toString())
    }
  }, [balance.value, store])

  // Amount input handler
  const handleAmountInput = useCallback((val: string) => {
    setCustomAmount(val)
    const parsed = parseFloat(val)
    if (Number.isFinite(parsed) && parsed >= 0) {
      store.setAmount(parsed)
    } else if (val === "") {
      store.setAmount(0)
    }
  }, [store])

  // Trade execution flow
  const handleTrade = useCallback(async () => {
    if (!marketInfo || currentPrice <= 0 || amount <= 0 || validationError) return

    try {
      // Step 1: Approve USDC if needed
      if (approval.needsApproval) {
        store.setOrderPhase("approving")
        await approval.approve()
      }

      // Step 2: Send transaction
      store.setOrderPhase("signing")
      const result = await createOrder.mutateAsync({
        marketKey: store.selectedMarket!,
        isLong,
        collateralUsd: amount,
        sizeUsd,
        currentPrice,
      })

      // Step 3: Transaction submitted, waiting for keeper
      store.setOrderPhase("keeper")
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
        borrowFeeHourly: fee.borrowFeeHourly,
        fundingRateAnnual: isLong ? (marketData?.fundingRateLong ?? 0) : (marketData?.fundingRateShort ?? 0),
        orderKey: result.orderKey,
        openTxHash: result.txHash,
        closeTxHash: null,
        isOnChain: false,
      })
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : "Transaction failed"
      store.setOrderError(message)
    }
  }, [marketInfo, currentPrice, amount, validationError, approval, createOrder, store, isLong, sizeUsd, liqPrice, fee, marketData])

  // Can we trade?
  const canTrade = amount > 0 && !validationError && currentPrice > 0

  // Button state
  const isApproving = store.orderPhase === "approving"
  const isSigning = store.orderPhase === "signing"

  let buttonLabel: string
  let buttonDisabled: boolean

  if (amount <= 0) {
    buttonLabel = "Enter an amount"
    buttonDisabled = true
  } else if (validationError) {
    buttonLabel = validationError
    buttonDisabled = true
  } else if (approval.needsApproval && !isApproving) {
    buttonLabel = "Approve USDC first"
    buttonDisabled = false
  } else if (isApproving) {
    buttonLabel = "Approving USDC..."
    buttonDisabled = true
  } else if (isSigning) {
    buttonLabel = "Check wallet..."
    buttonDisabled = true
  } else if (createOrder.isPending) {
    buttonLabel = "Submitting..."
    buttonDisabled = true
  } else {
    buttonLabel = `Open ${isLong ? "Long" : "Short"} \u2014 $${formatUsd(sizeUsd)}`
    buttonDisabled = false
  }

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
          <span className="font-semibold text-sm">
            {marketInfo?.icon} {marketInfo?.key}
          </span>
          <span className="ml-2 font-mono text-xs tabular-nums text-muted-foreground">
            ${currentPrice > 0 ? formatUsd(currentPrice) : "\u2014"}
          </span>
        </div>
        <ConnectKitButton />
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
              &uarr; Up
            </button>
            <button
              onClick={() => store.setDirection("short")}
              className={`h-12 rounded-xl font-semibold transition-all duration-150
                ${!isLong
                  ? "bg-[#ef4444] text-white shadow-lg shadow-[#ef4444]/20"
                  : "bg-[#12121a] border border-[#1e1e30] text-muted-foreground hover:border-[#ef4444]/30"}`}
            >
              &darr; Down
            </button>
          </div>
        </div>

        {/* Amount */}
        <div className="space-y-2">
          <div className="flex justify-between items-center">
            <label className="text-[11px] font-semibold text-muted-foreground tracking-[0.15em] uppercase">
              Amount (USDC)
            </label>
            <div className="flex items-center gap-2">
              <span className="text-[11px] text-muted-foreground">
                Balance: {balance.value.toFixed(2)}
              </span>
              <button
                onClick={setMaxAmount}
                className="text-[10px] font-semibold text-[#418cf5]/70 hover:text-[#418cf5] transition-colors"
              >
                MAX
              </button>
            </div>
          </div>
          <div className="flex gap-2">
            {[10, 25, 50, 100].map((v) => (
              <button
                key={v}
                onClick={() => {
                  store.setAmount(v)
                  setCustomAmount(v.toString())
                }}
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
            value={customAmount || (amount > 0 ? amount : "")}
            onChange={(e) => handleAmountInput(e.target.value)}
            placeholder="0.00"
            min="0"
            step="0.01"
            inputMode="decimal"
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
                aria-label="Fee breakdown"
              >
                &#x2139;
              </button>
            </span>
            <span className="font-mono tabular-nums">${fee.total.toFixed(2)}</span>
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
          {marketData && (
            <div className="flex justify-between text-sm">
              <span className="text-muted-foreground">Borrow rate</span>
              <span className="font-mono tabular-nums text-muted-foreground">
                {(isLong ? marketData.borrowRateLong : marketData.borrowRateShort).toFixed(6)}/hr
              </span>
            </div>
          )}
          {showFeeInfo && (
            <div className="text-[11px] text-muted-foreground/80 space-y-1 pt-2 border-t border-[#1e1e30] leading-relaxed">
              <p>Position fee: 0.05% of size (${fee.positionFee.toFixed(2)})</p>
              <p>Execution fee: ~$0.15 (keeper gas)</p>
              <p>Borrow fee: hourly rate while position is open</p>
              <p>Slippage tolerance: 0.5%</p>
            </div>
          )}
        </div>

        {/* Error display */}
        {(store.orderError || approval.approveError) && (
          <div className="rounded-xl bg-[#ef4444]/10 border border-[#ef4444]/20 p-3 text-sm text-[#ef4444]">
            {store.orderError || approval.approveError?.message || "Unknown error"}
          </div>
        )}

        {/* Trade button */}
        <button
          onClick={handleTrade}
          disabled={buttonDisabled}
          className={`w-full h-14 rounded-xl font-bold text-base transition-all duration-150 active:scale-[0.98]
            ${isLong
              ? "bg-[#22c55e] hover:bg-[#22c55e]/90 text-white shadow-lg shadow-[#22c55e]/20 disabled:opacity-40"
              : "bg-[#ef4444] hover:bg-[#ef4444]/90 text-white shadow-lg shadow-[#ef4444]/20 disabled:opacity-40"}`}
        >
          {buttonLabel}
        </button>

        <p className="text-[11px] text-muted-foreground/40 text-center leading-relaxed">
          This opens a real {leverage}x {isLong ? "long" : "short"} position on GMX V2.
          {" "}You can lose your entire ${amount.toFixed(2)} collateral.
        </p>
      </div>
    </div>
  )
}
