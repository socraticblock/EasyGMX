"use client"

import { useAccount, useConnect, useDisconnect, useSwitchChain } from "wagmi"
import { ARBITRUM_CHAIN_ID } from "@/lib/contracts"

function shortAddress(address: string): string {
  return `${address.slice(0, 6)}...${address.slice(-4)}`
}

export function WalletButton({ className = "" }: { className?: string }) {
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
    return (
      <button type="button" className={baseClass} onClick={() => disconnect()}>
        {shortAddress(address)}
      </button>
    )
  }

  const primaryConnector = connectors[0]

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
