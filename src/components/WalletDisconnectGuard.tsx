"use client"

import { useAccount } from "wagmi"
import { useTradeStore } from "@/lib/store"
import { useEffect } from "react"

// Resets state when wallet disconnects to prevent stale/inconsistent state
export function WalletDisconnectGuard({ children }: { children: React.ReactNode }) {
  const { isConnected } = useAccount()
  const { activePosition, reset } = useTradeStore()

  useEffect(() => {
    if (!isConnected && activePosition) {
      // User disconnected while having an active position view
      // Reset local state — the position still exists on-chain
      reset()
    }
  }, [isConnected, activePosition, reset])

  return <>{children}</>
}
