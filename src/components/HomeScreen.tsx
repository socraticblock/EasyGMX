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
import { useEasyPositions } from "@/lib/gmxPositions"

function EasyGmxLogo() {
  return (
    <div className="lobby-logo">
      <svg width="22" height="22" viewBox="0 0 22 22" fill="none" aria-hidden="true">
        <path d="M11 2L20 18H2L11 2Z" fill="#438bff" fillOpacity="0.9" />
      </svg>
      <span>
        Easy<span className="lobby-logo-accent">GMX</span>
      </span>
    </div>
  )
}

const ETH_MARKET_DETAILS = [
  { label: "GMX market", value: "ETH/USD" },
  { label: "Network", value: "Arbitrum" },
  { label: "Collateral", value: "USDC" },
  { label: "Order path", value: "GMX V2" },
] as const

function EthCard({
  onSetUpTrade,
  ctaLabel,
  disabled,
}: {
  onSetUpTrade: () => void
  ctaLabel: string
  disabled?: boolean
}) {
  return (
    <div className="eth-feature-card">
      <div className="eth-orb" aria-hidden="true">
        <span className="eth-orb-star">&#x2726;</span>
      </div>

      <div className="eth-card-content">
        <span className="eth-eyebrow">Primary V1 Market</span>
        <h2 className="eth-title">ETH / USD</h2>
        <p className="eth-description eth-description--desktop">The default ETH path for real GMX V2 trades.</p>

        <div className="eth-market-grid eth-market-grid--desktop" aria-label="ETH trade route details">
          {ETH_MARKET_DETAILS.map(({ label, value }) => (
            <div key={label} className="eth-market-cell">
              <span>{label}</span>
              <strong>{value}</strong>
            </div>
          ))}
        </div>

        <div className="eth-direction-panel eth-direction-panel--desktop">
          <div>
            <span className="eth-direction-kicker">Direction</span>
            <p>Choose Price Up or Price Down before review.</p>
          </div>
          <div className="eth-direction-options" aria-hidden="true">
            <span className="price-up">Price Up</span>
            <span className="eth-direction-divider">/</span>
            <span className="price-down">Price Down</span>
          </div>
        </div>

        <div className="eth-chip-row" aria-label="ETH market details">
          <span className="eth-chip">ETH/USD</span>
          <span className="eth-chip">Arbitrum</span>
          <span className="eth-chip">USDC</span>
          <span className="eth-chip">GMX V2</span>
        </div>
      </div>

      <button type="button" onClick={onSetUpTrade} disabled={disabled} className="eth-card-cta primary-cta">
        {ctaLabel}
        {!disabled && <ArrowRight className="h-4 w-4" aria-hidden="true" />}
      </button>
    </div>
  )
}

const HOW_IT_WORKS = [
  {
    step: "1",
    title: "Choose direction",
    body: "Pick Price Up or Price Down for ETH/USD.",
    icon: ArrowUpDown,
  },
  {
    step: "2",
    title: "Set USDC risk",
    body: "Choose the amount of collateral you are willing to put at risk.",
    icon: CircleDollarSign,
  },
  {
    step: "3",
    title: "Review GMX order",
    body: "Check the real GMX V2 trade before signing in your wallet.",
    icon: FileCheck,
  },
] as const

const TRUST_ITEMS = [
  { label: "Real GMX V2 positions", icon: Shield },
  { label: "Arbitrum only", icon: Hexagon },
  { label: "USDC collateral", icon: CircleDollarSign },
] as const

export function HomeScreen() {
  const { startEthTrade, openMarketPicker, setActivePosition, setOrderPhase } = useTradeStore()
  const { address, isConnected, chainId } = useAccount()
  const { connectors, connect, isPending: connectPending } = useConnect()
  const { switchChain, isPending: switchPending } = useSwitchChain()
  const { data: walletPositions } = useEasyPositions(isConnected && chainId === ARBITRUM_CHAIN_ID ? address : undefined)
  const [mobileNavOpen, setMobileNavOpen] = useState(false)
  const pendingEthTrade = useRef(false)
  const detectedEthPosition = walletPositions?.find((p) => p.marketKey === "ETH/USD") ?? null

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
  const ctaLabel = connectPending ? "Connecting..." : switchPending ? "Switching..." : "Set up ETH trade"
  const resumeDetectedPosition = () => {
    if (!detectedEthPosition) return
    setActivePosition(detectedEthPosition)
    setOrderPhase("confirmed")
  }

  return (
    <div className="home-lobby">
      <header className="top-nav">
        <div className="lobby-container top-nav-inner">
          <EasyGmxLogo />

          <nav className="lobby-nav">
            <span className="lobby-nav-link lobby-nav-link--active">Home</span>
            <Link href="/referral" className="lobby-nav-link">
              Referral transparency
            </Link>
          </nav>

          <div className="top-nav-actions">
            <WalletButton showNetwork pill />
            <button
              type="button"
              className="mobile-menu-btn"
              onClick={() => setMobileNavOpen((v) => !v)}
              aria-label={mobileNavOpen ? "Close menu" : "Open menu"}
            >
              {mobileNavOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
            </button>
          </div>
        </div>

        {mobileNavOpen && (
          <div className="lobby-container mobile-nav-panel">
            <span className="block text-sm font-semibold text-[#438bff] mb-2">Home</span>
            <Link
              href="/referral"
              className="lobby-nav-link block text-sm"
              onClick={() => setMobileNavOpen(false)}
            >
              Referral transparency
            </Link>
          </div>
        )}
      </header>

      <main className="flex-1">
        <div className="lobby-container">
          <section className="lobby-hero-grid">
            <div className="lobby-copy-panel">
              <div className="lobby-eyebrow">
                <Shield className="h-3.5 w-3.5" aria-hidden="true" />
                Real GMX V2 trading on Arbitrum
              </div>

              <h1 className="lobby-title">
                <span className="title-line">Real GMX trades.</span>
                <span className="title-line title-line-accent">Made simple.</span>
              </h1>

              <p className="lobby-subtitle">
                Choose Price Up or Price Down, set your USDC risk, and review the real GMX V2
                order before signing.
              </p>

              <div className="lobby-actions">
                {detectedEthPosition && (
                  <div className="w-full rounded-xl border border-[#418cf5]/25 bg-[#418cf5]/10 p-3 text-left">
                    <p className="text-sm font-semibold text-foreground">Open ETH position detected</p>
                    <p className="mt-1 text-xs leading-relaxed text-muted-foreground">
                      EasyGMX found a live GMX position for this wallet.
                    </p>
                    <button
                      type="button"
                      onClick={resumeDetectedPosition}
                      className="mt-3 inline-flex min-h-10 items-center justify-center rounded-lg bg-[#418cf5] px-4 text-sm font-semibold text-white transition-all active:scale-[0.98]"
                    >
                      Resume position
                    </button>
                  </div>
                )}
                <button
                  type="button"
                  disabled={ctaDisabled}
                  onClick={handleSetUpEthTrade}
                  className="primary-cta"
                >
                  {ctaLabel}
                  {!ctaDisabled && <ArrowRight className="h-4 w-4" aria-hidden="true" />}
                </button>
                <button type="button" onClick={() => openMarketPicker()} className="secondary-cta">
                  View all markets
                </button>
                <button type="button" onClick={() => openMarketPicker()} className="markets-text-link">
                  View all markets
                </button>
              </div>

              <p className="lobby-helper">
                <Info className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
                You will review the trade before signing.
              </p>

              <div className="risk-warning">
                <AlertTriangle className="h-4 w-4 shrink-0 mt-0.5" aria-hidden="true" />
                <p>
                  Leveraged trading can lose your full collateral. EasyGMX keeps the interface simple — it does not remove risk.
                </p>
              </div>
            </div>

            <EthCard onSetUpTrade={handleSetUpEthTrade} ctaLabel={ctaLabel} disabled={ctaDisabled} />
          </section>

          <section className="how-section">
            <h2 className="section-kicker">How it works</h2>
            <div className="how-grid">
              {HOW_IT_WORKS.map(({ step, title, body, icon: Icon }) => (
                <div key={step} className="how-card">
                  <div className="how-card-header">
                    <span className="step-number">{step}</span>
                    <Icon className="h-4 w-4 text-[#58a0ff]/70" aria-hidden="true" />
                  </div>
                  <h3 className="how-card-title">{title}</h3>
                  <p className="how-card-body">{body}</p>
                </div>
              ))}
            </div>
          </section>

          <footer className="trust-footer">
            <div className="trust-bar">
              {TRUST_ITEMS.map(({ label, icon: Icon }) => (
                <span key={label} className="trust-item">
                  <Icon className="h-4 w-4 text-[#58a0ff]/60" aria-hidden="true" />
                  {label}
                </span>
              ))}
            </div>

            <p className="cost-note">
              No extra EasyGMX trading fee. You pay GMX fees and network execution costs.
            </p>

            <Link href="/referral" className="referral-link">
              Referral transparency
              <ArrowRight className="h-3.5 w-3.5" aria-hidden="true" />
            </Link>
          </footer>
        </div>
      </main>
    </div>
  )
}
