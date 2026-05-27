"use client"

import { WalletButton } from "@/components/WalletButton"

export function LandingScreen() {
  return (
    <div className="min-h-screen flex flex-col items-center justify-center px-4">
      <div className="max-w-md w-full text-center space-y-8">
        <div className="space-y-3">
          <div className="inline-flex items-center gap-2 text-xs text-muted-foreground tracking-[0.2em] uppercase">
            <span className="inline-block w-1.5 h-1.5 rounded-full bg-[#22c55e] animate-pulse" />
            Powered by GMX V2
          </div>
          <h1 className="text-5xl font-bold tracking-tight">
            Easy<span className="text-[#418cf5]">GMX</span>
          </h1>
          <p className="text-base text-muted-foreground leading-relaxed max-w-xs mx-auto">
            Real GMX trades. Made simple.
          </p>
          <p className="text-sm text-muted-foreground/80 leading-relaxed max-w-xs mx-auto">
            Choose Price Up or Price Down, risk a fixed amount, and watch your trade live.
          </p>
        </div>

        <div className="space-y-3">
          <WalletButton className="w-full" />
        </div>

        <div className="grid grid-cols-3 gap-3 text-center pt-2">
          {([
            ["4 clicks", "to trade"],
            ["5x / 10x", "preset leverage"],
            ["GMX V2", "real positions"],
          ] as const).map(([title, sub]) => (
            <div key={title} className="space-y-1">
              <div className="text-sm font-semibold">{title}</div>
              <div className="text-[11px] text-muted-foreground">{sub}</div>
            </div>
          ))}
        </div>

        <div className="pt-4 space-y-2">
          <p className="text-[11px] text-muted-foreground/50 leading-relaxed">
            Simplified interface to GMX V2 on Arbitrum. All trades are real leveraged positions.
            You can lose your full risk amount. Not financial advice.
          </p>
          <div className="flex flex-col gap-1 items-center">
            <a
              href="/referral"
              className="inline-block text-[11px] text-[#418cf5]/60 hover:text-[#418cf5] transition-colors"
            >
              Referral transparency &rarr;
            </a>
            <a
              href="https://app.gmx.io"
              target="_blank"
              rel="noopener noreferrer"
              className="inline-block text-[11px] text-[#418cf5]/60 hover:text-[#418cf5] transition-colors"
            >
              Prefer the full UI? &rarr; app.gmx.io
            </a>
          </div>
        </div>
      </div>
    </div>
  )
}
