"use client"

import { useReadContract } from "wagmi"
import { erc20Abi } from "@/lib/abi/erc20"
import { TOKENS, ARBITRUM_CHAIN_ID } from "@/lib/contracts"

// Read USDC balance for a connected wallet
export function useUsdcBalance(address: `0x${string}` | undefined) {
  const { data, isLoading, refetch } = useReadContract({
    address: TOKENS.USDC,
    abi: erc20Abi,
    functionName: "balanceOf",
    args: address ? [address] : undefined,
    chainId: ARBITRUM_CHAIN_ID,
    query: {
      enabled: !!address,
      refetchInterval: 8_000,
      select: (raw: bigint) => {
        const value = Number(raw) / 1e6 // USDC has 6 decimals
        return {
          raw,
          formatted: value.toFixed(2),
          value,
        }
      },
    },
  })

  return {
    balance: data ?? { raw: 0n, formatted: "0.00", value: 0 },
    isLoading,
    refetch,
  }
}
