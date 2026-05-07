import { GmxApiSdk } from "@gmx-io/sdk/v2"
import { ARBITRUM_CHAIN_ID } from "./contracts"

let sdk: GmxApiSdk | null = null

export function getGmxSdk(): GmxApiSdk {
  if (!sdk) {
    sdk = new GmxApiSdk({ chainId: ARBITRUM_CHAIN_ID })
  }
  return sdk
}
