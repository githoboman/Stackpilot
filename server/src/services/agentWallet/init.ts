import { getAgentKeypairService } from "./keypair.js";
import { getAgentWalletStore } from "./store.js";
import type { AgentWalletRecord } from "./types.js";

/**
 * Agent wallet lifecycle: derive a server-controlled wallet for an owner, persist
 * it encrypted, and bind it to the on-chain policy + capability once those exist.
 *
 * The agent wallet is deliberately NOT the user's connected wallet — it's a
 * separate Ed25519 wallet the backend controls, constrained on-chain by the policy.
 */
export class AgentWalletInitializer {
  /**
   * Return the owner's existing agent wallet, or create+persist a fresh one.
   * Idempotent per owner so repeated init calls don't spawn duplicate wallets.
   */
  async getOrCreate(ownerAddress: string): Promise<AgentWalletRecord> {
    const store = getAgentWalletStore();
    const existing = await store.getByOwner(ownerAddress);
    if (existing) return existing;

    // If an existing agent key is provided via env (a testnet agent provisioned
    // out-of-band), adopt it so the server acts as that exact agent address.
    // Otherwise generate a fresh server-controlled wallet.
    const importKey = process.env.AGENT_IMPORT_KEY?.trim();
    const { agentAddress, encryptedSecretKey } = importKey
      ? getAgentKeypairService().fromHex(importKey)
      : getAgentKeypairService().generate();

    // Optionally pre-bind an already-created policy for this agent, so a known
    // testnet agent comes up bound on first init.
    const policyId = importKey ? (process.env.AGENT_IMPORT_POLICY_ID?.trim() || null) : null;

    const record: AgentWalletRecord = {
      agentAddress,
      ownerAddress,
      policyId,
      // No capability object on Stacks — the agent principal lives in the policy.
      capabilityId: null,
      encryptedSecretKey,
      createdAt: new Date().toISOString(),
    };

    await store.save(record);
    return record;
  }

  /**
   * Bind a created Clarity policy id to the owner's agent wallet. Called after the
   * owner's create-policy transaction settles and the policy id is known. There is
   * no capability object on Stacks, so only the policy id is recorded.
   */
  async bindToPolicy(agentAddress: string, policyId: string): Promise<AgentWalletRecord> {
    const store = getAgentWalletStore();
    await store.bindPolicy(agentAddress, policyId);
    const updated = await store.getByAgentAddress(agentAddress);
    if (!updated) throw new Error(`Agent wallet ${agentAddress} vanished after bind`);
    return updated;
  }

  /**
   * Resolve the active agent wallet for an owner, asserting it's bound to a policy.
   * The execution engine calls this before building any agent contract call.
   */
  async requireBoundWallet(ownerAddress: string): Promise<AgentWalletRecord> {
    const wallet = await getAgentWalletStore().getByOwner(ownerAddress);
    if (!wallet) {
      throw new Error(`No agent wallet for owner ${ownerAddress}. Initialize one first.`);
    }
    if (!wallet.policyId) {
      throw new Error(
        `Agent wallet ${wallet.agentAddress} is not bound to a policy. ` +
          `Owner must create a policy before the agent can act.`,
      );
    }
    return wallet;
  }
}

let instance: AgentWalletInitializer | null = null;

export function getAgentWalletInitializer(): AgentWalletInitializer {
  if (!instance) instance = new AgentWalletInitializer();
  return instance;
}
