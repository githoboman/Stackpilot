# Stackpilot

**An autonomous AI trading agent for Stacks, bounded by an on-chain Clarity policy.**

Stackpilot lets you delegate on-chain trading to an AI agent — within hard limits you
set once and enforce in a Clarity smart contract. You sign one policy (budget cap,
asset whitelist, allowed protocol, expiry); the agent then holds its own Stacks wallet
and signs its own Bitflow swaps **without per-trade approval**. The contract re-checks
every action and aborts anything outside the policy, so even a compromised key cannot
overspend, trade off-whitelist, or act past expiry. Revoke any time and the agent's next
action aborts on-chain.

The headline use case is **Auto-DCA** — recurringly accumulating sBTC (Bitcoin) on a
schedule, re-validated on-chain each run.

> Built on Stacks. Bounded by Clarity. Secured by Bitcoin finality.

---

## How it works

1. **Set a policy.** Define your budget, the tokens the agent may touch (e.g. STX,
   sBTC), the allowed protocol (Bitflow), and an expiry (a burn-block height). Sign once.
2. **Instruct in plain language.** *"DCA 5 STX into sBTC every hour."* / *"Swap 10 STX
   to sBTC."* An intent parser turns your words into a structured, policy-checked action.
3. **The agent trades — you stay in control.** Real Bitflow swaps execute autonomously.
   The Clarity contract enforces every limit; revoke and the next action fails on-chain.

## The guarantee (Clarity)

The policy lives in [`stacks-contracts/contracts/agent-policy.clar`](stacks-contracts/contracts/agent-policy.clar).
Every spend goes through `record-spend`, which re-validates budget, asset scope, protocol
scope, expiry, and a `revoked` flag and aborts on any violation. Clarity serializes
contract calls, so budget accounting is **race-free natively**. Expiry is gated on the
Stacks **burn-block height**, anchoring the agent's time bounds to Bitcoin. `revoke` flips
a flag; the agent's next `record-spend` then aborts with `ERR-REVOKED`.

19 Clarinet unit tests cover budget limits, scope whitelists, owner-only controls,
expiry, the scheduled time-gate, and the revoke hard-stop.

## Repository layout

```
stacks-contracts/   Clarity agent-policy contract + Clarinet/Vitest tests
server/             Express + TypeScript agent backend
  src/services/agentWallet/   keypair, contract-call, policy checker, Bitflow
                              adapter, swap agent, Auto-DCA engine, NL intent
  src/routes/                 auth (wallet sign-in) + agent wallet API
app/                React + Vite cockpit (wallet connect via @stacks/connect)
```

## Quick start

### Contract

```bash
cd stacks-contracts
npm install
clarinet check        # type-check the contract
npm test              # 19 unit tests
```

Deploy to testnet with your Clarinet deployment plan and note the contract id
(`ST<deployer>.agent-policy`).

### Backend

```bash
cd server
npm install --legacy-peer-deps
cp .env.example .env  # set ENCRYPTION_MASTER_KEY, STACKS_CONTRACT, etc.
npm run dev           # http://localhost:3000
```

The server runs in no-database mode by default (in-memory agent store + stateless
auth); set `SUPABASE_URL`/`SUPABASE_KEY` to persist across restarts.

### Frontend

```bash
cd app
npm install --legacy-peer-deps
cp .env.example .env  # set VITE_API_BASE_URL, VITE_STACKS_NETWORK
npm run dev           # http://localhost:5173
```

Connect a Stacks wallet (Leather / Xverse) set to Testnet.

## Tech

- **Clarity** smart contract (Clarinet) — the on-chain policy
- **@stacks/transactions**, **@stacks/network**, **Hiro API** — agent backend
- **@stacks/connect** (Leather / Xverse) — wallet connect
- **Bitflow** — Stacks AMM for STX↔sBTC swaps
- **React + Vite + Tailwind** — the cockpit UI

## License

ISC
