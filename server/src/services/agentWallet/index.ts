/**
 * Autonomous Agent Wallet — public surface (Stackpilot / Stacks).
 *
 * The agent acts under an on-chain Clarity AgentPolicy that enforces budget,
 * protocol whitelist, asset scope, action scope, expiry and pause/revoke. The server
 * holds a Stacks agent key and signs policy-guarded contract calls (record-spend);
 * the Clarity contract is the authoritative constraint layer, so the key alone cannot
 * exceed its mandate or act after revoke. See README.md for architecture.
 */

// Wallet lifecycle
export { getAgentWalletInitializer, AgentWalletInitializer } from "./init.js";
export { getAgentKeypairService } from "./keypair.js";
export { getAgentWalletStore } from "./store.js";

// Execution engine
export { getPolicyChecker } from "./policyChecker.js";
export { getBudgetTracker } from "./budgetTracker.js";
export { callPolicy, recordSpendArgs, recordSpendAfterArgs } from "./contractCall.js";

// Bitflow + agents
export { quoteSwap } from "./bitflowAdapter.js";
export { getSwapAgent } from "./swapAgent.js";

// Strategies
export { executePercentageSwap, scheduleSwap, estimateBurnHeightAt } from "./strategies.js";

// Auto-DCA (headline feature)
export { startAutoDca, stopAutoDca, dcaStatus } from "./autoDca.js";
export type { DcaConfig, DcaState, DcaRun } from "./autoDca.js";

// Owner controls (build Clarity call descriptors for the owner wallet to sign)
export { buildCreatePolicyCall } from "./owner/policyCreator.js";
export type { ClarityCall, CreatePolicyInput } from "./owner/policyCreator.js";
export { buildPauseCall, buildResumeCall } from "./owner/pauseResume.js";
export { buildRevokeCall, clearLocalState } from "./owner/revocation.js";

// NL intent
export { getTradeIntentService } from "./tradeIntentService.js";

// Observability
export { getAgentAlerts } from "./alerts.js";

// Types / config
export * from "./types.js";
export {
  NETWORK,
  CONTRACT_ADDRESS,
  CONTRACT_NAME,
  HIRO_API,
  PROTOCOL_ID,
  ASSET_SYMBOLS,
  decimalsFor,
  toMicro,
  toWholeTokens,
  canonicalAsset,
} from "./stacksConfig.js";
