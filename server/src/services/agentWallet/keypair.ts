import { randomPrivateKey, getAddressFromPrivateKey } from "@stacks/transactions";
import { getEncryptionService } from "../encryptionService.js";
import type { EncryptedData } from "../encryptionService.js";
import type { GeneratedAgentWallet } from "./types.js";
import { getNetworkName } from "./stacksConfig.js";

/**
 * Custody for the server-managed agent keypair. For the hackathon (testnet only)
 * the agent signs Clarity contract calls with a backend-held Stacks key; the
 * on-chain agent-policy is the real constraint layer, so a compromised key still
 * cannot exceed budget/scope or act after revoke.
 *
 * The plaintext secret key exists only transiently inside secret() and generate().
 * At rest it is always the AES-256-GCM EncryptedData produced by EncryptionService.
 */
export class AgentKeypairService {
  private net(): "testnet" | "mainnet" {
    return getNetworkName();
  }

  /**
   * Generate a brand-new agent wallet. Returns the Stacks address plus the
   * encrypted secret key for the caller to persist. The plaintext is discarded here.
   */
  generate(): GeneratedAgentWallet {
    const sk = randomPrivateKey(); // hex string
    const agentAddress = getAddressFromPrivateKey(sk, this.net());
    const encryptedSecretKey = getEncryptionService().encrypt(sk);
    return { agentAddress, encryptedSecretKey };
  }

  /**
   * Import an existing agent wallet from its hex secret key (e.g. an agent
   * provisioned out-of-band on testnet). Encrypts the key for storage the same way
   * generate() does, so the rest of the engine is agnostic to its origin.
   */
  fromHex(hexSecretKey: string): GeneratedAgentWallet {
    const sk = hexSecretKey.trim();
    const agentAddress = getAddressFromPrivateKey(sk, this.net());
    const encryptedSecretKey = getEncryptionService().encrypt(sk);
    return { agentAddress, encryptedSecretKey };
  }

  /** Returns the raw hex secret key for signing (used by contractCall.ts). */
  secret(encryptedSecretKey: EncryptedData): string {
    return getEncryptionService().decrypt(encryptedSecretKey);
  }

  /** Derive the Stacks address for an encrypted key without exposing the secret. */
  addressOf(encryptedSecretKey: EncryptedData): string {
    return getAddressFromPrivateKey(this.secret(encryptedSecretKey), this.net());
  }
}

let instance: AgentKeypairService | null = null;

export function getAgentKeypairService(): AgentKeypairService {
  if (!instance) instance = new AgentKeypairService();
  return instance;
}
