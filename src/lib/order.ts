import { encodeFunctionData, type Hash } from "viem"
import { usePublicClient, useWalletClient, useAccount } from "wagmi"
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query"

import { exchangeRouterAbi } from "./abi/exchangeRouter"
import { readerAbi } from "./abi/reader"
import { erc20Abi } from "./abi/erc20"
import {
  CONTRACTS,
  TOKENS,
  MARKET_LIST,
  ORDER_TYPE,
  DECREASE_POSITION_SWAP_TYPE,
  ARBITRUM_CHAIN_ID,
  ARBISCAN_URL,
  type MarketKey,
  toUsd,
  toTokenRaw,
  applySlippage,
  DEFAULT_EXECUTION_FEE_ETH,
  MAX_UINT256,
  ZERO_BYTES32,
  getGmxReferralCodeBytes32,
} from "./contracts"

export interface OrderResult {
  orderKey: Hash | null
  txHash: Hash
}

const ZERO_ADDRESS = "0x0000000000000000000000000000000000000000" as const

function executionFeeWei(): bigint {
  return BigInt(Math.round(DEFAULT_EXECUTION_FEE_ETH * 1e18))
}

function extractOrderKey(receipt: { logs: Array<{ topics: readonly `0x${string}`[] }> }): Hash | null {
  for (const log of [...receipt.logs].reverse()) {
    const topic = log.topics.find((t) => /^0x[0-9a-fA-F]{64}$/.test(t) && t !== ZERO_BYTES32)
    if (topic) return topic as Hash
  }
  return null
}

export function userFacingGmxError(err: unknown, fallback = "GMX could not complete this action. Try again or use GMX directly."): string {
  const message = err instanceof Error ? err.message : String(err ?? "")
  const lower = message.toLowerCase()
  if (lower.includes("user rejected") || lower.includes("user denied") || lower.includes("rejected")) return "Trade was cancelled in your wallet."
  if (lower.includes("allowance") || lower.includes("approve")) return "Approval was cancelled. You need to approve USDC before starting this trade."
  if (lower.includes("insufficient funds") || lower.includes("exceeds balance")) return "You need a small amount of ETH on Arbitrum to pay network and execution costs."
  if (lower.includes("acceptableprice") || lower.includes("price")) return "Price moved too quickly. Please review the trade and try again."
  return fallback
}

export function useUsdcApproval(amountRaw: bigint, approveAll = false) {
  const { address } = useAccount()
  const { data: walletClient } = useWalletClient()
  const publicClient = usePublicClient({ chainId: ARBITRUM_CHAIN_ID })
  const queryClient = useQueryClient()
  const approvalAmount = approveAll ? MAX_UINT256 : amountRaw

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

  const needsApproval = amountRaw > 0n && (!allowance || allowance < amountRaw)

  const approveMutation = useMutation({
    mutationFn: async () => {
      if (!walletClient || !address || !publicClient) throw new Error("Wallet not connected")

      const { request } = await publicClient.simulateContract({
        address: TOKENS.USDC,
        abi: erc20Abi,
        functionName: "approve",
        args: [CONTRACTS.router, approvalAmount],
        account: address,
      })

      const hash = await walletClient.writeContract(request)
      await publicClient.waitForTransactionReceipt({ hash })
      await queryClient.invalidateQueries({ queryKey: ["usdcAllowance", address] })
      return hash
    },
  })

  return {
    allowance,
    needsApproval,
    loadingAllowance,
    approveAsync: approveMutation.mutateAsync,
    approvePending: approveMutation.isPending,
    approveError: approveMutation.error,
    approveReset: approveMutation.reset,
  }
}

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
      if (!walletClient || !address || !publicClient) throw new Error("Wallet not connected")

      const marketInfo = MARKET_LIST.find((m) => m.key === params.marketKey)
      if (!marketInfo) throw new Error(`Unknown market: ${params.marketKey}`)

      const collateralRaw = toTokenRaw(params.collateralUsd, marketInfo.collateralDecimals)
      const sizeRaw = toUsd(params.sizeUsd)
      const fee = executionFeeWei()
      const acceptablePrice = applySlippage(params.currentPrice, params.isLong)

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
        args: [{
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
          referralCode: getGmxReferralCodeBytes32(),
          dataList: [],
        }],
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
      return { orderKey: extractOrderKey(receipt), txHash }
    },
  })
}

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
      if (!walletClient || !address || !publicClient) throw new Error("Wallet not connected")

      const sizeRaw = toUsd(params.sizeUsd)
      const fee = executionFeeWei()
      const acceptablePrice = applySlippage(params.currentPrice, !params.isLong)

      const sendWntData = encodeFunctionData({
        abi: exchangeRouterAbi,
        functionName: "sendWnt",
        args: [CONTRACTS.orderVault, fee],
      })

      const createOrderData = encodeFunctionData({
        abi: exchangeRouterAbi,
        functionName: "createOrder",
        args: [{
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
            initialCollateralDeltaAmount: 0n,
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
          referralCode: getGmxReferralCodeBytes32(),
          dataList: [],
        }],
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
      const receipt = await publicClient.waitForTransactionReceipt({ hash: txHash })
      return { orderKey: extractOrderKey(receipt), txHash }
    },
  })
}

export function useOrderStatus(orderKey: Hash | null | undefined) {
  const publicClient = usePublicClient({ chainId: ARBITRUM_CHAIN_ID })

  return useQuery({
    queryKey: ["orderStatus", orderKey],
    queryFn: async (): Promise<"pending" | "executed" | "unknown"> => {
      if (!publicClient || !orderKey) return "unknown"
      try {
        const order = await publicClient.readContract({
          address: CONTRACTS.reader,
          abi: readerAbi,
          functionName: "getOrder",
          args: [CONTRACTS.dataStore, orderKey],
        })
        const orderData = order as { addresses: { account: string } }
        return orderData.addresses.account === ZERO_ADDRESS ? "executed" : "pending"
      } catch {
        return "executed"
      }
    },
    enabled: !!orderKey && !!publicClient,
    refetchInterval: 2_000,
  })
}

export function arbiscanTxLink(txHash: Hash): string {
  return `${ARBISCAN_URL}/tx/${txHash}`
}

export function arbiscanAddressLink(address: string): string {
  return `${ARBISCAN_URL}/address/${address}`
}
