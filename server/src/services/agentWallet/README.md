# Autonomous Agent Wallet

An on-chain–constrained agent that executes Bitflow swaps on Stacks **without
per-action human approval**, inside limits the owner sets once in a Clarity policy
contract. The headline behavior is Auto-DCA — recurringly accumulating sBTC (Bitcoin).

## Why it's safe

The agent holds its own Stacks wallet and signs its own contract calls. The hard
constraint lives in the `agent-policy.clar` Clarity contract: every spend goes through
`record-spend`, which re-validates budget, asset scope, protocol scope, expiry, and a
`revoked` flag and aborts on any violation. Clarity serializes contract calls, so the
budget accounting is race-free natively. A compromised server key still cannot
overspend, trade off-whitelist, or act after the owner revokes.

## Flow

```
owner ── create-policy ──► agent-policy.clar  (budget, whitelist, expiry, agent principal)
                                  ▲
agent ── record-spend ────────────┘   (re-checks every constraint, aborts on violation)
       └─ Bitflow swap (STX → sBTC)
owner ── revoke ──────────────► sets revoked = true → agent's next record-spend aborts (ERR-REVOKED)
```

The agent pipeline (`swapAgent.ts`): off-chain pre-flight against the live policy →
soft budget allocation → Bitflow quote → the authoritative on-chain `record-spend`
(time-gated `record-spend-after` for scheduled/DCA runs) → Bitflow swap.

## Files

| File | Responsibility |
| --- | --- |
| `stacksConfig.ts` | Network, contract id, asset symbols, decimals, Hiro API |
| `keypair.ts` | Agent Stacks keypair, encrypted at rest (AES-256-GCM) |
| `contractCall.ts` | Sign + broadcast Clarity contract calls with the agent key |
| `policyChecker.ts` | Read the on-chain policy via Hiro call-read-only; off-chain pre-flight |
| `budgetTracker.ts` | Soft budget allocation for in-flight actions |
| `bitflowAdapter.ts` | Bitflow swap quote/route (SDK-ready) |
| `swapAgent.ts` | The guarded swap pipeline |
| `autoDca.ts` | Recurring Auto-DCA engine (re-validates each run) |
| `owner/*` | Owner-signed Clarity call descriptors (create / pause / resume / revoke) |
| `tradeIntent*` | Natural-language → structured, policy-checked intent |

## Setup

The Clarity contract lives in `stacks-contracts/contracts/agent-policy.clar`.

1. Deploy it to testnet (Clarinet deployment plan) and note the contract id.
2. In `server/.env` set `STACKS_CONTRACT=ST<deployer>.agent-policy`,
   `ENCRYPTION_MASTER_KEY`, and (optionally) `AGENT_IMPORT_KEY` for a known agent.

## Demo script

1. Owner creates a policy: budget, Bitflow only, STX + sBTC, ~144-block expiry.
2. "DCA 5 STX into sBTC every hour" → parsed → validated → Auto-DCA armed.
3. "Swap 10 STX to sBTC" → validated → `record-spend` on-chain → Bitflow swap → receipt.
4. Owner revokes → `policy-revoked` event.
5. The agent's next swap **aborts on-chain** (ERR-REVOKED) → UI shows "Agent revoked".
