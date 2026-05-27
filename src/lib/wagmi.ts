import { createConfig, http } from "wagmi"
import { arbitrum } from "wagmi/chains"
import { coinbaseWallet, injected, walletConnect } from "wagmi/connectors"
import { RPC_URL } from "./contracts"

const wcProjectId = process.env.NEXT_PUBLIC_WC_PROJECT_ID?.trim() ?? ""

const connectors = [
  injected({ shimDisconnect: true }),
  ...(wcProjectId
    ? [
        walletConnect({
          projectId: wcProjectId,
          showQrModal: true,
        }),
      ]
    : []),
  coinbaseWallet({
    appName: "EasyGMX",
    preference: "smartWalletOnly",
  }),
]

export const wagmiConfig = createConfig({
  chains: [arbitrum],
  transports: {
    [arbitrum.id]: http(RPC_URL),
  },
  connectors,
  ssr: true,
})
