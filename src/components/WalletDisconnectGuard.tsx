"use client"

import { useEffect } from "react"
import { useAccount } from "wagmi"
import { useTradeStore } from "@/lib/store"

// Resets state when wallet disconnects to prevent stale/inconsistent state.
export function WalletDisconnectGuard({ children }: { children: React.ReactNode }) {
  const { isConnected } = useAccount()
  const { activePosition, reset } = useTradeStore()

  useEffect(() => {
    const isE2EStatePreview =
      typeof window !== "undefined" &&
      Boolean((window as Window & { __EASYGMX_E2E_STATE_PREVIEW__?: boolean }).__EASYGMX_E2E_STATE_PREVIEW__)
    if (isE2EStatePreview) return

    if (!isConnected && activePosition) {
      // The real position still exists on GMX; local state must not pretend the wallet is active.
      reset()
    }
  }, [isConnected, activePosition, reset])

  return <>{children}</>
}
