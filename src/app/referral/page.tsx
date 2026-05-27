"use client"

import type { ReactNode } from "react"
import Link from "next/link"
import { useGmxReferralStatus } from "@/hooks/useGmxReferralStatus"
import { WalletButton } from "@/components/WalletButton"
import { useAccount } from "wagmi"
import { bytes32ToReferralString } from "@/lib/gmxReferral"

function Row({ label, value }: { label: string; value: ReactNode }) {
  return (
    <div className="flex justify-between gap-4 text-sm py-2 border-b border-[#1e1e30] last:border-0">
      <span className="text-muted-foreground shrink-0">{label}</span>
      <span className="text-right font-mono text-xs break-all">{value}</span>
    </div>
  )
}

export default function ReferralTransparencyPage() {
  const { isConnected } = useAccount()
  const status = useGmxReferralStatus()
  const traderCodeStr = status.traderReferralCode
    ? bytes32ToReferralString(status.traderReferralCode) ?? status.traderReferralCode
    : "—"

  return (
    <div className="min-h-screen flex flex-col">
      <header className="flex items-center justify-between px-4 py-3 border-b border-[#1e1e30]">
        <Link href="/" className="text-sm text-muted-foreground hover:text-foreground">
          &larr; Back
        </Link>
        <h1 className="text-sm font-semibold">Referral transparency</h1>
        <WalletButton />
      </header>

      <div className="flex-1 px-4 py-6 max-w-lg mx-auto w-full space-y-6">
        <div className="space-y-2">
          <h2 className="text-xl font-bold">EasyGMX Referral Transparency</h2>
          <p className="text-sm text-muted-foreground leading-relaxed">
            EasyGMX may use a GMX referral code. This does not add an extra EasyGMX trading fee. GMX may give
            eligible traders a referral discount, and EasyGMX may receive referral rewards. This page is for
            transparency only. EasyGMX V1 does not provide public network-cost coverage.
          </p>
        </div>

        <div className="rounded-xl bg-[#12121a] border border-[#1e1e30] p-4">
          <Row label="Chain" value="Arbitrum" />
          <Row
            label="Configured code"
            value={status.configuredCode ?? "(not set)"}
          />
          <Row
            label="Code registered on GMX"
            value={
              status.configError
                ? "Cannot verify — invalid or missing config"
                : status.codeRegistered
                  ? "Yes"
                  : "No or unknown"
            }
          />
          <Row
            label="Code owner"
            value={
              status.codeOwner
                ? `${status.codeOwner.slice(0, 6)}…${status.codeOwner.slice(-4)}`
                : "—"
            }
          />
          <Row
            label="Trader discount (GMX tiers)"
            value="5–10% when eligible (GMX-controlled)"
          />
          <Row
            label="Affiliate reward (GMX tiers)"
            value="5–15% of opening/closing fees (GMX-controlled)"
          />
          <p className="text-[11px] text-muted-foreground/70 pt-3 leading-relaxed">
            Official tier upgrades are controlled by GMX and are not automatic. Tier 2 requires 15+ active users
            and $5M+ weekly volume; Tier 3 requires 30+ users and $25M+ weekly volume.
          </p>
        </div>

        {isConnected && (
          <div className="rounded-xl bg-[#12121a] border border-[#1e1e30] p-4 space-y-2">
            <p className="text-[11px] font-semibold text-muted-foreground tracking-[0.15em] uppercase">
              Your wallet (connected)
            </p>
            <Row label="Referral status" value={status.attributionLabel} />
            <Row label="On-chain trader code" value={traderCodeStr} />
            {status.isLoading && (
              <p className="text-[11px] text-muted-foreground">Loading on-chain referral data…</p>
            )}
          </div>
        )}

        {!isConnected && (
          <p className="text-sm text-muted-foreground">
            Connect a wallet to see whether your address is attributed to EasyGMX or another referral code.
          </p>
        )}
      </div>
    </div>
  )
}
