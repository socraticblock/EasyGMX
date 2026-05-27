"use client"

import { useAccount, useReadContract } from "wagmi"
import {
  classifyReferralAttribution,
  getEasyGmxReferralCodeBytes32,
  GMX_REFERRAL_STORAGE_ARBITRUM,
  isReferralConfigValid,
  isRegisteredCodeOwner,
  referralAttributionLabel,
  referralStorageAbi,
  type ReferralAttributionState,
  getConfiguredReferralCode,
  encodeReferralCodeToBytes32,
  validateReferralCode,
} from "@/lib/gmxReferral"
import { ARBITRUM_CHAIN_ID } from "@/lib/contracts"

export function useGmxReferralStatus() {
  const { address, isConnected } = useAccount()
  const configuredCode = getConfiguredReferralCode()
  const easyCode = getEasyGmxReferralCodeBytes32()
  const configError = configuredCode ? validateReferralCode(configuredCode) : "NEXT_PUBLIC_GMX_REFERRAL_CODE is not set."

  const { data: codeOwner, isLoading: ownerLoading } = useReadContract({
    address: GMX_REFERRAL_STORAGE_ARBITRUM,
    abi: referralStorageAbi,
    functionName: "codeOwners",
    args: [easyCode],
    chainId: ARBITRUM_CHAIN_ID,
    query: { enabled: isReferralConfigValid() },
  })

  const { data: traderCode, isLoading: traderLoading } = useReadContract({
    address: GMX_REFERRAL_STORAGE_ARBITRUM,
    abi: referralStorageAbi,
    functionName: "traderReferralCodes",
    args: address ? [address] : undefined,
    chainId: ARBITRUM_CHAIN_ID,
    query: { enabled: isConnected && !!address },
  })

  const attribution: ReferralAttributionState = isConnected
    ? classifyReferralAttribution(traderCode, easyCode)
    : "UNKNOWN"

  return {
    configuredCode,
    configError: isReferralConfigValid() ? null : configError,
    easyCodeBytes32: easyCode,
    codeRegistered: isRegisteredCodeOwner(codeOwner),
    codeOwner: codeOwner ?? null,
    traderReferralCode: traderCode ?? null,
    attribution,
    attributionLabel: referralAttributionLabel(attribution),
    isLoading: ownerLoading || (isConnected && traderLoading),
    encodedConfigured: configuredCode ? encodeReferralCodeToBytes32(configuredCode) : null,
  }
}
