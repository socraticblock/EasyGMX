"use client"

import { useQuery } from "@tanstack/react-query"
import { fetchGmxExecutionFeeEth, fetchGmxExecutionFeeWei } from "@/lib/gmxExecutionFee"
import { DEFAULT_EXECUTION_FEE_ETH, type MarketKey } from "@/lib/contracts"

export function useGmxExecutionFee(marketKey: MarketKey | null) {
  const key = marketKey ?? "ETH/USD"

  return useQuery({
    queryKey: ["gmxExecutionFee", key],
    queryFn: async () => {
      const wei = await fetchGmxExecutionFeeWei(key)
      const eth = Number(wei) / 1e18
      return { wei, eth }
    },
    staleTime: 60_000,
    refetchInterval: 60_000,
    placeholderData: {
      wei: BigInt(Math.round(DEFAULT_EXECUTION_FEE_ETH * 1e18)),
      eth: DEFAULT_EXECUTION_FEE_ETH,
    },
  })
}
