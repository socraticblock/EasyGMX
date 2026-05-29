"use client"

import { useState } from "react"
import { useAccount } from "wagmi"
import { WalletButton } from "@/components/WalletButton"
import { ReferralDebugStrip } from "@/components/ReferralDebugStrip"
import { useTradeStore } from "@/lib/store"
import { getV1PrimaryMarket, getV1SecondaryMarkets } from "@/lib/contracts"
import { useUsdcBalance } from "@/hooks/useUsdcBalance"
import { useEasyMarkets, mergeMarketTrends, useEasyMarketTrends, type EasyMarket } from "@/lib/gmxMarketData"
import type { MarketInfo } from "@/lib/contracts"

function formatUsd(n: number): string {
  if (!Number.isFinite(n) || n <= 0) return "-"
  if (Math.abs(n) >= 1) return n.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })
  if (Math.abs(n) >= 0.01) return n.toFixed(4)
  return n.toFixed(6)
}

function Change({ label, value }: { label: string; value?: number }) {
  const n = Number.isFinite(value) ? value! : 0
  const positive = n >= 0
  return (
    <div className="flex justify-between text-[11px]">
      <span className="text-muted-foreground">{label}</span>
      <span className={`font-mono tabular-nums ${positive ? "text-[#22c55e]" : "text-[#ef4444]"}`}>
        {positive ? "+" : ""}{n.toFixed(1)}%
      </span>
    </div>
  )
}

function MarketCard({
  m,
  data,
  isLoading,
  disabled,
  onSelect,
  compact = false,
}: {
  m: MarketInfo
  data: EasyMarket | undefined
  isLoading: boolean
  disabled: boolean
  onSelect: () => void
  compact?: boolean
}) {
  return (
    <button
      onClick={onSelect}
      disabled={disabled}
      className={`w-full rounded-xl bg-[#12121a] border border-[#1e1e30]
                 hover:border-[#418cf5]/30 active:scale-[0.995] transition-all duration-150
                 disabled:opacity-50 disabled:hover:border-[#1e1e30]
                 ${compact ? "p-3" : "p-4"}`}
    >
      <div className="flex items-start justify-between gap-4">
        <div className="flex items-center gap-3">
          <span className={`leading-none ${compact ? "text-xl" : "text-2xl"}`}>{m.icon}</span>
          <div className="text-left">
            <div className={`font-semibold ${compact ? "text-xs" : "text-sm"}`}>{m.symbol}</div>
            <div className="text-[11px] text-muted-foreground">{m.key} Perp</div>
          </div>
        </div>
        <div className="text-right">
          <div className={`font-mono font-semibold tabular-nums ${compact ? "text-xs" : "text-sm"}`}>
            {data ? `$${formatUsd(data.price)}` : isLoading ? "Loading..." : "-"}
          </div>
          <div className="text-[11px] text-muted-foreground">GMX price</div>
        </div>
      </div>

      {!compact && (
        <div className="grid grid-cols-2 gap-x-5 gap-y-1 pt-4">
          <Change label="4H" value={data?.change4hPercent} />
          <Change label="1D" value={data?.change1dPercent} />
          <Change label="30D" value={data?.change30dPercent} />
          <Change label="1Y" value={data?.change1yPercent} />
        </div>
      )}

      {disabled && (
        <div className="text-left text-[11px] text-[#ef4444]/80 pt-3">
          {data?.unavailableReason}
        </div>
      )}
    </button>
  )
}

export function MarketSelectScreen() {
  const { setSelectedMarket, closeMarketPicker } = useTradeStore()
  const { address } = useAccount()
  const { balance } = useUsdcBalance(address)
  const { data: coreMarkets, isLoading } = useEasyMarkets()
  const { data: trends } = useEasyMarketTrends(true)
  const markets = mergeMarketTrends(coreMarkets, trends)
  const [showMore, setShowMore] = useState(false)

  const primary = getV1PrimaryMarket()
  const secondary = getV1SecondaryMarkets()
  const primaryData = markets?.[primary.key]
  const primaryDisabled = !!primaryData && !primaryData.isAvailable

  return (
    <div className="min-h-screen flex flex-col">
      <header className="flex items-center justify-between px-4 py-3 border-b border-[#1e1e30]">
        <button
          type="button"
          onClick={() => closeMarketPicker()}
          className="text-sm text-muted-foreground hover:text-foreground transition-colors"
        >
          &larr; Home
        </button>
        <h1 className="text-sm font-semibold">All markets</h1>
        <div className="flex items-center gap-3">
          <span className="hidden sm:inline text-sm font-mono tabular-nums text-muted-foreground">
            {balance.value > 0 ? `${balance.formatted} USDC` : "-"}
          </span>
          <WalletButton />
        </div>
      </header>

      <ReferralDebugStrip />

      <div className="flex-1 px-4 py-5 space-y-4">
        <div className="space-y-1">
          <h2 className="text-[11px] font-semibold text-muted-foreground tracking-[0.15em] uppercase">
            V1 market
          </h2>
          <p className="text-[11px] text-muted-foreground/70 leading-relaxed">
            EasyGMX V1 focuses on ETH first. Other markets are available but less tested.
          </p>
        </div>

        <MarketCard
          m={primary}
          data={primaryData}
          isLoading={isLoading}
          disabled={primaryDisabled}
          onSelect={() => !primaryDisabled && setSelectedMarket(primary.key)}
        />

        <div className="space-y-2 pt-2">
          <button
            type="button"
            onClick={() => setShowMore(!showMore)}
            className="w-full flex items-center justify-between text-[11px] font-semibold text-muted-foreground tracking-[0.15em] uppercase"
          >
            <span>More markets</span>
            <span className="text-[#418cf5]/70">{showMore ? "Hide" : "Show"}</span>
          </button>
          {showMore && (
            <div className="space-y-2">
              {secondary.map((m) => {
                const data = markets?.[m.key]
                const disabled = !!data && !data.isAvailable
                return (
                  <MarketCard
                    key={m.key}
                    m={m}
                    data={data}
                    isLoading={isLoading}
                    disabled={disabled}
                    compact
                    onSelect={() => !disabled && setSelectedMarket(m.key)}
                  />
                )
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
