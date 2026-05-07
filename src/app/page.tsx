"use client"

import { useAccount } from "wagmi"
import { useTradeStore } from "@/lib/store"
import { LandingScreen } from "@/components/LandingScreen"
import { MarketSelectScreen } from "@/components/MarketSelectScreen"
import { TradeSetupScreen } from "@/components/TradeSetupScreen"
import { OrderPendingScreen } from "@/components/OrderPendingScreen"
import { PositionLiveScreen } from "@/components/PositionLiveScreen"
import { TradeClosedScreen } from "@/components/TradeClosedScreen"
import { ErrorBoundary } from "@/components/ErrorBoundary"
import { WalletDisconnectGuard } from "@/components/WalletDisconnectGuard"

export default function EasyGMX() {
  const { isConnected } = useAccount()
  const { selectedMarket, activePosition, orderPhase, lastClosedTrade } = useTradeStore()

  const screen = (() => {
    if (!isConnected) return <LandingScreen />
    if (lastClosedTrade) return <TradeClosedScreen />
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
