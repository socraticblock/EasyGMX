import { mkdirSync } from "node:fs"
import { test } from "@playwright/test"
import {
  VIEWPORTS,
  assertNoHorizontalScroll,
  captureResponsiveScreenshot,
  showClosedTrade,
  showHome,
  showLivePosition,
  showMarketSelect,
  showPending,
  showReferral,
  showTradeSetup,
} from "./helpers"

const SCREENS = [
  { name: "home", navigate: showHome },
  { name: "market-select", navigate: showMarketSelect },
  { name: "trade-setup", navigate: showTradeSetup },
  { name: "pending", navigate: showPending },
  { name: "live-position", navigate: showLivePosition },
  { name: "closed-trade", navigate: showClosedTrade },
  { name: "referral", navigate: showReferral },
] as const

test.beforeAll(() => {
  mkdirSync("test-results/responsive", { recursive: true })
})

for (const screen of SCREENS) {
  test.describe(`${screen.name} responsive layout`, () => {
    for (const viewport of VIEWPORTS) {
      test(`${viewport.name}px — no horizontal scroll`, async ({ page }) => {
        await page.setViewportSize({ width: viewport.width, height: viewport.height })
        await screen.navigate(page)
        await page.waitForTimeout(500)
        await assertNoHorizontalScroll(page)
        await captureResponsiveScreenshot(page, screen.name, viewport.name)
      })
    }
  })
}
