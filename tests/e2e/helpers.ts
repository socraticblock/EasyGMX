import type { Page } from "@playwright/test"
import { MARKETS } from "../../src/lib/contracts"

export const VIEWPORTS = [
  { name: "320", width: 320, height: 568 },
  { name: "390", width: 390, height: 844 },
  { name: "768", width: 768, height: 1024 },
  { name: "1024", width: 1024, height: 768 },
  { name: "1366", width: 1366, height: 768 },
  { name: "1920", width: 1920, height: 1080 },
  { name: "2560", width: 2560, height: 1440 },
  { name: "3440", width: 3440, height: 1440 },
] as const

const MOCK_POSITION = {
  marketKey: "ETH/USD" as const,
  marketAddress: MARKETS["ETH/USD"],
  direction: "up" as const,
  isLong: true,
  riskUsd: 25,
  sizeUsd: 125,
  leverage: 5 as const,
  entryPrice: 3200,
  currentPrice: 3250,
  liquidationPrice: 2800,
  pnlUsd: 1.95,
  pnlPercent: 7.8,
  borrowFeeUsd: 0,
  fundingFeeUsd: 0,
  isOnChain: true,
}

const MOCK_CLOSED_TRADE = {
  marketKey: "ETH/USD" as const,
  direction: "up" as const,
  leverage: 5 as const,
  riskUsd: 25,
  sizeUsd: 125,
  entryPrice: 3200,
  exitPrice: 3250,
  pnlUsd: 1.95,
  pnlPercent: 7.8,
  closedAt: Date.now(),
}

export async function resetAppState(page: Page) {
  await page.goto("/")
  await page.waitForFunction(() => window.__EASYGMX_E2E__?.reset)
  await page.evaluate(() => window.__EASYGMX_E2E__!.reset())
}

export async function showHome(page: Page) {
  await resetAppState(page)
  await page.waitForSelector("text=Real GMX trades.")
}

export async function showMarketSelect(page: Page) {
  await resetAppState(page)
  await page.evaluate(() => window.__EASYGMX_E2E__!.setState({ showMarketPicker: true }))
  await page.waitForSelector("text=All markets")
}

export async function showTradeSetup(page: Page) {
  await resetAppState(page)
  await page.evaluate(() => window.__EASYGMX_E2E__!.setState({ selectedMarket: "ETH/USD" }))
  await page.waitForSelector("text=Review GMX order")
}

export async function showPending(page: Page) {
  await resetAppState(page)
  await page.evaluate(() =>
    window.__EASYGMX_E2E__!.setState({
      activePosition: { ...MOCK_POSITION, isOnChain: false },
      orderPhase: "keeper",
    }),
  )
  await page.waitForSelector("text=Opening your")
}

export async function showLivePosition(page: Page) {
  await resetAppState(page)
  await page.evaluate(() =>
    window.__EASYGMX_E2E__!.setState({
      activePosition: MOCK_POSITION,
      orderPhase: "confirmed",
    }),
  )
  await page.waitForSelector("text=Close full position")
}

export async function showClosedTrade(page: Page) {
  await resetAppState(page)
  await page.evaluate(() =>
    window.__EASYGMX_E2E__!.setState({
      lastClosedTrade: MOCK_CLOSED_TRADE,
    }),
  )
  await page.waitForSelector("text=Trade closed")
}

export async function showReferral(page: Page) {
  await page.goto("/referral")
  await page.waitForSelector("text=Referral transparency")
}

export async function assertNoHorizontalScroll(page: Page) {
  const overflow = await page.evaluate(() => {
    const doc = document.documentElement
    return doc.scrollWidth > doc.clientWidth + 1
  })
  if (overflow) {
    throw new Error(`Horizontal scroll detected at ${page.viewportSize()?.width}px width`)
  }
}

export async function captureResponsiveScreenshot(page: Page, screen: string, viewportName: string) {
  await page.screenshot({
    path: `test-results/responsive/${screen}-${viewportName}.png`,
    fullPage: true,
  })
}
