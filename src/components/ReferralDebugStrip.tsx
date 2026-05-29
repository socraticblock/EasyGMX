"use client"

import Link from "next/link"
import { useAccount } from "wagmi"
import { useGmxReferralStatus } from "@/hooks/useGmxReferralStatus"
import { expressV1StatusLabel, GMX_EXPRESS_ENABLED } from "@/lib/gmxExpress"

const SHOW_DEBUG_STRIP = process.env.NEXT_PUBLIC_SHOW_DEBUG_STRIP === "true"

export function ReferralDebugStrip() {
  const { isConnected } = useAccount()
  const { attributionLabel, isLoading, configError } = useGmxReferralStatus()

  if (!SHOW_DEBUG_STRIP || !isConnected) return null

  return (
    <div
      className="px-4 py-1.5 border-b border-[#1e1e30]/80 bg-[#0a0a0f]/90 text-[10px] text-muted-foreground/70 flex items-center justify-between gap-2"
      aria-label="Referral debug status"
    >
      <span>
        Referral: {isLoading ? "loading…" : attributionLabel}
        {configError ? " · config issue" : ""}
        {GMX_EXPRESS_ENABLED ? ` · ${expressV1StatusLabel()}` : ""}
      </span>
      <Link href="/referral" className="text-[#418cf5]/60 hover:text-[#418cf5] shrink-0">
        transparency
      </Link>
    </div>
  )
}
