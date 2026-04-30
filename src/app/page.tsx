"use client"

import { useAccount } from "wagmi"
import { useTradeStore } from "@/lib/store"
import { LandingScreen } from "@/components/LandingScreen"
import { MarketSelectScreen } from "@/components/MarketSelectScreen"
import { TradeSetupScreen } from "@/components/TradeSetupScreen"
import { OrderPendingScreen } from "@/components/OrderPendingScreen"
import { PositionLiveScreen } from "@/components/PositionLiveScreen"
import { ErrorBoundary } from "@/components/ErrorBoundary"
import { WalletDisconnectGuard } from "@/components/WalletDisconnectGuard"

export default function EasyGMX() {
  const { isConnected } = useAccount()
  const { selectedMarket, activePosition, orderPhase } = useTradeStore()

  // Screen routing:
  // 1. Not connected → Landing
  // 2. Connected, no market → Market Select
  // 3. Market selected, no position → Trade Setup
  // 4. Order submitted, waiting for keeper → Order Pending
  // 5. Position active → Position Live

  const screen = (() => {
    if (!isConnected) return <LandingScreen />
    if (activePosition && orderPhase === "keeper") return <OrderPendingScreen />
    if (activePosition) return <PositionLiveScreen />
    if (selectedMarket) return <TradeSetupScreen />
    return <MarketSelectScreen />
  })()

  return (
    <ErrorBoundary>
      <WalletDisconnectGuard>
        {screen}
      </WalletDisconnectGuard>
    </ErrorBoundary>
  )
}
