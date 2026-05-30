"use client"

import { useEffect, useRef, useState } from "react"
import { useAccount, useConnect, useDisconnect, useSwitchChain } from "wagmi"
import { ARBITRUM_CHAIN_ID } from "@/lib/contracts"

function shortAddress(address: string): string {
  return `${address.slice(0, 6)}...${address.slice(-4)}`
}

export function WalletButton({
  className = "",
  showNetwork = false,
  pill = false,
}: {
  className?: string
  showNetwork?: boolean
  pill?: boolean
}) {
  const [menuOpen, setMenuOpen] = useState(false)
  const menuRef = useRef<HTMLDivElement | null>(null)
  const { address, isConnected, chainId } = useAccount()
  const { connectors, connect, isPending: connectPending } = useConnect()
  const { disconnect } = useDisconnect()
  const { switchChain, isPending: switchPending } = useSwitchChain()

  useEffect(() => {
    if (!menuOpen) return

    const handlePointerDown = (event: PointerEvent) => {
      const target = event.target as Node | null
      if (target && menuRef.current?.contains(target)) return
      setMenuOpen(false)
    }

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") setMenuOpen(false)
    }

    document.addEventListener("pointerdown", handlePointerDown)
    document.addEventListener("keydown", handleKeyDown)
    return () => {
      document.removeEventListener("pointerdown", handlePointerDown)
      document.removeEventListener("keydown", handleKeyDown)
    }
  }, [menuOpen])

  const pillClass = pill
    ? `wallet-pill inline-flex items-center gap-2 ${className}`
    : className
  const baseClass = pill
    ? pillClass
    : `inline-flex h-10 items-center justify-center rounded-xl border border-[#418cf5]/30 bg-[#418cf5]/15 px-4 text-sm font-semibold text-[#418cf5] transition-colors hover:bg-[#418cf5]/20 disabled:cursor-not-allowed disabled:opacity-50 ${className}`

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
    const connectedClass = showNetwork
      ? (pill ? pillClass : `inline-flex h-10 items-center gap-2 rounded-xl border border-[#1e1e30] bg-[#12121a]/80 px-3 text-sm transition-colors hover:border-[#418cf5]/30 ${className}`)
      : baseClass

    return (
      <div ref={menuRef} className="relative z-[9999]">
        <button
          type="button"
          className={connectedClass}
          onClick={(event) => {
            event.stopPropagation()
            setMenuOpen((open) => !open)
          }}
          aria-expanded={menuOpen}
        >
          {showNetwork ? (
            <>
              <span className={pill ? "wallet-pill-address" : "font-mono text-xs tabular-nums text-foreground"}>
                {shortAddress(address)}
              </span>
              <span className={pill ? "wallet-pill-divider" : "hidden sm:inline h-4 w-px bg-[#1e1e30]"} aria-hidden="true" />
              <span className={pill ? "wallet-pill-network" : "hidden sm:inline-flex items-center gap-1.5 text-[11px] text-muted-foreground"}>
                <span className={pill ? "wallet-pill-dot" : "h-1.5 w-1.5 rounded-full bg-[#22c55e]"} aria-hidden="true" />
                Arbitrum
              </span>
            </>
          ) : (
            shortAddress(address)
          )}
        </button>

        {menuOpen && (
          <div
            className="absolute right-0 z-[10000] mt-2 w-56 rounded-xl border border-[#1e1e30] bg-[#12121a] p-3 shadow-2xl"
            onClick={(event) => event.stopPropagation()}
          >
            <div className="space-y-1 border-b border-[#1e1e30] pb-3">
              <p className="text-[11px] text-muted-foreground">Connected wallet</p>
              <p className="font-mono text-xs text-foreground break-all">{address}</p>
              <p className="text-[11px] text-[#22c55e]">Arbitrum</p>
            </div>
            <button
              type="button"
              onClick={() => {
                setMenuOpen(false)
                disconnect()
              }}
              className="mt-3 w-full rounded-lg border border-[#ef4444]/20 bg-[#ef4444]/10 px-3 py-2 text-sm font-semibold text-[#ef4444] hover:bg-[#ef4444]/15"
            >
              Disconnect wallet
            </button>
          </div>
        )}
      </div>
    )
  }

  const primaryConnector =
    connectors.find((c) => c.id === "injected" || c.type === "injected") ?? connectors[0]

  return (
    <button
      type="button"
      className={pill ? pillClass : baseClass}
      disabled={!primaryConnector || connectPending}
      onClick={() => primaryConnector && connect({ connector: primaryConnector })}
    >
      {connectPending ? "Connecting..." : "Connect wallet"}
    </button>
  )
}
