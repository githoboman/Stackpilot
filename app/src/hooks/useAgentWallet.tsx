import {
  useState,
  useCallback,
  useEffect,
  useRef,
  createContext,
  useContext,
  type ReactNode,
} from "react";
import {
  useCurrentAccount,
  useSignAndExecuteTransaction,
  type CallContractInput,
} from "@/lib/stacksWallet";

const API_BASE = import.meta.env.VITE_API_BASE_URL || "http://localhost:3000";
const HIRO_API =
  import.meta.env.VITE_HIRO_API ||
  ((import.meta.env.VITE_STACKS_NETWORK || "testnet") === "mainnet"
    ? "https://api.hiro.so"
    : "https://api.testnet.hiro.so");

export interface AgentWalletStatus {
  agentAddress: string;
  policyId: string | null;
  bound: boolean;
}

export interface AgentAlert {
  id: string;
  level: "info" | "warning" | "error" | "success";
  title: string;
  message: string;
  timestamp: number;
  meta?: Record<string, unknown>;
}

export interface CreatePolicyForm {
  /** Budget cap in micro-STX, as a string to avoid bigint JSON issues. */
  budgetCap: string;
  /** Allowed asset symbols, e.g. ["STX","sBTC"]. */
  allowedAssets: string[];
  /** Expiry as a number of burn blocks from now (default 144 ~= 24h). */
  expiryBlocks: number;
}

export interface TradeIntent {
  action: string;
  tokenIn?: string;
  tokenOut?: string;
  amount?: number;
  percentage?: number;
  price?: number;
  condition?: "below" | "above";
  schedule?: string;
  interval?: string;
  summary: string;
}

export interface IntentResult {
  ok: boolean;
  intent: TradeIntent;
  message: string;
  outcome?: { ok: boolean; txid?: string; reason?: string; expectedOut?: string };
  armed?: "scheduled" | "dca";
}

/** Live on-chain Clarity policy state (bigints as strings). */
export interface PolicyState {
  policyId: string;
  budgetCap: string;
  budgetSpent: string;
  budgetRemaining: string;
  usedPercent: number;
  allowedAssets: string[];
  allowedProtocols: string[];
  allowedActions: number[];
  expiryBurnHeight: string;
  currentBurnHeight: string | null;
  isActive: boolean;
  revoked: boolean;
}

/** Auto-DCA run + status, mirrors the server DcaState. */
export interface DcaRun {
  n: number;
  at: number;
  ok: boolean;
  txid?: string;
  reason?: string;
}
export interface DcaState {
  active: boolean;
  runs: number;
  maxRuns: number;
  intervalMs: number;
  nextRunAt: number | null;
  history: DcaRun[];
  tokenIn: string;
  tokenOut: string;
  amount: string;
  stoppedReason?: string;
}

interface ClarityCall {
  contract: string;
  contractAddress: string;
  contractName: string;
  functionName: string;
  functionArgsHex: string[];
}

type Busy =
  | "idle"
  | "init"
  | "creating"
  | "binding"
  | "pausing"
  | "resuming"
  | "revoking"
  | "thinking"
  | "dca";

/**
 * Drives the Agent Controls panel on Stacks. Owner-signing actions fetch a Clarity
 * call descriptor from the backend, sign it with the connected Stacks wallet
 * (@stacks/connect), and — for policy creation — read the new policy id from the
 * contract nonce and post it back so the server binds it to the agent wallet.
 */
function useAgentWalletState() {
  const account = useCurrentAccount();
  const { mutateAsync: callContract } = useSignAndExecuteTransaction();

  const [status, setStatus] = useState<AgentWalletStatus | null>(null);
  const [policy, setPolicy] = useState<PolicyState | null>(null);
  const [dca, setDca] = useState<DcaState | null>(null);
  const [alerts, setAlerts] = useState<AgentAlert[]>([]);
  const [busy, setBusy] = useState<Busy>("idle");
  const [error, setError] = useState<string | null>(null);
  const alertPoll = useRef<ReturnType<typeof setInterval> | null>(null);

  const api = useCallback(
    async (path: string, body?: unknown) => {
      const headers: Record<string, string> = {};
      if (body) headers["Content-Type"] = "application/json";
      // Local-demo bypass: send the connected wallet as x-dev-wallet so the server's
      // dev auth path accepts it without a Supabase token.
      if (import.meta.env.VITE_AGENT_DEV_AUTH === "true" && account?.address) {
        headers["x-dev-wallet"] = account.address;
      }
      const res = await fetch(`${API_BASE}/api/agent${path}`, {
        method: body ? "POST" : "GET",
        credentials: "include",
        headers: Object.keys(headers).length ? headers : undefined,
        body: body ? JSON.stringify(body) : undefined,
      });
      const json = await res.json();
      if (!res.ok || json.status === false) {
        throw new Error(json?.message || `Request to ${path} failed`);
      }
      return json.data;
    },
    [account?.address],
  );

  // ── Reads ──────────────────────────────────────────────────────────

  const refresh = useCallback(async () => {
    if (!account?.address) return;
    try {
      const data = (await api("/wallet")) as AgentWalletStatus | null;
      setStatus(data);
    } catch (e: any) {
      setError(e?.message ?? "Failed to load agent wallet");
    }
  }, [account?.address, api]);

  const refreshAlerts = useCallback(async () => {
    if (!account?.address) return;
    try {
      setAlerts((await api("/alerts")) as AgentAlert[]);
    } catch {
      /* best-effort */
    }
  }, [account?.address, api]);

  const refreshPolicy = useCallback(async () => {
    if (!account?.address) return;
    try {
      setPolicy((await api("/policy")) as PolicyState | null);
    } catch {
      /* best-effort */
    }
  }, [account?.address, api]);

  const refreshDca = useCallback(async () => {
    if (!account?.address) return;
    try {
      setDca((await api("/dca/status")) as DcaState | null);
    } catch {
      /* best-effort */
    }
  }, [account?.address, api]);

  useEffect(() => {
    refresh();
  }, [refresh]);

  useEffect(() => {
    if (status?.bound) {
      refreshPolicy();
      refreshDca();
    } else {
      setPolicy(null);
    }
  }, [status?.bound, refreshPolicy, refreshDca]);

  useEffect(() => {
    if (!account?.address) return;
    refreshAlerts();
    alertPoll.current = setInterval(() => {
      refreshAlerts();
      refreshDca();
    }, 8000);
    return () => {
      if (alertPoll.current) clearInterval(alertPoll.current);
    };
  }, [account?.address, refreshAlerts, refreshDca]);

  // ── Helpers ────────────────────────────────────────────────────────

  /** Sign a server-built Clarity call descriptor with the owner wallet. */
  const signCall = useCallback(
    async (call: ClarityCall): Promise<{ txid: string }> => {
      const input: CallContractInput = {
        contract: call.contract,
        functionName: call.functionName,
        functionArgs: call.functionArgsHex,
      };
      return callContract(input);
    },
    [callContract],
  );

  /** Read the agent-policy contract's current nonce (the latest policy id). */
  const readContractNonce = useCallback(
    async (call: ClarityCall): Promise<string | null> => {
      try {
        const res = await fetch(
          `${HIRO_API}/v2/contracts/call-read/${call.contractAddress}/${call.contractName}/get-nonce`,
          {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ sender: call.contractAddress, arguments: [] }),
          },
        );
        const j: any = await res.json();
        if (!j?.okay || !j?.result) return null;
        // get-nonce returns a uint; Clarity serialize = 0x01 + 16-byte big-endian.
        const hex = j.result.replace(/^0x/, "");
        const valueHex = hex.slice(-32);
        return BigInt("0x" + valueHex).toString();
      } catch {
        return null;
      }
    },
    [],
  );

  // ── Actions ────────────────────────────────────────────────────────

  const initWallet = useCallback(async () => {
    setBusy("init");
    setError(null);
    try {
      const data = (await api("/wallet/init", {})) as AgentWalletStatus;
      setStatus(data);
      return data;
    } catch (e: any) {
      setError(e?.message ?? "init failed");
      throw e;
    } finally {
      setBusy("idle");
    }
  }, [api]);

  /** Create a policy: fetch call -> owner signs -> read nonce -> bind. */
  const createPolicy = useCallback(
    async (form: CreatePolicyForm) => {
      setBusy("creating");
      setError(null);
      try {
        const { call } = (await api("/policy/create-call", {
          budgetCap: form.budgetCap,
          allowedAssets: form.allowedAssets,
          expiryBlocks: form.expiryBlocks,
        })) as { call: ClarityCall };

        await signCall(call);

        // Poll the contract nonce until it advances (the new policy id).
        setBusy("binding");
        let policyId: string | null = null;
        for (let i = 0; i < 20 && !policyId; i++) {
          await new Promise((r) => setTimeout(r, 3000));
          const n = await readContractNonce(call);
          if (n && n !== "0") {
            policyId = n;
            break;
          }
        }
        if (!policyId || policyId === "0") {
          throw new Error("Policy created, but its id wasn't confirmed yet. Refresh in a moment.");
        }
        await api("/policy/bind", { policyId });
        await refresh();
      } catch (e: any) {
        setError(e?.message ?? "create policy failed");
        throw e;
      } finally {
        setBusy("idle");
      }
    },
    [api, signCall, readContractNonce, refresh],
  );

  const pause = useCallback(async () => {
    setBusy("pausing");
    setError(null);
    try {
      const { call } = (await api("/policy/pause-call", {})) as { call: ClarityCall };
      await signCall(call);
      await refreshPolicy();
    } catch (e: any) {
      setError(e?.message ?? "pause failed");
      throw e;
    } finally {
      setBusy("idle");
    }
  }, [api, signCall, refreshPolicy]);

  const resume = useCallback(async () => {
    setBusy("resuming");
    setError(null);
    try {
      const { call } = (await api("/policy/resume-call", {})) as { call: ClarityCall };
      await signCall(call);
      await refreshPolicy();
    } catch (e: any) {
      setError(e?.message ?? "resume failed");
      throw e;
    } finally {
      setBusy("idle");
    }
  }, [api, signCall, refreshPolicy]);

  /** Revoke: server stops DCA + clears state, returns the revoke call to sign. */
  const revoke = useCallback(async () => {
    setBusy("revoking");
    setError(null);
    try {
      const { call } = (await api("/policy/revoke-call", {})) as { call: ClarityCall };
      await signCall(call);
      await refresh();
      await refreshPolicy();
      await refreshAlerts();
      await refreshDca();
    } catch (e: any) {
      setError(e?.message ?? "revoke failed");
      throw e;
    } finally {
      setBusy("idle");
    }
  }, [api, signCall, refresh, refreshPolicy, refreshAlerts, refreshDca]);

  /** Natural-language instruction (swap / DCA / etc.). */
  const sendIntent = useCallback(
    async (message: string): Promise<IntentResult> => {
      setBusy("thinking");
      setError(null);
      try {
        const data = (await api("/intent", { message })) as IntentResult;
        await refreshAlerts();
        await refreshPolicy();
        await refreshDca();
        return data;
      } catch (e: any) {
        setError(e?.message ?? "intent failed");
        throw e;
      } finally {
        setBusy("idle");
      }
    },
    [api, refreshAlerts, refreshPolicy, refreshDca],
  );

  /** Start Auto-DCA (headline feature). amount in WHOLE tokens. */
  const startDca = useCallback(
    async (params: { amount: number; intervalMs: number; tokenIn?: string; tokenOut?: string; maxRuns?: number }) => {
      setBusy("dca");
      setError(null);
      try {
        const state = (await api("/dca/start", params)) as DcaState;
        setDca(state);
        await refreshAlerts();
        return state;
      } catch (e: any) {
        setError(e?.message ?? "start DCA failed");
        throw e;
      } finally {
        setBusy("idle");
      }
    },
    [api, refreshAlerts],
  );

  const stopDca = useCallback(async () => {
    try {
      await api("/dca/stop", {});
      await refreshDca();
    } catch (e: any) {
      setError(e?.message ?? "stop DCA failed");
    }
  }, [api, refreshDca]);

  return {
    account,
    status,
    policy,
    dca,
    alerts,
    busy,
    error,
    initWallet,
    createPolicy,
    pause,
    resume,
    revoke,
    sendIntent,
    startDca,
    stopDca,
    refresh,
    refreshAlerts,
    refreshPolicy,
    refreshDca,
  };
}

// ── Shared state via context ───────────────────────────────────────────
type AgentWalletValue = ReturnType<typeof useAgentWalletState>;
const AgentWalletContext = createContext<AgentWalletValue | null>(null);

export function AgentWalletProvider({ children }: { children: ReactNode }) {
  const value = useAgentWalletState();
  return <AgentWalletContext.Provider value={value}>{children}</AgentWalletContext.Provider>;
}

export function useAgentWallet(): AgentWalletValue {
  const ctx = useContext(AgentWalletContext);
  // eslint-disable-next-line react-hooks/rules-of-hooks
  return ctx ?? useAgentWalletState();
}
