/**
 * TicketMinter — DISABLED on Stackpilot.
 *
 * The base project minted on-chain NFT "tickets" and sponsored waitlist-point
 * claims via on-chain calls. That on-chain rewards layer has no Stacks equivalent in
 * the Stackpilot MVP, so this is a thin off-chain stub that preserves the public
 * surface its callers (auth, checkin, users, telegram) depend on. Every method is a
 * safe no-op returning neutral data — minting never blocks the off-chain flows, which
 * already treat it as best-effort.
 *
 * The real on-chain path in Stackpilot is the agentWallet service (Clarity policy via
 * contractCall.ts), not this module.
 */

export interface SponsoredClaimResult {
  success: boolean;
  error?: string;
  digest?: string;
  balance?: number;
}

export interface ClaimVerification {
  confirmed: boolean;
  balance?: number;
}

export class TicketMinter {
  private static instance: TicketMinter;

  static getInstance(): TicketMinter {
    if (!TicketMinter.instance) TicketMinter.instance = new TicketMinter();
    return TicketMinter.instance;
  }

  /** No on-chain check-in fee on Stacks. */
  async getCheckinFee(): Promise<number> {
    return 0;
  }

  /** On-chain claim tracking is disabled; defer to off-chain state elsewhere. */
  async hasClaimed(_walletAddress: string): Promise<boolean> {
    return false;
  }

  /** No on-chain points balance to read. */
  async getBalance(_walletAddress: string): Promise<number> {
    return 0;
  }

  /** Minting a check-in ticket is a no-op; returns null (callers treat it as optional). */
  async mintCheckinTicket(_userId: string, _points: number, _date: string): Promise<string | null> {
    return null;
  }

  /** Sponsored waitlist-point claims are disabled on Stackpilot. */
  async sponsoredClaimWaitlistPoints(_walletAddress: string): Promise<SponsoredClaimResult> {
    return { success: true, balance: 0 };
  }

  /** No on-chain digests to verify on Stacks. */
  async verifyClaimByDigest(_digest: string): Promise<ClaimVerification | null> {
    return null;
  }
}

export const getTicketMinter = () => TicketMinter.getInstance();
