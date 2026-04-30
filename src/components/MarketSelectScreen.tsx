"use client"

import { useAccount } from "wagmi"
import { ConnectKitButton } from "connectkit"
import { useTradeStore } from "@/lib/store"
import { MARKET_LIST } from "@/lib/contracts"
import { useUsdcBalance } from "@/hooks/useUsdcBalance"
import { fetchMarketPrices, type MarketPriceData } from "@/lib/api"
import { useState, useEffect } from "react"

function formatUsd(n: number): string {
  if (!Number.isFinite(n)) return "\u2014"
  if (Math.abs(n) >= 1) return n.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })
  if (Math.abs(n) >= 0.01) return n.toFixed(4)
  return n.toFixed(6)
}

function formatOi(usd: number): string {
  if (usd >= 1e6) return `$${(usd / 1e6).toFixed(1)}M`
  if (usd >= 1e3) return `$${(usd / 1e3).toFixed(0)}K`
  return `$${usd.toFixed(0)}`
}

export function MarketSelectScreen() {
  const { setSelectedMarket } = useTradeStore()
  const [prices, setPrices] = useState<Record<string, MarketPriceData>>({})
  const { address } = useAccount()
  const { balance } = useUsdcBalance(address)

  useEffect(() => {
    let alive = true
    const load = async () => {
      const p = await fetchMarketPrices()
      if (alive) setPrices(p)
    }
    load()
    const iv = setInterval(load, 5_000)
    return () => { alive = false; clearInterval(iv) }
  }, [])

  return (
    <div className="min-h-screen flex flex-col">
      <header className="flex items-center justify-between px-4 py-3 border-b border-[#1e1e30]">
        <h1 className="text-lg font-bold tracking-tight">
          Easy<span className="text-[#418cf5]">GMX</span>
        </h1>
        <div className="flex items-center gap-3">
          <span className="text-sm font-mono tabular-nums text-muted-foreground">
            {balance.value > 0 ? `${balance.formatted} USDC` : "\u2014"}
          </span>
          <ConnectKitButton />
        </div>
      </header>

      <div className="flex-1 px-4 py-5 space-y-4">
        <h2 className="text-[11px] font-semibold text-muted-foreground tracking-[0.15em] uppercase">
          Select a market
        </h2>
        <div className="space-y-2">
          {MARKET_LIST.map((m) => {
            const data = prices[m.symbol]
            return (
              <button
                key={m.key}
                onClick={() => setSelectedMarket(m.key)}
                className="w-full flex items-center justify-between p-4 rounded-xl bg-[#12121a] border border-[#1e1e30]
                           hover:border-[#418cf5]/30 active:scale-[0.995] transition-all duration-150"
              >
                <div className="flex items-center gap-3">
                  <span className="text-2xl leading-none">{m.icon}</span>
                  <div className="text-left">
                    <div className="font-semibold text-sm">{m.symbol}</div>
                    <div className="text-[11px] text-muted-foreground">{m.key} Perp</div>
                    {data && (
                      <div className="text-[10px] text-muted-foreground/60 mt-0.5">
                        OI {formatOi(data.openInterestLong + data.openInterestShort)}
                      </div>
                    )}
                  </div>
                </div>
                <div className="text-right">
                  <div className="font-mono font-semibold text-sm tabular-nums">
                    {data ? `$${formatUsd(data.price)}` : "\u2014"}
                  </div>
                  <div className="text-[11px] text-muted-foreground">Oracle</div>
                </div>
              </button>
            )
          })}
        </div>
      </div>
    </div>
  )
}
