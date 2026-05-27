import { type Address, zeroAddress } from "viem"
import { ZERO_BYTES32 } from "./contracts"

/** GMX ReferralStorage on Arbitrum — https://docs.gmx.io/docs/referrals */
export const GMX_REFERRAL_STORAGE_ARBITRUM =
  "0xe6fab3F0c7199b0d34d7FbE83394fc0e0D06e99d" as const

export const referralStorageAbi = [
  {
    type: "function",
    name: "codeOwners",
    stateMutability: "view",
    inputs: [{ name: "code", type: "bytes32" }],
    outputs: [{ name: "", type: "address" }],
  },
  {
    type: "function",
    name: "traderReferralCodes",
    stateMutability: "view",
    inputs: [{ name: "account", type: "address" }],
    outputs: [{ name: "", type: "bytes32" }],
  },
] as const

export type ReferralAttributionState =
  | "INVALID_CONFIG"
  | "EASYGMX_ACTIVE"
  | "OTHER_CODE_ACTIVE"
  | "NO_CODE"
  | "UNKNOWN"

const REFERRAL_CODE_PATTERN = /^[A-Za-z0-9_]{1,20}$/

export function getConfiguredReferralCode(): string | null {
  const code = process.env.NEXT_PUBLIC_GMX_REFERRAL_CODE?.trim()
  return code || null
}

export function validateReferralCode(code: string): string | null {
  if (!code) return "Referral code is empty."
  if (code.length > 20) return "Referral code must be 20 characters or fewer."
  if (!REFERRAL_CODE_PATTERN.test(code)) {
    return "Referral code may only contain letters, digits, and underscores."
  }
  return null
}

export function encodeReferralCodeToBytes32(code: string): `0x${string}` | null {
  const validationError = validateReferralCode(code)
  if (validationError) return null

  if (/^0x[0-9a-fA-F]{64}$/.test(code)) {
    return code as `0x${string}`
  }

  const bytes = new TextEncoder().encode(code)
  if (bytes.length > 32) return null
  const hex = Array.from(bytes, (b) => b.toString(16).padStart(2, "0")).join("").padEnd(64, "0")
  return `0x${hex}`
}

export function getEasyGmxReferralCodeBytes32(): `0x${string}` {
  const code = getConfiguredReferralCode()
  if (!code) return ZERO_BYTES32
  return encodeReferralCodeToBytes32(code) ?? ZERO_BYTES32
}

export function isReferralConfigValid(): boolean {
  const code = getConfiguredReferralCode()
  if (!code) return false
  return validateReferralCode(code) === null && encodeReferralCodeToBytes32(code) !== null
}

export function classifyReferralAttribution(
  traderCode: `0x${string}` | undefined,
  easyCode: `0x${string}`
): ReferralAttributionState {
  if (!isReferralConfigValid() || easyCode === ZERO_BYTES32) return "INVALID_CONFIG"
  if (traderCode === undefined) return "UNKNOWN"
  if (traderCode === ZERO_BYTES32) return "NO_CODE"
  if (traderCode.toLowerCase() === easyCode.toLowerCase()) return "EASYGMX_ACTIVE"
  return "OTHER_CODE_ACTIVE"
}

export function referralAttributionLabel(state: ReferralAttributionState): string {
  switch (state) {
    case "EASYGMX_ACTIVE":
      return "EasyGMX active"
    case "OTHER_CODE_ACTIVE":
      return "another code active"
    case "NO_CODE":
      return "no referral active"
    case "INVALID_CONFIG":
      return "invalid config"
    case "UNKNOWN":
    default:
      return "unknown"
  }
}

export function bytes32ToReferralString(code: `0x${string}`): string | null {
  if (code === ZERO_BYTES32) return null
  const hex = code.slice(2)
  const bytes: number[] = []
  for (let i = 0; i < hex.length; i += 2) {
    const byte = parseInt(hex.slice(i, i + 2), 16)
    if (byte === 0) break
    bytes.push(byte)
  }
  if (bytes.length === 0) return null
  try {
    return new TextDecoder().decode(new Uint8Array(bytes))
  } catch {
    return null
  }
}

export function isRegisteredCodeOwner(owner: Address | undefined): boolean {
  return !!owner && owner !== zeroAddress
}
