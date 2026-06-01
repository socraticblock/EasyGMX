# EasyGMX V1 Ship Gate

**Date:** 2026-06-01  
**Repo:** `socraticblock/EasyGMX`  
**Purpose:** This document defines the mandatory engineering proof required before EasyGMX V1 can be considered signed off.

---

## 1. Status

EasyGMX is close to V1, but it is not signed off yet.

The core V1 engineering loop is mostly in place:

- Native wagmi wallet connection is in place.
- Classic user-paid GMX open/close is the V1 path.
- Dynamic execution-fee estimation exists.
- Pending state should rely on on-chain position polling, not fragile order-key guessing.
- Referral proof code and `/referral` page exist.
- GMX Express is research-only.
- Network-cost coverage/free-trade mechanics are not part of V1.

V1 is only signed off when this is true:

> A real wallet can open and fully close an ETH GMX position through EasyGMX on Arbitrum without getting stuck.

---

## Sign-off record

Fill this only after the required live ETH open/full-close test succeeds.

- Tested by:
- Wallet used:
- Production URL:
- Test date:
- Result: PASS / FAIL
- Notes:

---

## 2. Non-negotiable V1 ship gate

Before any public V1 release, complete the following with a real wallet, real USDC, and real Arbitrum ETH for execution fees.

### 2.1 Environment and deployment

- [ ] Latest `main` is deployed successfully.
- [ ] Production URL loads on desktop.
- [ ] Production URL loads on mobile.
- [ ] `NEXT_PUBLIC_GMX_REFERRAL_CODE` is set in Vercel if referral tracking is intended for V1.
- [ ] `NEXT_PUBLIC_WC_PROJECT_ID` is set if WalletConnect mobile behavior is needed.
- [ ] `NEXT_PUBLIC_RPC_URL` is set if using a dedicated Arbitrum RPC.
- [ ] No production env value is hardcoded into the repository.

### 2.2 Build checks

Run from a clean local checkout:

```bash
npm ci
npm run build
```

If the repository does not have a lockfile, use `npm install` instead of `npm ci`.

Acceptance:

- [ ] `npm ci` succeeds when a lockfile exists, or `npm install` succeeds when no lockfile exists.
- [ ] Build succeeds.
- [ ] No TypeScript errors.
- [ ] No runtime-blocking lint errors.
- [ ] No dependency/runtime warnings that block Vercel deployment.

### 2.3 Wallet and chain checks

Acceptance:

- [ ] Wallet connect works.
- [ ] Wallet disconnect works.
- [ ] Wrong-chain state clearly says to switch to Arbitrum.
- [ ] Arbitrum switch works.
- [ ] USDC balance loads.
- [ ] ETH market data loads.
- [ ] UI handles no wallet state cleanly.
- [ ] UI handles wrong chain state cleanly.

### 2.4 Referral checks

Run locally after setting `.env.local`:

```bash
npm run check:gmx-referral
```

Optional wallet-specific check:

```bash
npm run check:gmx-referral -- 0xYourWalletAddress
```

Acceptance:

- [ ] Referral code format is valid.
- [ ] Referral code is registered on GMX ReferralStorage for Arbitrum.
- [ ] `/referral` page loads.
- [ ] `/referral` shows configured code.
- [ ] `/referral` shows registration status.
- [ ] `/referral` shows code owner if available.
- [ ] `/referral` shows connected wallet attribution state.
- [ ] Normal V1 trading is not blocked by referral state.

Important rule:

> Do not assume referral income unless attribution is verified.

---

## 3. Required live ETH open/full-close test

### 3.1 Minimum live test

Use a small risk amount, for example $10.

Steps:

1. Connect wallet.
2. Switch to Arbitrum.
3. Confirm USDC balance shows.
4. Select ETH market.
5. Choose Price Up or Price Down.
6. Use small money at risk, for example $10.
7. Use V1 leverage setting. If current app still uses 5x/10x, test 5x. If new clarity scope is implemented, test 3x first.
8. Review:
   - market,
   - direction,
   - money at risk,
   - trade size,
   - leverage,
   - estimated entry,
   - estimated danger/close-out price,
   - estimated GMX fee range,
   - network/execution estimate,
   - slippage tolerance,
   - funding/borrow warning.
9. Approve USDC if prompted.
10. Open position.
11. Confirm pending state appears.
12. Confirm pending state resolves through position polling.
13. Confirm live position screen appears.
14. Close the full position.
15. Confirm close transaction/pending state appears.
16. Confirm closed summary or no-position state appears.
17. Confirm there is no stuck state.
18. Fill `docs/V1-LIVE-TRADE-TEST.md`.

### 3.2 Arbiscan/live-test evidence

Record this evidence when the live test is complete.

- Open transaction:
- Close transaction:
- Position observed:
- Wallet used:
- Production URL:
- Notes:

### 3.3 Stricter recommended test

- [ ] ETH long open + full close.
- [ ] ETH short open + full close.
- [ ] Wrong-chain switch.
- [ ] Approval flow.
- [ ] Pending keeper state.
- [ ] `/referral` page while wallet connected.
- [ ] Rejected wallet signature shows friendly error.
- [ ] Insufficient ETH/execution-fee state shows friendly error, if safe/practical.
- [ ] Slippage/execution-fee change error shows friendly error, if encountered.
- [ ] Mobile wallet connection works if WalletConnect is configured.

---

## 4. Stuck-state rules

V1 fails sign-off if any of these happen:

- App remains stuck on `Order Pending` after the position exists on-chain.
- App cannot detect a live position after a successful open.
- App cannot return to a clean state after full close.
- App requires a fragile order key to continue the critical flow.
- User has no clear way to recover from a failed/rejected transaction.
- UI says trade succeeded before position is actually discoverable.

Required behavior:

- Opening pending state should resolve by polling for the matching position.
- Closing pending state should resolve by confirming the position is gone or size is reduced to zero.
- Order key may be useful metadata, but must not be required for critical confirmation.

---

## 5. Required user-facing safety checks before V1 release

Before public V1, verify there is no misleading copy.

Forbidden wording:

- free trade
- sponsored trade
- gas-free
- risk-free
- guaranteed close
- easy money
- we pay your trades
- trade credit
- no cost
- guaranteed profit

Approved wording:

- Real GMX trades. Made simple.
- You can lose your full money at risk.
- No extra EasyGMX trading fee.
- GMX charges trading, execution, and holding costs.
- EasyGMX may receive a GMX referral reward.
- Estimates can change.

---

## 6. Definition of V1 ship-gate done

V1 ship gate is done only when all are true:

- [ ] `npm ci` passes when a lockfile exists, or `npm install` passes when no lockfile exists.
- [ ] `npm run build` passes.
- [ ] Vercel deployment succeeds.
- [ ] Production URL loads on desktop.
- [ ] Production URL loads on mobile.
- [ ] Wallet connect works.
- [ ] Arbitrum switch works.
- [ ] USDC balance loads.
- [ ] ETH market data loads.
- [ ] ETH open works with real wallet.
- [ ] Pending state resolves cleanly.
- [ ] Live position appears.
- [ ] Full close works.
- [ ] No stuck pending state.
- [ ] `/referral` works or missing referral config is clearly handled.
- [ ] `docs/V1-LIVE-TRADE-TEST.md` is filled.
- [ ] No sponsor wallet exists.
- [ ] No public cost coverage exists.
- [ ] No free/sponsored/risk-free wording exists.

---

## 7. Immediate owner actions

- [ ] Set `NEXT_PUBLIC_GMX_REFERRAL_CODE` in Vercel if not already set.
- [ ] Confirm latest Vercel deployment is live.
- [ ] Open production app on desktop.
- [ ] Open production app on mobile.
- [ ] Connect wallet.
- [ ] Switch to Arbitrum.
- [ ] Check `/referral`.
- [ ] Ask coder to run `npm run check:gmx-referral` with correct env.
- [ ] Do ETH open + full close.
- [ ] Fill `docs/V1-LIVE-TRADE-TEST.md`.

---

## 8. Immediate coder actions after owner test

- [ ] Fix any live-test issues.
- [ ] Fix any stuck pending/position detection issue.
- [ ] Commit checked live-test doc if appropriate.
- [ ] Confirm no free/sponsor/cost-coverage wording slipped in.
- [ ] Confirm production env handling is safe.
- [ ] Prepare V1 release note only after sign-off.
