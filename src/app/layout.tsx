import type { Metadata, Viewport } from "next"
import { Geist, Geist_Mono } from "next/font/google"
import "./globals.css"
import "./home-polish.css"
import "./responsive-trading.css"
import { Web3Provider } from "@/providers/Web3Provider"

const geistSans = Geist({ variable: "--font-geist-sans", subsets: ["latin"] })
const geistMono = Geist_Mono({ variable: "--font-geist-mono", subsets: ["latin"] })

export const metadata: Metadata = {
  title: "EasyGMX — Simple Perp Trading",
  description: "Trade real GMX V2 positions on Arbitrum with a simpler, review-first interface.",
}

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  themeColor: "#0a0a0f",
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className="dark">
      <body className={`${geistSans.variable} ${geistMono.variable} font-sans`}>
        <Web3Provider>{children}</Web3Provider>
      </body>
    </html>
  )
}
