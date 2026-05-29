# EasyGMX V1 — Known Limitations

This document lists behaviors **intentionally out of scope** for the V1 polish pass. See [V1-LIVE-TRADE-TEST.md](./V1-LIVE-TRADE-TEST.md) for manual verification.

## Out of scope for this pass

- **Browser refresh during pending/recovery** — EasyGMX state lives in memory (Zustand). Refreshing returns you to the home screen even if GMX is still executing your order. Check Arbiscan or [GMX](https://app.gmx.io) directly.
- **Wallet disconnect during pending/recovery** — Disconnecting resets local trade state via `WalletDisconnectGuard`. Your on-chain order or position is unaffected.
- **Session / localStorage recovery of submitted orders** — EasyGMX does not persist pending order state across sessions.
- **Major dependency cleanup** — No broad dependency purge in V1 polish.
- **New markets, collateral types, GMX Express, or contract changes** — V1 remains Arbitrum + USDC + Classic GMX V2 execution only.

## Expected behavior (document for testers)

| Scenario | Expected |
|----------|----------|
| Pending timeout | User stays on recovery screen; `activePosition` is **not** cleared |
| Continue checking | Returns to active polling; timer resets; no navigation home |
| GMX confirms after timeout | User routes to live position; `openTxHash` preserved |
| Close fails | Live position screen remains; error shown; user can retry |
| Refresh during recovery | Returns home; transaction may still execute on GMX |
