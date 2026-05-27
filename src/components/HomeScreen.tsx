"use client"

import { useEffect, useRef, useState } from "react"
import Link from "next/link"
import { useAccount, useConnect, useSwitchChain } from "wagmi"
import {
  AlertTriangle,
  ArrowRight,
  ArrowUpDown,
  CircleDollarSign,
  FileCheck,
  Hexagon,
  Info,
  Menu,
  Shield,
  X,
} from "lucide-react"
import { WalletButton } from "@/components/WalletButton"
import { useTradeStore } from "@/lib/store"
import { ARBITRUM_CHAIN_ID } from "@/lib/contracts"

function EasyGmxLogo() {
  return (
    <div className="flex items-center gap-2">
      <svg width="22" height="22" viewBox="0 0 22 22" fill="none" aria-hidden="true">
        <path d="M11 2L20 18H2L11 2Z" fill="#418cf5" fillOpacity="0.9" />
      </svg>
      <span className="text-lg font-bold tracking-tight">
        Easy<span className="text-[#418cf5]">GMX</span>
      </span>
    </div>
  )
}

function DecorativeWaves() {
  return (
    <div className="pointer-events-none absolute inset-x-0 bottom-0 h-32 overflow-hidden rounded-b-2xl opacity-60">
      <svg
        className="absolute bottom-0 w-full"
        viewBox="0 0 400 120"
        preserveAspectRatio="none"
        aria-hidden="true"
      >
        <defs>
          <linearGradient id="wave-grad" x1="0%" y1="0%" x2="100%" y2="0%">
            <stop offset="0%" stopColor="#418cf5" stopOpacity="0.15" />
            <stop offset="50%" stopColor="#418cf5" stopOpacity="0.35" />
            <stop offset="100%" stopColor="#418cf5" stopOpacity="0.1" />
          </linearGradient>
        </defs>
        <path
          d="M0 80 C80 40, 160 100, 240 60 C320 20, 360 70, 400 50 L400 120 L0 120 Z"
          fill="url(#wave-grad)"
        />
        <path
          d="M0 95 C100 55, 200 110, 300 70 C350 50, 380 85, 400 75 L400 120 L0 120 Z"
          fill="url(#wave-grad)"
          opacity="0.5"
        />
      </svg>
    </div>
  )
}

function EthCard({ onSetUpTrade }: { onSetUpTrade: () => void }) {
  return (
    <div className="relative overflow-hidden rounded-2xl border border-[#1e1e30] bg-[#12121a]/80 backdrop-blur-sm shadow-[0_0_60px_-12px_rgba(65,140,245,0.15)]">
      <div className="relative z-10 p-6 sm:p-8 flex flex-col min-h-[340px] sm:min-h-[380px]">
        <div className="flex items-start justify-between gap-4">
          <span className="text-[10px] font-semibold tracking-[0.18em] uppercase text-[#418cf5]/80">
            Primary V1 Market
          </span>
          <span
            className="text-3xl sm:text-4xl leading-none drop-shadow-[0_0_20px_rgba(65,140,245,0.45)]"
            aria-hidden="true"
          >
            &#x27E2;
          </span>
        </div>

        <div className="mt-6 space-y-2">
          <h2 className="text-3xl sm:text-4xl font-bold tracking-tight">ETH / USD</h2>
          <p className="text-sm text-muted-foreground">The main EasyGMX V1 trading path.</p>
        </div>

        <div className="mt-6 flex flex-wrap gap-x-4 gap-y-2 text-[11px] text-muted-foreground">
          <span className="inline-flex items-center gap-1.5">
            <CircleDollarSign className="h-3.5 w-3.5 text-[#418cf5]/70" aria-hidden="true" />
            USDC collateral
          </span>
          <span className="text-[#1e1e30] hidden sm:inline" aria-hidden="true">&middot;</span>
          <span className="inline-flex items-center gap-1.5">
            <Hexagon className="h-3.5 w-3.5 text-[#418cf5]/70" aria-hidden="true" />
            Arbitrum
          </span>
          <span className="text-[#1e1e30] hidden sm:inline" aria-hidden="true">&middot;</span>
          <span className="inline-flex items-center gap-1.5">
            <ArrowUpDown className="h-3.5 w-3.5 text-[#418cf5]/70" aria-hidden="true" />
            <span>
              <span className="text-[#22c55e]">Price Up</span>
              {" or "}
              <span className="text-[#ef4444]">Price Down</span>
            </span>
          </span>
        </div>

        <div className="flex-1" />

        <button
          type="button"
          onClick={onSetUpTrade}
          className="relative z-10 mt-6 w-full inline-flex h-12 items-center justify-center gap-2 rounded-xl bg-[#418cf5] px-5 text-sm font-semibold text-white transition-colors hover:bg-[#3578e0] active:scale-[0.995]"
        >
          Set up ETH trade
          <ArrowRight className="h-4 w-4" aria-hidden="true" />
        </button>
      </div>

      <DecorativeWaves />
    </div>
  )
}

const HOW_IT_WORKS = [
  {
    step: "1",
    title: "Choose direction",
    body: "Pick Price Up or Price Down.",
    icon: ArrowUpDown,
  },
  {
    step: "2",
    title: "Set your risk",
    body: "Choose how much USDC you are willing to put at risk.",
    icon: CircleDollarSign,
  },
  {
    step: "3",
    title: "Review & sign",
    body: "EasyGMX prepares a real GMX V2 trade for you to review before signing.",
    icon: FileCheck,
  },
] as const

const TRUST_ITEMS = [
  { label: "Real GMX V2 positions", icon: Shield },
  { label: "Arbitrum only", icon: Hexagon },
  { label: "USDC collateral", icon: CircleDollarSign },
] as const

export function HomeScreen() {
  const { startEthTrade, openMarketPicker } = useTradeStore()
  const { isConnected, chainId } = useAccount()
  const { connectors, connect, isPending: connectPending } = useConnect()
  const { switchChain, isPending: switchPending } = useSwitchChain()
  const [mobileNavOpen, setMobileNavOpen] = useState(false)
  const pendingEthTrade = useRef(false)

  const proceedToEthTrade = () => {
    startEthTrade()
  }

  useEffect(() => {
    if (!pendingEthTrade.current || !isConnected || chainId !== ARBITRUM_CHAIN_ID) return
    pendingEthTrade.current = false
    startEthTrade()
  }, [isConnected, chainId, startEthTrade])

  const handleSetUpEthTrade = () => {
    if (isConnected && chainId === ARBITRUM_CHAIN_ID) {
      proceedToEthTrade()
      return
    }
    if (isConnected && chainId !== ARBITRUM_CHAIN_ID) {
      pendingEthTrade.current = true
      switchChain({ chainId: ARBITRUM_CHAIN_ID })
      return
    }
    pendingEthTrade.current = true
    const primaryConnector =
      connectors.find((c) => c.id === "injected" || c.type === "injected") ?? connectors[0]
    if (primaryConnector) connect({ connector: primaryConnector })
  }

  const ctaDisabled = connectPending || switchPending

  return (
    <div className="min-h-screen flex flex-col">
      <header className="border-b border-[#1e1e30]">
        <div className="mx-auto flex max-w-6xl items-center justify-between gap-4 px-4 py-3">
          <EasyGmxLogo />

          <nav className="hidden md:flex items-center gap-6 text-sm">
            <span className="font-medium text-foreground border-b-2 border-[#418cf5] pb-0.5">
              Home
            </span>
            <Link
              href="/referral"
              className="text-muted-foreground hover:text-foreground transition-colors"
            >
              Referral transparency
            </Link>
          </nav>

          <div className="flex items-center gap-2">
            <WalletButton showNetwork />
            <button
              type="button"
              className="md:hidden inline-flex h-10 w-10 items-center justify-center rounded-xl border border-[#1e1e30] text-muted-foreground hover:text-foreground transition-colors"
              onClick={() => setMobileNavOpen((v) => !v)}
              aria-label={mobileNavOpen ? "Close menu" : "Open menu"}
            >
              {mobileNavOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
            </button>
          </div>
        </div>

        {mobileNavOpen && (
          <div className="md:hidden border-t border-[#1e1e30] px-4 py-3 space-y-2">
            <span className="block text-sm font-medium text-[#418cf5]">Home</span>
            <Link
              href="/referral"
              className="block text-sm text-muted-foreground hover:text-foreground transition-colors"
              onClick={() => setMobileNavOpen(false)}
            >
              Referral transparency
            </Link>
          </div>
        )}
      </header>

      <main className="flex-1">
        <section className="mx-auto max-w-6xl px-4 py-8 sm:py-10 lg:py-12">
          <div className="grid gap-10 lg:grid-cols-2 lg:gap-12 lg:items-start">
            <div className="space-y-6 lg:pt-4">
              <div className="inline-flex items-center gap-2 rounded-full border border-[#418cf5]/25 bg-[#418cf5]/10 px-3 py-1.5 text-[11px] font-medium text-[#418cf5]">
                <Shield className="h-3.5 w-3.5" aria-hidden="true" />
                Real GMX V2 trading on Arbitrum
              </div>

              <div className="space-y-4">
                <h1 className="text-3xl sm:text-4xl lg:text-[2.75rem] font-bold tracking-tight leading-[1.1]">
                  Real GMX trades.{" "}
                  <span className="text-[#418cf5]">Made simple.</span>
                </h1>
                <p className="text-sm sm:text-base text-muted-foreground leading-relaxed max-w-lg">
                  Choose Price Up or Price Down, set your USDC risk, and review a real GMX V2 trade
                  before signing with your wallet.
                </p>
              </div>

              <div className="flex flex-col sm:flex-row gap-3">
                <button
                  type="button"
                  disabled={ctaDisabled}
                  onClick={handleSetUpEthTrade}
                  className="inline-flex h-12 items-center justify-center gap-2 rounded-xl bg-[#418cf5] px-6 text-sm font-semibold text-white transition-colors hover:bg-[#3578e0] active:scale-[0.995] disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {connectPending ? "Connecting..." : switchPending ? "Switching..." : "Set up ETH trade"}
                  {!connectPending && !switchPending && <ArrowRight className="h-4 w-4" aria-hidden="true" />}
                </button>
                <button
                  type="button"
                  onClick={() => openMarketPicker()}
                  className="inline-flex h-12 items-center justify-center rounded-xl border border-[#1e1e30] bg-[#12121a]/50 px-6 text-sm font-semibold text-foreground transition-colors hover:border-[#418cf5]/30 hover:bg-[#12121a] active:scale-[0.995]"
                >
                  View all markets
                </button>
              </div>

              <p className="inline-flex items-center gap-1.5 text-[11px] text-muted-foreground">
                <Info className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
                You will review the trade before signing.
              </p>

              <div className="rounded-xl border border-[#eab308]/30 bg-[#eab308]/5 px-4 py-3 flex gap-3">
                <AlertTriangle className="h-4 w-4 shrink-0 text-[#eab308] mt-0.5" aria-hidden="true" />
                <p className="text-xs sm:text-sm text-[#eab308]/90 leading-relaxed">
                  Leveraged trading can lose your full collateral. EasyGMX simplifies the interface;
                  it does not remove risk.
                </p>
              </div>
            </div>

            <EthCard onSetUpTrade={handleSetUpEthTrade} />
          </div>
        </section>

        <section className="mx-auto max-w-6xl px-4 pb-10 sm:pb-12">
          <h2 className="text-[11px] font-semibold tracking-[0.18em] uppercase text-muted-foreground mb-4">
            How it works
          </h2>
          <div className="grid gap-3 sm:grid-cols-3">
            {HOW_IT_WORKS.map(({ step, title, body, icon: Icon }) => (
              <div
                key={step}
                className="rounded-xl border border-[#1e1e30] bg-[#12121a]/60 p-4 sm:p-5 space-y-3"
              >
                <div className="flex items-center gap-3">
                  <span className="inline-flex h-7 w-7 items-center justify-center rounded-lg bg-[#418cf5]/15 text-xs font-bold text-[#418cf5]">
                    {step}
                  </span>
                  <Icon className="h-4 w-4 text-[#418cf5]/70" aria-hidden="true" />
                </div>
                <div className="space-y-1">
                  <h3 className="text-sm font-semibold">{title}</h3>
                  <p className="text-xs text-muted-foreground leading-relaxed">{body}</p>
                </div>
              </div>
            ))}
          </div>
        </section>

        <section className="border-t border-[#1e1e30] bg-[#0d0d14]/50">
          <div className="mx-auto max-w-6xl px-4 py-8 sm:py-10 space-y-5">
            <div className="flex flex-wrap gap-x-6 gap-y-3">
              {TRUST_ITEMS.map(({ label, icon: Icon }) => (
                <span key={label} className="inline-flex items-center gap-2 text-xs text-muted-foreground">
                  <Icon className="h-3.5 w-3.5 text-[#418cf5]/60" aria-hidden="true" />
                  {label}
                </span>
              ))}
            </div>

            <p className="text-xs text-muted-foreground/80 leading-relaxed max-w-2xl">
              No extra EasyGMX trading fee. You pay GMX and network execution costs.
            </p>

            <Link
              href="/referral"
              className="inline-flex items-center gap-1.5 text-sm font-medium text-[#418cf5] hover:text-[#3578e0] transition-colors"
            >
              Referral transparency
              <ArrowRight className="h-3.5 w-3.5" aria-hidden="true" />
            </Link>
          </div>
        </section>
      </main>
    </div>
  )
}
