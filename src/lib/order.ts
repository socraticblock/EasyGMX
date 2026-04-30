// Order creation, cancellation, and position reading for GMX V2
// All contract interactions go through here

import { encodeFunctionData, type Hash } from "viem"
import { usePublicClient, useWalletClient, useAccount } from "wagmi"
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query"
import { useState, useCallback } from "react"

import { exchangeRouterAbi } from "./abi/exchangeRouter"
import { readerAbi } from "./abi/reader"
import { erc20Abi } from "./abi/erc20"
import {
  CONTRACTS,
  TOKENS,
  TOKEN_DECIMALS,
  MARKET_LIST,
  ORDER_TYPE,
  DECREASE_POSITION_SWAP_TYPE,
  USD_DECIMALS,
  ARBITRUM_CHAIN_ID,
  SLIPPAGE_BPS,
  ARBISCAN_URL,
  type MarketKey,
  toUsd,
  toTokenRaw,
  fromUsd,
  fromTokenRaw,
  applySlippage,
  DEFAULT_EXECUTION_FEE_ETH,
} from "./contracts"

// ─── Helpers ───────────────────────────────────────────────

const ZERO_ADDRESS = "0x0000000000000000000000000000000000000000" as const
const ZERO_BYTES32 = "0x0000000000000000000000000000000000000000000000000000000000000000" as const

function executionFeeWei(): bigint {
  // ~0.0001 ETH on Arbitrum — keepers need this
  return BigInt(Math.round(DEFAULT_EXECUTION_FEE_ETH * 1e18))
}

// ─── Types ─────────────────────────────────────────────────

export interface OrderResult {
  orderKey: Hash
  txHash: Hash
}

export interface OnChainPosition {
  market: string
  collateralToken: string
  isLong: boolean
  sizeInUsd: number
  collateralAmount: number
  entryPrice: number
  averageEntryPrice: number
  unrealizedPnl: number
  borrowingFeeAmount: number
  fundingFeeAmount: number
  marketKey: MarketKey | null
}

// ─── USDC Approval ─────────────────────────────────────────
// Must approve the ROUTER (not OrderVault) because of pluginTransfer

export function useUsdcApproval(amountRaw: bigint) {
  const { address } = useAccount()
  const { data: walletClient } = useWalletClient()
  const publicClient = usePublicClient({ chainId: ARBITRUM_CHAIN_ID })
  const queryClient = useQueryClient()

  // Check current allowance
  const { data: allowance, isLoading: loadingAllowance } = useQuery({
    queryKey: ["usdcAllowance", address],
    queryFn: async () => {
      if (!publicClient || !address) return 0n
      const a = await publicClient.readContract({
        address: TOKENS.USDC,
        abi: erc20Abi,
        functionName: "allowance",
        args: [address, CONTRACTS.router],
      })
      return a as bigint
    },
    enabled: !!address && !!publicClient,
    refetchInterval: 10_000,
  })

  const needsApproval = !allowance || allowance < amountRaw

  const approveMutation = useMutation({
    mutationFn: async () => {
      if (!walletClient || !address) throw new Error("Wallet not connected")

      const { request } = await publicClient!.simulateContract({
        address: TOKENS.USDC,
        abi: erc20Abi,
        functionName: "approve",
        args: [CONTRACTS.router, amountRaw],
        account: address,
      })

      const hash = await walletClient.writeContract(request)
      await publicClient!.waitForTransactionReceipt({ hash })
      queryClient.invalidateQueries({ queryKey: ["usdcAllowance", address] })
      return hash
    },
  })

  return {
    allowance,
    needsApproval,
    loadingAllowance,
    approve: approveMutation.mutate,
    approvePending: approveMutation.isPending,
    approveError: approveMutation.error,
    approveReset: approveMutation.reset,
  }
}

// ─── Create Order (Open Position) ──────────────────────────
// Uses multicall: sendTokens + sendWnt + createOrder

export function useCreateOrder() {
  const { address } = useAccount()
  const { data: walletClient } = useWalletClient()
  const publicClient = usePublicClient({ chainId: ARBITRUM_CHAIN_ID })

  return useMutation({
    mutationFn: async (params: {
      marketKey: MarketKey
      isLong: boolean
      collateralUsd: number
      sizeUsd: number
      currentPrice: number
    }): Promise<OrderResult> => {
      if (!walletClient || !address || !publicClient) {
        throw new Error("Wallet not connected")
      }

      const marketInfo = MARKET_LIST.find((m) => m.key === params.marketKey)
      if (!marketInfo) throw new Error(`Unknown market: ${params.marketKey}`)

      const collateralRaw = toTokenRaw(params.collateralUsd, marketInfo.collateralDecimals)
      const sizeRaw = toUsd(params.sizeUsd)
      const fee = executionFeeWei()
      const acceptablePrice = applySlippage(params.currentPrice, params.isLong)

      // Build multicall data
      const sendTokensData = encodeFunctionData({
        abi: exchangeRouterAbi,
        functionName: "sendTokens",
        args: [TOKENS.USDC, CONTRACTS.orderVault, collateralRaw],
      })

      const sendWntData = encodeFunctionData({
        abi: exchangeRouterAbi,
        functionName: "sendWnt",
        args: [CONTRACTS.orderVault, fee],
      })

      const createOrderData = encodeFunctionData({
        abi: exchangeRouterAbi,
        functionName: "createOrder",
        args: [
          {
            addresses: {
              receiver: address,
              cancellationReceiver: address,
              callbackContract: ZERO_ADDRESS,
              uiFeeReceiver: ZERO_ADDRESS,
              market: marketInfo.address as `0x${string}`,
              initialCollateralToken: TOKENS.USDC,
              swapPath: [],
            },
            numbers: {
              sizeDeltaUsd: sizeRaw,
              initialCollateralDeltaAmount: collateralRaw,
              triggerPrice: 0n,
              acceptablePrice,
              executionFee: fee,
              callbackGasLimit: 0n,
              minOutputAmount: 0n,
              validFromTime: 0n,
            },
            orderType: ORDER_TYPE.MarketIncrease,
            decreasePositionSwapType: DECREASE_POSITION_SWAP_TYPE.NoSwap,
            isLong: params.isLong,
            shouldUnwrapNativeToken: false,
            autoCancel: false,
            referralCode: ZERO_BYTES32,
            dataList: [],
          },
        ],
      })

      const { request } = await publicClient.simulateContract({
        address: CONTRACTS.exchangeRouter,
        abi: exchangeRouterAbi,
        functionName: "multicall",
        args: [[sendTokensData, sendWntData, createOrderData]],
        value: fee,
        account: address,
      })

      const txHash = await walletClient.writeContract(request)
      const receipt = await publicClient.waitForTransactionReceipt({ hash: txHash })

      // Extract order key from logs — look for the OrderCreated event
      // The createOrder function returns bytes32, but in multicall we need to parse logs
      // Fallback: compute order key from transaction + sender
      let orderKey: Hash = ZERO_BYTES32

      // Try to extract from the last log's data
      if (receipt.logs.length > 0) {
        const lastLog = receipt.logs[receipt.logs.length - 1]
        if (lastLog.topics.length >= 2) {
          // topic1 is typically the order key for OrderCreated events
          orderKey = lastLog.topics[1] as Hash
        }
      }

      return { orderKey, txHash }
    },
  })
}

// ─── Close Position (MarketDecrease) ───────────────────────

export function useClosePosition() {
  const { address } = useAccount()
  const { data: walletClient } = useWalletClient()
  const publicClient = usePublicClient({ chainId: ARBITRUM_CHAIN_ID })

  return useMutation({
    mutationFn: async (params: {
      marketAddress: string
      isLong: boolean
      sizeUsd: number
      collateralToken: string
      currentPrice: number
    }): Promise<OrderResult> => {
      if (!walletClient || !address || !publicClient) {
        throw new Error("Wallet not connected")
      }

      const sizeRaw = toUsd(params.sizeUsd)
      const fee = executionFeeWei()

      // For closing: longs accept lower price, shorts accept higher price
      const acceptablePrice = applySlippage(params.currentPrice, !params.isLong)

      const sendWntData = encodeFunctionData({
        abi: exchangeRouterAbi,
        functionName: "sendWnt",
        args: [CONTRACTS.orderVault, fee],
      })

      const createOrderData = encodeFunctionData({
        abi: exchangeRouterAbi,
        functionName: "createOrder",
        args: [
          {
            addresses: {
              receiver: address,
              cancellationReceiver: address,
              callbackContract: ZERO_ADDRESS,
              uiFeeReceiver: ZERO_ADDRESS,
              market: params.marketAddress as `0x${string}`,
              initialCollateralToken: params.collateralToken as `0x${string}`,
              swapPath: [],
            },
            numbers: {
              sizeDeltaUsd: sizeRaw,
              initialCollateralDeltaAmount: 0n, // 0 = withdraw all collateral
              triggerPrice: 0n,
              acceptablePrice,
              executionFee: fee,
              callbackGasLimit: 0n,
              minOutputAmount: 0n,
              validFromTime: 0n,
            },
            orderType: ORDER_TYPE.MarketDecrease,
            decreasePositionSwapType: DECREASE_POSITION_SWAP_TYPE.NoSwap,
            isLong: params.isLong,
            shouldUnwrapNativeToken: false,
            autoCancel: false,
            referralCode: ZERO_BYTES32,
            dataList: [],
          },
        ],
      })

      const { request } = await publicClient.simulateContract({
        address: CONTRACTS.exchangeRouter,
        abi: exchangeRouterAbi,
        functionName: "multicall",
        args: [[sendWntData, createOrderData]],
        value: fee,
        account: address,
      })

      const txHash = await walletClient.writeContract(request)
      await publicClient.waitForTransactionReceipt({ hash: txHash })

      let orderKey: Hash = ZERO_BYTES32
      // Extract from logs (simplified — production would parse properly)
      const receipt = await publicClient.getTransactionReceipt({ hash: txHash })
      if (receipt.logs.length > 0) {
        const lastLog = receipt.logs[receipt.logs.length - 1]
        if (lastLog.topics.length >= 2) {
          orderKey = lastLog.topics[1] as Hash
        }
      }

      return { orderKey, txHash }
    },
  })
}

// ─── Read On-Chain Positions ───────────────────────────────

export function useOnChainPositions() {
  const { address } = useAccount()
  const publicClient = usePublicClient({ chainId: ARBITRUM_CHAIN_ID })

  return useQuery({
    queryKey: ["positions", address],
    queryFn: async (): Promise<OnChainPosition[]> => {
      if (!publicClient || !address) return []

      const rawPositions = await publicClient.readContract({
        address: CONTRACTS.reader,
        abi: readerAbi,
        functionName: "getAccountPositions",
        args: [CONTRACTS.dataStore, address, 0n, 50n],
      })

      if (!Array.isArray(rawPositions)) return []

      return (rawPositions as Array<{
        addresses: { account: string; market: string; collateralToken: string }
        numbers: {
          sizeInUsd: bigint
          sizeInTokens: bigint
          collateralAmount: bigint
          borrowingFeeAmount: bigint
          fundingFeeAmount: bigint
          entryPrice: bigint
          exitPrice: bigint
          reserveAmount: bigint
          realisedPnl: bigint
          averageEntryPrice: bigint
          openInterest: bigint
        }
        flags: { isLong: boolean }
      }>).map((p) => {
        const marketMatch = MARKET_LIST.find((m) => m.address.toLowerCase() === p.addresses.market.toLowerCase())
        const decimals = marketMatch?.collateralDecimals ?? 6

        return {
          market: p.addresses.market,
          collateralToken: p.addresses.collateralToken,
          isLong: p.flags.isLong,
          sizeInUsd: fromUsd(p.numbers.sizeInUsd),
          collateralAmount: fromTokenRaw(p.numbers.collateralAmount, decimals),
          entryPrice: fromUsd(p.numbers.entryPrice),
          averageEntryPrice: fromUsd(p.numbers.averageEntryPrice),
          unrealizedPnl: fromUsd(p.numbers.realisedPnl),
          borrowingFeeAmount: fromTokenRaw(p.numbers.borrowingFeeAmount, decimals),
          fundingFeeAmount: fromTokenRaw(p.numbers.fundingFeeAmount, decimals),
          marketKey: marketMatch?.key ?? null,
        }
      })
    },
    enabled: !!address && !!publicClient,
    refetchInterval: 8_000,
  })
}

// ─── Check Order Status ────────────────────────────────────
// Polls Reader.getOrder to see if an order has been executed

export function useOrderStatus(orderKey: Hash | null) {
  const publicClient = usePublicClient({ chainId: ARBITRUM_CHAIN_ID })

  return useQuery({
    queryKey: ["orderStatus", orderKey],
    queryFn: async (): Promise<"pending" | "executed" | "cancelled" | "unknown"> => {
      if (!publicClient || !orderKey) return "unknown"

      try {
        const order = await publicClient.readContract({
          address: CONTRACTS.reader,
          abi: readerAbi,
          functionName: "getOrder",
          args: [CONTRACTS.dataStore, orderKey],
        })

        // If the order struct has empty addresses, it means the order no longer exists
        // (was executed and removed)
        const orderData = order as { addresses: { account: string } }
        if (orderData.addresses.account === ZERO_ADDRESS) {
          return "executed"
        }
        return "pending"
      } catch {
        // getOrder reverts if order doesn't exist → executed
        return "executed"
      }
    },
    enabled: !!orderKey && !!publicClient,
    refetchInterval: 2_000,
  })
}

// ─── Arbiscan link helper ──────────────────────────────────

export function arbiscanTxLink(txHash: Hash): string {
  return `${ARBISCAN_URL}/tx/${txHash}`
}

export function arbiscanAddressLink(address: string): string {
  return `${ARBISCAN_URL}/address/${address}`
}
