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

function EthCard({ onSetUpTrade }: { onSetUpTrade: () => void }) {
  return (
    <div className="eth-feature-card">
      <div className="eth-orb" aria-hidden="true">
        &#x27E2;
      </div>

      <div className="eth-card-content">
        <span className="eth-eyebrow">Primary V1 Market</span>
        <h2 className="eth-title">ETH / USD</h2>
        <p className="eth-description">The main EasyGMX V1 trading path.</p>

        <div className="eth-meta-row">
          <span className="eth-meta-pill">
            <CircleDollarSign className="h-4 w-4 text-[#58a0ff]/80" aria-hidden="true" />
            USDC collateral
          </span>
          <span className="eth-meta-pill">
            <Hexagon className="h-4 w-4 text-[#58a0ff]/80" aria-hidden="true" />
            Arbitrum
          </span>
          <span className="eth-meta-pill">
            <ArrowUpDown className="h-4 w-4 text-[#58a0ff]/80" aria-hidden="true" />
            <span>
              <span className="price-up">Price Up</span>
              {" or "}
              <span className="price-down">Price Down</span>
            </span>
          </span>
        </div>
      </div>

      <button type="button" onClick={onSetUpTrade} className="eth-card-cta primary-cta">
        Set up ETH trade
        <ArrowRight className="h-4 w-4" aria-hidden="true" />
      </button>
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
            <div>
              <div className="lobby-eyebrow">
                <Shield className="h-3.5 w-3.5" aria-hidden="true" />
                Real GMX V2 trading on Arbitrum
              </div>

              <h1 className="lobby-title">
                Real GMX trades. <span className="accent">Made simple.</span>
              </h1>

              <p className="lobby-subtitle">
                Choose Price Up or Price Down, set your USDC risk, and review a real GMX V2 trade
                before signing with your wallet.
              </p>

              <div className="lobby-actions">
                <button
                  type="button"
                  disabled={ctaDisabled}
                  onClick={handleSetUpEthTrade}
                  className="primary-cta"
                >
                  {connectPending ? "Connecting..." : switchPending ? "Switching..." : "Set up ETH trade"}
                  {!connectPending && !switchPending && <ArrowRight className="h-4 w-4" aria-hidden="true" />}
                </button>
                <button type="button" onClick={() => openMarketPicker()} className="secondary-cta">
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
                  Leveraged trading can lose your full collateral. EasyGMX simplifies the interface;
                  it does not remove risk.
                </p>
              </div>
            </div>

            <EthCard onSetUpTrade={handleSetUpEthTrade} />
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
              No extra EasyGMX trading fee. You pay GMX and network execution costs.
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
