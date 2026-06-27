import type { EncryptedData } from "../encryptionService.js";

/**
 * Persisted record of an agent wallet. The secret key is stored only in its
 * encrypted form — the plaintext never touches disk or logs. One agent wallet
 * is derived per owner and bound to one on-chain Clarity policy.
 */
export interface AgentWalletRecord {
  /** Stacks address of the agent wallet (derived from its private key, testnet). */
  agentAddress: string;
  /** Owner (user) Stacks address that controls this agent via the on-chain policy. */
  ownerAddress: string;
  /**
   * On-chain Clarity policy id (uint, stored as decimal string) this wallet acts
   * under. Null until the owner creates a policy and binds it.
   */
  policyId: string | null;
  /**
   * Legacy field retained for store/route compatibility. On Stacks there is no
   * capability object — the agent principal is stored inside the policy and `revoked`
   * is the hard stop. Kept nullable; treated as "bound" once policyId is set.
   */
  capabilityId: string | null;
  /** AES-256-GCM encrypted Stacks private key (hex). */
  encryptedSecretKey: EncryptedData;
  createdAt: string;
}

/** Result of generating a fresh agent wallet, returned to the caller in memory. */
export interface GeneratedAgentWallet {
  agentAddress: string;
  encryptedSecretKey: EncryptedData;
}

/** Action types mirrored from the Clarity policy events. */
export enum AgentActionType {
  Swap = 0,
  LimitOrder = 1,
  Cancel = 2,
  ClaimFill = 3,
}

/** Status codes mirrored from the Clarity policy. */
export enum AgentActionStatus {
  Executed = 0,
  Failed = 1,
  Cancelled = 2,
}
