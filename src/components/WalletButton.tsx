"use client"

import { useAccount, useConnect, useDisconnect, useSwitchChain } from "wagmi"
import { ARBITRUM_CHAIN_ID } from "@/lib/contracts"

function shortAddress(address: string): string {
  return `${address.slice(0, 6)}...${address.slice(-4)}`
}

export function WalletButton({
  className = "",
  showNetwork = false,
}: {
  className?: string
  showNetwork?: boolean
}) {
  const { address, isConnected, chainId } = useAccount()
  const { connectors, connect, isPending: connectPending } = useConnect()
  const { disconnect } = useDisconnect()
  const { switchChain, isPending: switchPending } = useSwitchChain()

  const baseClass = `inline-flex h-10 items-center justify-center rounded-xl border border-[#418cf5]/30 bg-[#418cf5]/15 px-4 text-sm font-semibold text-[#418cf5] transition-colors hover:bg-[#418cf5]/20 disabled:cursor-not-allowed disabled:opacity-50 ${className}`

  if (isConnected && chainId !== ARBITRUM_CHAIN_ID) {
    return (
      <button
        type="button"
        className={baseClass}
        disabled={switchPending}
        onClick={() => switchChain({ chainId: ARBITRUM_CHAIN_ID })}
      >
        {switchPending ? "Switching..." : "Switch to Arbitrum"}
      </button>
    )
  }

  if (isConnected && address) {
    if (showNetwork) {
      return (
        <button
          type="button"
          className={`inline-flex h-10 items-center gap-2 rounded-xl border border-[#1e1e30] bg-[#12121a]/80 px-3 text-sm transition-colors hover:border-[#418cf5]/30 ${className}`}
          onClick={() => disconnect()}
        >
          <span className="font-mono text-xs tabular-nums text-foreground">{shortAddress(address)}</span>
          <span className="hidden sm:inline h-4 w-px bg-[#1e1e30]" aria-hidden="true" />
          <span className="hidden sm:inline-flex items-center gap-1.5 text-[11px] text-muted-foreground">
            <span className="h-1.5 w-1.5 rounded-full bg-[#22c55e]" aria-hidden="true" />
            Arbitrum
          </span>
        </button>
      )
    }
    return (
      <button type="button" className={baseClass} onClick={() => disconnect()}>
        {shortAddress(address)}
      </button>
    )
  }

  const primaryConnector =
    connectors.find((c) => c.id === "injected" || c.type === "injected") ?? connectors[0]

  return (
    <button
      type="button"
      className={baseClass}
      disabled={!primaryConnector || connectPending}
      onClick={() => primaryConnector && connect({ connector: primaryConnector })}
    >
      {connectPending ? "Connecting..." : "Connect wallet"}
    </button>
  )
}
