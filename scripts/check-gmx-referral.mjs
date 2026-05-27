import { createPublicClient, http, zeroAddress } from "viem"
import { arbitrum } from "viem/chains"

const REFERRAL_STORAGE = "0xe6fab3F0c7199b0d34d7FbE83394fc0e0D06e99d"
const ZERO_BYTES32 = "0x0000000000000000000000000000000000000000000000000000000000000000"
const REFERRAL_CODE_PATTERN = /^[A-Za-z0-9_]{1,20}$/

const referralStorageAbi = [
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
]

function encodeReferralCode(code) {
  if (/^0x[0-9a-fA-F]{64}$/.test(code)) return code
  if (!REFERRAL_CODE_PATTERN.test(code) || code.length > 20) return null
  const bytes = new TextEncoder().encode(code)
  const hex = Array.from(bytes, (b) => b.toString(16).padStart(2, "0")).join("").padEnd(64, "0")
  return `0x${hex}`
}

function bytes32ToString(code) {
  if (code === ZERO_BYTES32) return null
  const hex = code.slice(2)
  const bytes = []
  for (let i = 0; i < hex.length; i += 2) {
    const byte = parseInt(hex.slice(i, i + 2), 16)
    if (byte === 0) break
    bytes.push(byte)
  }
  return bytes.length ? new TextDecoder().decode(new Uint8Array(bytes)) : null
}

const rpc = process.env.NEXT_PUBLIC_RPC_URL ?? "https://arb1.arbitrum.io/rpc"
const client = createPublicClient({ chain: arbitrum, transport: http(rpc) })

const configured = process.env.NEXT_PUBLIC_GMX_REFERRAL_CODE?.trim()
const walletArg = process.argv[2]

console.log("EasyGMX referral check (Arbitrum)\n")

if (!configured) {
  console.error("INVALID_CONFIG: NEXT_PUBLIC_GMX_REFERRAL_CODE is not set")
  process.exit(1)
}

const easyBytes = encodeReferralCode(configured)
if (!easyBytes) {
  console.error("INVALID_CONFIG: referral code failed validation/encoding")
  process.exit(1)
}

console.log(`Configured code: ${configured}`)
console.log(`Encoded bytes32: ${easyBytes}`)

const owner = await client.readContract({
  address: REFERRAL_STORAGE,
  abi: referralStorageAbi,
  functionName: "codeOwners",
  args: [easyBytes],
})

const registered = owner && owner !== zeroAddress
console.log(`Code registered: ${registered ? "yes" : "no"}`)
console.log(`Code owner: ${registered ? owner : "—"}`)

if (walletArg) {
  const traderCode = await client.readContract({
    address: REFERRAL_STORAGE,
    abi: referralStorageAbi,
    functionName: "traderReferralCodes",
    args: [walletArg],
  })
  const traderStr = bytes32ToString(traderCode) ?? traderCode
  let state = "UNKNOWN"
  if (traderCode === ZERO_BYTES32) state = "NO_CODE"
  else if (traderCode.toLowerCase() === easyBytes.toLowerCase()) state = "EASYGMX_ACTIVE"
  else state = "OTHER_CODE_ACTIVE"

  console.log(`\nWallet: ${walletArg}`)
  console.log(`Trader on-chain code: ${traderStr}`)
  console.log(`Attribution state: ${state}`)
}

console.log("\nDone.")
