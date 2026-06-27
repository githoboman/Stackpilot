import { createHash } from "crypto";
import { publicKeyFromSignatureRsv, getAddressFromPublicKey } from "@stacks/transactions";

/**
 * Server-side verification of a Stacks wallet message signature (Leather / Xverse
 * via @stacks/connect `signMessage`). Verifies a SIP-018 message signature
 * path. The wallet signs a SIP-018 "structured" message hash; here we reproduce the
 * hash, recover the public key from the RSV signature, derive the Stacks address, and
 * compare it to the claimed wallet.
 */

const CHAIN_PREFIX = "\x17Stacks Signed Message:\n";

function sha256(data: Buffer): Buffer {
  return createHash("sha256").update(data).digest();
}

/** Varint-length-prefix a byte length, as the Stacks message hashing expects. */
function encodeVarint(n: number): Buffer {
  // Stacks uses a compact unsigned int (same as Bitcoin varint) for the length.
  if (n < 0xfd) return Buffer.from([n]);
  if (n <= 0xffff) {
    const b = Buffer.alloc(3);
    b[0] = 0xfd;
    b.writeUInt16LE(n, 1);
    return b;
  }
  const b = Buffer.alloc(5);
  b[0] = 0xfe;
  b.writeUInt32LE(n, 1);
  return b;
}

/** Reproduce the hash a Stacks wallet signs for a plain string message. */
export function hashStacksMessage(message: string): Buffer {
  const msg = Buffer.from(message, "utf8");
  const prefix = Buffer.from(CHAIN_PREFIX, "binary");
  const payload = Buffer.concat([prefix, encodeVarint(msg.length), msg]);
  // Stacks uses a single sha256 of the prefixed payload for message signing.
  return sha256(payload);
}

export type StacksNet = "testnet" | "mainnet";

/**
 * Verify that `signature` (RSV hex) over `message` was produced by the key behind
 * `expectedAddress`. Returns the derived address on success, or null on mismatch.
 */
export function verifyStacksMessage(
  message: string,
  signature: string,
  expectedAddress: string,
  network: StacksNet = "testnet",
): string | null {
  try {
    const hashHex = hashStacksMessage(message).toString("hex");
    const pubKey = publicKeyFromSignatureRsv(hashHex, signature);
    const derived = getAddressFromPublicKey(pubKey, network);
    return derived.toLowerCase() === expectedAddress.toLowerCase() ? derived : null;
  } catch {
    return null;
  }
}
