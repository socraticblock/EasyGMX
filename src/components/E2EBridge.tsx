"use client"

import { useEffect } from "react"
import { useTradeStore } from "@/lib/store"

declare global {
  interface Window {
    __EASYGMX_E2E__?: {
      reset: () => void
      setState: (partial: Partial<ReturnType<typeof useTradeStore.getState>>) => void
    }
  }
}

export function E2EBridge() {
  useEffect(() => {
    window.__EASYGMX_E2E__ = {
      reset: () => useTradeStore.getState().reset(),
      setState: (partial) => useTradeStore.setState(partial),
    }
  }, [])

  return null
}
