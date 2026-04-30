import { createConfig, http } from "wagmi"
import { arbitrum } from "wagmi/chains"
import { getDefaultConnectors } from "connectkit"
import { RPC_URL } from "./contracts"

const connectors = getDefaultConnectors({
  app: {
    name: "EasyGMX",
    icon: "/logo.svg",
    description: "Simple perpetuals trading on GMX V2",
    url: "https://easygmx.io",
  },
  walletConnectProjectId: process.env.NEXT_PUBLIC_WC_PROJECT_ID ?? "",
  coinbaseWalletPreference: "smartWalletOnly",
})

export const wagmiConfig = createConfig({
  chains: [arbitrum],
  transports: {
    [arbitrum.id]: http(RPC_URL),
  },
  connectors,
  ssr: true,
})
