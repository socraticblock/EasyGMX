# Network Cost Coverage — Later Only

EasyGMX V1 **does not** implement sponsor wallets, trade credits, free gas, or public cost coverage.

Coverage may be reconsidered only if **all** gates below are satisfied:

1. **GMX Express is insufficient** — documented in `docs/gmx-express-feasibility.md`.
2. **Referral attribution verified** — wallet state `EASYGMX_ACTIVE` via `src/lib/gmxReferral.ts`; never cover wallets attributed to another code.
3. **Refund destination known** — GMX refunds unused execution fee portions to the trader account; measure actual refund leakage.
4. **Refund leakage bounded** — zero, tiny, or explicitly capped per trade.
5. **Unit economics acceptable** — see `docs/economic-proof-memo.md` break-even notional vs referral income.
6. **Legal review** — explicit approval for subsidized trading in target jurisdictions.
7. **Ticket / reservation / safety infrastructure** — reservations before spend; no hot-wallet drain of full reserve.
8. **Hot wallet limits** — cannot drain full reserve; per-trade caps.
9. **Emergency manual close** — ops path to close user positions if automation fails.

## Hard rule

```text
Private beta coverage must come after ticket/reservation/safety infrastructure, not before.
```

## Product language

Do not ship user-facing copy implying free trades, sponsored trades, gas-free trading, or risk-free trading.

## Config rule (future)

If coverage is ever enabled:

```text
coverage disabled unless referral state === EASYGMX_ACTIVE
```

Do not cover the first on-chain trade that sets referral attribution.
