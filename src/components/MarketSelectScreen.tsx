"use client"

import { useAccount } from "wagmi"
import { ConnectKitButton } from "connectkit"
import { useTradeStore } from "@/lib/store"
import { MARKET_LIST } from "@/lib/contracts"
import { useUsdcBalance } from "@/hooks/useUsdcBalance"
import { useEasyMarkets } from "@/lib/gmxMarketData"

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

export function MarketSelectScreen() {
  const { setSelectedMarket } = useTradeStore()
  const { address } = useAccount()
  const { balance } = useUsdcBalance(address)
  const { data: markets, isLoading } = useEasyMarkets()

  return (
    <div className="min-h-screen flex flex-col">
      <header className="flex items-center justify-between px-4 py-3 border-b border-[#1e1e30]">
        <h1 className="text-lg font-bold tracking-tight">
          Easy<span className="text-[#418cf5]">GMX</span>
        </h1>
        <div className="flex items-center gap-3">
          <span className="text-sm font-mono tabular-nums text-muted-foreground">
            {balance.value > 0 ? `${balance.formatted} USDC` : "-"}
          </span>
          <ConnectKitButton />
        </div>
      </header>

      <div className="flex-1 px-4 py-5 space-y-4">
        <h2 className="text-[11px] font-semibold text-muted-foreground tracking-[0.15em] uppercase">
          Choose market
        </h2>
        <div className="space-y-2">
          {MARKET_LIST.map((m) => {
            const data = markets?.[m.key]
            const disabled = !!data && !data.isAvailable
            return (
              <button
                key={m.key}
                onClick={() => !disabled && setSelectedMarket(m.key)}
                disabled={disabled}
                className="w-full p-4 rounded-xl bg-[#12121a] border border-[#1e1e30]
                           hover:border-[#418cf5]/30 active:scale-[0.995] transition-all duration-150
                           disabled:opacity-50 disabled:hover:border-[#1e1e30]"
              >
                <div className="flex items-start justify-between gap-4">
                  <div className="flex items-center gap-3">
                    <span className="text-2xl leading-none">{m.icon}</span>
                    <div className="text-left">
                      <div className="font-semibold text-sm">{m.symbol}</div>
                      <div className="text-[11px] text-muted-foreground">{m.key} Perp</div>
                    </div>
                  </div>
                  <div className="text-right">
                    <div className="font-mono font-semibold text-sm tabular-nums">
                      {data ? `$${formatUsd(data.price)}` : isLoading ? "Loading..." : "-"}
                    </div>
                    <div className="text-[11px] text-muted-foreground">GMX price</div>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-x-5 gap-y-1 pt-4">
                  <Change label="4H" value={data?.change4hPercent} />
                  <Change label="1D" value={data?.change1dPercent} />
                  <Change label="30D" value={data?.change30dPercent} />
                  <Change label="1Y" value={data?.change1yPercent} />
                </div>

                {disabled && (
                  <div className="text-left text-[11px] text-[#ef4444]/80 pt-3">
                    {data?.unavailableReason}
                  </div>
                )}
              </button>
            )
          })}
        </div>
      </div>
    </div>
  )
}
