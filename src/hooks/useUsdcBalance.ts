"use client"

import { useReadContract } from "wagmi"
import { erc20Abi } from "@/lib/abi/erc20"
import { TOKENS, ARBITRUM_CHAIN_ID } from "@/lib/contracts"

function formatTokenBalance(raw: bigint | undefined) {
  const value = raw ? Number(raw) / 1e6 : 0
  return {
    raw: raw ?? 0n,
    formatted: value.toFixed(2),
    value,
  }
}

// Read native Arbitrum USDC, which is the collateral token used by this GMX V2 flow.
// Also read legacy USDC.e so the UI can explain common wallet-balance confusion.
export function useUsdcBalance(address: `0x${string}` | undefined) {
  const native = useReadContract({
    address: TOKENS.USDC,
    abi: erc20Abi,
    functionName: "balanceOf",
    args: address ? [address] : undefined,
    chainId: ARBITRUM_CHAIN_ID,
    query: {
      enabled: !!address,
      refetchInterval: 8_000,
    },
  })

  const legacy = useReadContract({
    address: TOKENS.USDCe,
    abi: erc20Abi,
    functionName: "balanceOf",
    args: address ? [address] : undefined,
    chainId: ARBITRUM_CHAIN_ID,
    query: {
      enabled: !!address,
      refetchInterval: 8_000,
    },
  })

  return {
    balance: formatTokenBalance(native.data as bigint | undefined),
    legacyBalance: formatTokenBalance(legacy.data as bigint | undefined),
    isLoading: native.isLoading || legacy.isLoading,
    refetch: () => {
      native.refetch()
      legacy.refetch()
    },
  }
}
