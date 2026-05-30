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
  RPC_URL,
  API_BASE,
  GMX_SUBSQUID_URL,
  SLIPPAGE_BPS,
  type MarketKey,
  toUsd,
  toTokenRaw,
  applySlippage,
  MAX_UINT256,
  getGmxReferralCodeBytes32,
} from "./contracts"
import { fetchGmxExecutionFeeWei } from "./gmxExecutionFee"

export interface OrderResult {
  orderKey: Hash | null
  txHash: Hash
}

export type SupportedPayTokenAddress = typeof TOKENS.USDC | typeof TOKENS.USDCe

const ZERO_ADDRESS = "0x0000000000000000000000000000000000000000" as const

const EXECUTION_FEE_ERROR_COPY =
  "Network / execution cost changed before GMX accepted the order. Please refresh the quote and try again."

function payTokenLabel(tokenAddress: SupportedPayTokenAddress): string {
  return tokenAddress.toLowerCase() === TOKENS.USDCe.toLowerCase() ? "USDC.e" : "USDC"
}

function normalizeHash(value: unknown): Hash | null {
  if (typeof value === "string" && value.startsWith("0x")) return value as Hash
  if (!value || typeof value !== "object") return null
  const result = value as Record<string, unknown>
  const direct = result.txHash ?? result.hash ?? result.transactionHash
  if (typeof direct === "string" && direct.startsWith("0x")) return direct as Hash
  const receipt = result.receipt
  if (receipt && typeof receipt === "object") {
    const hash = (receipt as Record<string, unknown>).transactionHash
    if (typeof hash === "string" && hash.startsWith("0x")) return hash as Hash
  }
  return null
}

export function userFacingGmxError(err: unknown, fallback = "GMX could not complete this action. Try again or use GMX directly."): string {
  const message = err instanceof Error ? err.message : String(err ?? "")
  const lower = message.toLowerCase()
  if (lower.includes("user rejected") || lower.includes("user denied") || lower.includes("rejected")) return "Trade was cancelled in your wallet."
  if (lower.includes("allowance") || lower.includes("approve")) return "Approval was cancelled. You need to approve the selected USDC token before starting this trade."
  if (lower.includes("insufficient funds") || lower.includes("exceeds balance")) return "You need a small amount of ETH on Arbitrum to pay network and execution costs."
  if (
    lower.includes("insufficientexecutionfee") ||
    lower.includes("insufficient execution fee") ||
    lower.includes("execution fee") ||
    lower.includes("minexecutionfee") ||
    lower.includes("keeper fee") ||
    lower.includes("gas price") ||
    lower.includes("max fee per gas") ||
    lower.includes("fee too low")
  ) {
    return EXECUTION_FEE_ERROR_COPY
  }
  if (lower.includes("acceptableprice") || lower.includes("price")) return "Price moved too quickly. Please review the trade and try again."
  if (lower.includes("route") || lower.includes("swap path") || lower.includes("swap")) return "GMX could not route the selected USDC token into this trade. Try native Arbitrum USDC or a smaller amount."
  return fallback
}

export function useUsdcApproval(
  amountRaw: bigint,
  approveAll = false,
  tokenAddress: SupportedPayTokenAddress = TOKENS.USDC,
) {
  const { address } = useAccount()
  const { data: walletClient } = useWalletClient()
  const publicClient = usePublicClient({ chainId: ARBITRUM_CHAIN_ID })
  const queryClient = useQueryClient()
  const approvalAmount = approveAll ? MAX_UINT256 : amountRaw
  const tokenLabel = payTokenLabel(tokenAddress)

  const { data: allowance, isLoading: loadingAllowance } = useQuery({
    queryKey: ["usdcAllowance", address, tokenAddress],
    queryFn: async () => {
      if (!publicClient || !address) return 0n
      const a = await publicClient.readContract({
        address: tokenAddress,
        abi: erc20Abi,
        functionName: "allowance",
        args: [address, CONTRACTS.router],
      })
      return a as bigint
    },
    enabled: !!address && !!publicClient,
    refetchInterval: 10_000,
  })

  const needsApproval =
    allowance !== undefined &&
    amountRaw > 0n &&
    allowance < amountRaw

  const approveMutation = useMutation({
    mutationFn: async () => {
      if (!walletClient || !address || !publicClient) throw new Error("Wallet not connected")

      const { request } = await publicClient.simulateContract({
        address: tokenAddress,
        abi: erc20Abi,
        functionName: "approve",
        args: [CONTRACTS.router, approvalAmount],
        account: address,
      })

      const hash = await walletClient.writeContract(request)
      await publicClient.waitForTransactionReceipt({ hash })
      await queryClient.invalidateQueries({ queryKey: ["usdcAllowance", address, tokenAddress] })
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
    tokenLabel,
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
      leverage: 5 | 10
      collateralUsd: number
      sizeUsd: number
      currentPrice: number
      payTokenAddress?: SupportedPayTokenAddress
    }): Promise<OrderResult> => {
      if (!walletClient || !address || !publicClient) throw new Error("Wallet not connected")

      const marketInfo = MARKET_LIST.find((m) => m.key === params.marketKey)
      if (!marketInfo) throw new Error(`Unknown market: ${params.marketKey}`)

      const payTokenAddress = params.payTokenAddress ?? TOKENS.USDC

      if (payTokenAddress.toLowerCase() !== TOKENS.USDC.toLowerCase()) {
        const sdkModule = await import("@gmx-io/sdk") as unknown as { GmxSdk?: new (config: Record<string, unknown>) => unknown }
        const GmxSdk = sdkModule.GmxSdk
        if (!GmxSdk) throw new Error("GMX SDK order helper is not available")

        const sdk = new GmxSdk({
          chainId: ARBITRUM_CHAIN_ID,
          rpcUrl: RPC_URL,
          oracleUrl: API_BASE,
          subsquidUrl: GMX_SUBSQUID_URL,
          publicClient,
          walletClient,
          account: address,
        }) as {
          setAccount?: (account: string) => void
          callContract?: (...args: unknown[]) => Promise<unknown>
          orders?: {
            long?: (args: Record<string, unknown>) => Promise<unknown>
            short?: (args: Record<string, unknown>) => Promise<unknown>
          }
        }

        sdk.setAccount?.(address)
        const originalCallContract = sdk.callContract?.bind(sdk)
        if (!originalCallContract) throw new Error("GMX SDK contract writer is not available")

        let submittedTxHash: Hash | null = null
        sdk.callContract = async (...args: unknown[]) => {
          const result = await originalCallContract(...args)
          submittedTxHash = normalizeHash(result)
          return result
        }

        const helper = params.isLong ? sdk.orders?.long : sdk.orders?.short
        if (!helper) throw new Error("GMX routed order helper is not available")

        await helper({
          payAmount: toTokenRaw(params.collateralUsd, 6),
          marketAddress: marketInfo.address,
          payTokenAddress,
          collateralTokenAddress: TOKENS.USDC,
          allowedSlippageBps: SLIPPAGE_BPS,
          leverage: BigInt(params.leverage * 10_000),
          referralCodeForTxn: getGmxReferralCodeBytes32(),
        })

        if (!submittedTxHash) throw new Error("GMX routed order did not return a transaction hash")
        await publicClient.waitForTransactionReceipt({ hash: submittedTxHash })
        return { orderKey: null, txHash: submittedTxHash }
      }

      const collateralRaw = toTokenRaw(params.collateralUsd, marketInfo.collateralDecimals)
      const sizeRaw = toUsd(params.sizeUsd)
      const fee = await fetchGmxExecutionFeeWei(params.marketKey)
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
      await publicClient.waitForTransactionReceipt({ hash: txHash })
      // orderKey is optional; pending → confirmed uses on-chain position polling (see OrderPendingScreen).
      return { orderKey: null, txHash }
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
      const marketKey = MARKET_LIST.find((m) => m.address.toLowerCase() === params.marketAddress.toLowerCase())?.key ?? "ETH/USD"
      const fee = await fetchGmxExecutionFeeWei(marketKey)
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
      await publicClient.waitForTransactionReceipt({ hash: txHash })
      return { orderKey: null, txHash }
    },
  })
}

/** Optional hint only — never use for pending → confirmed; position polling is source of truth. */
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
        return "unknown"
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
