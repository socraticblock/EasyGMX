import { createConfig, http } from "wagmi"
import { arbitrum } from "wagmi/chains"
import { RPC_URL } from "./contracts"

export const wagmiConfig = createConfig({
  chains: [arbitrum],
  transports: {
    [arbitrum.id]: http(RPC_URL),
  },
  ssr: true,
})
