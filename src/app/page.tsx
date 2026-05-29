"use client"

import { useTradeStore } from "@/lib/store"
import { HomeScreen } from "@/components/HomeScreen"
import { MarketSelectScreen } from "@/components/MarketSelectScreen"
import { TradeSetupScreen } from "@/components/TradeSetupScreen"
import { OrderPendingScreen } from "@/components/OrderPendingScreen"
import { PositionLiveScreen } from "@/components/PositionLiveScreen"
import { TradeClosedScreen } from "@/components/TradeClosedScreen"
import { ErrorBoundary } from "@/components/ErrorBoundary"
import { WalletDisconnectGuard } from "@/components/WalletDisconnectGuard"

export default function EasyGMX() {
  const { selectedMarket, activePosition, orderPhase, lastClosedTrade, showMarketPicker } = useTradeStore()

  const screen = (() => {
    if (lastClosedTrade) return <TradeClosedScreen />
    if (activePosition && (orderPhase === "keeper" || orderPhase === "recovery")) return <OrderPendingScreen />
    if (activePosition) return <PositionLiveScreen />
    if (selectedMarket) return <TradeSetupScreen />
    if (showMarketPicker) return <MarketSelectScreen />
    return <HomeScreen />
  })()

  return (
    <ErrorBoundary>
      <WalletDisconnectGuard>
        {screen}
      </WalletDisconnectGuard>
    </ErrorBoundary>
  )
}
