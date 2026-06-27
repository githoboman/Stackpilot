import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import {
  connect as stacksConnect,
  disconnect as stacksDisconnect,
  isConnected as stacksIsConnected,
  getLocalStorage,
  request,
} from "@stacks/connect";

/**
 * Stacks wallet adapter.
 *
 * Stackpilot replaced Sui dapp-kit with @stacks/connect (Leather / Xverse). To avoid
 * editing ~25 call sites, this module re-exports the SAME hook names the app already
 * used (useCurrentAccount, useSignAndExecuteTransaction, etc.) but backed by Stacks.
 * Mount <StacksWalletProvider> once at the root in place of dapp-kit's providers.
 *
 * Account shape mirrors dapp-kit's `{ address }`, so existing `account?.address`
 * reads keep working unchanged.
 */

export interface StacksAccount {
  address: string;
}

type ConnectionStatus = "connected" | "connecting" | "disconnected";

interface WalletState {
  account: StacksAccount | null;
  status: ConnectionStatus;
  connect: () => Promise<StacksAccount | null>;
  disconnect: () => void;
  refresh: () => void;
}

const WalletContext = createContext<WalletState | null>(null);

/** Read the connected testnet/mainnet STX address from @stacks/connect storage. */
function readStxAddress(): string | null {
  try {
    if (!stacksIsConnected()) return null;
    const data = getLocalStorage();
    const stx = (data as any)?.addresses?.stx;
    const addr = Array.isArray(stx) ? stx[0]?.address : undefined;
    return addr || null;
  } catch {
    return null;
  }
}

export function StacksWalletProvider({ children }: { children: ReactNode }) {
  const [account, setAccount] = useState<StacksAccount | null>(() => {
    const a = readStxAddress();
    return a ? { address: a } : null;
  });
  const [status, setStatus] = useState<ConnectionStatus>(
    readStxAddress() ? "connected" : "disconnected",
  );

  const refresh = useCallback(() => {
    const a = readStxAddress();
    setAccount(a ? { address: a } : null);
    setStatus(a ? "connected" : "disconnected");
  }, []);

  const connect = useCallback(async (): Promise<StacksAccount | null> => {
    setStatus("connecting");
    try {
      await stacksConnect(); // opens Leather / Xverse; persists addresses
      const a = readStxAddress();
      setAccount(a ? { address: a } : null);
      setStatus(a ? "connected" : "disconnected");
      return a ? { address: a } : null;
    } catch (err) {
      setStatus(readStxAddress() ? "connected" : "disconnected");
      throw err;
    }
  }, []);

  const disconnect = useCallback(() => {
    try {
      stacksDisconnect();
    } catch {
      /* ignore */
    }
    setAccount(null);
    setStatus("disconnected");
  }, []);

  // Re-sync on focus, in case the wallet connection changed in another tab.
  useEffect(() => {
    const onFocus = () => refresh();
    window.addEventListener("focus", onFocus);
    return () => window.removeEventListener("focus", onFocus);
  }, [refresh]);

  const value = useMemo<WalletState>(
    () => ({ account, status, connect, disconnect, refresh }),
    [account, status, connect, disconnect, refresh],
  );

  return <WalletContext.Provider value={value}>{children}</WalletContext.Provider>;
}

function useWallet(): WalletState {
  const ctx = useContext(WalletContext);
  if (!ctx) {
    throw new Error("useWallet must be used within <StacksWalletProvider>");
  }
  return ctx;
}

// ── dapp-kit-compatible hook surface ────────────────────────────────────

/** dapp-kit parity: the connected account or null. */
export function useCurrentAccount(): StacksAccount | null {
  return useWallet().account;
}

/** dapp-kit parity: `{ connectionStatus }`. */
export function useCurrentWallet(): { connectionStatus: ConnectionStatus; currentWallet: null } {
  const { status } = useWallet();
  return { connectionStatus: status, currentWallet: null };
}

/** dapp-kit parity: `{ mutate, mutateAsync }` to connect. */
export function useConnectWallet() {
  const { connect } = useWallet();
  return {
    mutate: (_args?: unknown, opts?: { onSuccess?: () => void; onError?: (e: unknown) => void }) =>
      connect().then(() => opts?.onSuccess?.()).catch((e) => opts?.onError?.(e)),
    mutateAsync: () => connect(),
    isPending: false,
  };
}

/** dapp-kit parity: `{ mutate }` to disconnect. Accepts dapp-kit-style options. */
export function useDisconnectWallet() {
  const { disconnect } = useWallet();
  const mutate = (_args?: unknown, opts?: { onSuccess?: () => void; onError?: (e: unknown) => void }) => {
    try {
      disconnect();
      opts?.onSuccess?.();
    } catch (e) {
      opts?.onError?.(e);
    }
  };
  return { mutate, mutateAsync: async () => disconnect() };
}

/**
 * dapp-kit parity: sign a personal message. Returns `{ signature }` (RSV hex) like
 * dapp-kit, so AuthProvider's flow is unchanged. Accepts the dapp-kit call shape
 * `{ message }` where message may be a string or Uint8Array.
 */
export function useSignPersonalMessage() {
  const mutateAsync = useCallback(
    async ({ message }: { message: string | Uint8Array }): Promise<{ signature: string }> => {
      const text = typeof message === "string" ? message : new TextDecoder().decode(message);
      const res = (await request("stx_signMessage", { message: text })) as any;
      return { signature: res.signature };
    },
    [],
  );
  return { mutate: mutateAsync, mutateAsync, isPending: false };
}

/**
 * dapp-kit parity: execute a transaction. On Stacks this calls a Clarity contract via
 * `stx_callContract`. The arg shape is Stackpilot-specific: `{ contract, functionName,
 * functionArgs }` (functionArgs are hex-serialized Clarity values from the server).
 * Returns `{ txid }`.
 */
export interface CallContractInput {
  contract: string; // "ST….agent-policy"
  functionName: string;
  functionArgs: string[]; // hex-serialized Clarity values
  postConditionMode?: "allow" | "deny";
}

export function useSignAndExecuteTransaction() {
  const mutateAsync = useCallback(async (input: CallContractInput): Promise<{ txid: string }> => {
    const res = (await request("stx_callContract", {
      contract: input.contract as `${string}.${string}`,
      functionName: input.functionName,
      functionArgs: input.functionArgs,
      postConditionMode: input.postConditionMode ?? "allow",
      network: ((import.meta.env.VITE_STACKS_NETWORK as string) || "testnet") as any,
    })) as any;
    return { txid: res.txid };
  }, []);
  return { mutate: mutateAsync, mutateAsync, isPending: false };
}

/**
 * dapp-kit parity stub: a "Sui client". On Stacks there is no equivalent client used
 * by the app's remaining call sites beyond read helpers, so this returns a minimal
 * object. Direct chain reads go through the backend (Hiro API) instead.
 */
export function useSuiClient(): Record<string, never> {
  return {};
}

/** dapp-kit parity: installed wallets list. @stacks/connect manages its own modal. */
export function useWallets(): never[] {
  return [];
}

/** dapp-kit parity stub: chain read query. Reads go through the backend on Stacks. */
export function useSuiClientQuery(
  _method?: string,
  _params?: unknown,
  _options?: unknown,
): { data: undefined; isLoading: boolean; refetch: () => void } {
  return { data: undefined, isLoading: false, refetch: () => {} };
}

/** dapp-kit parity stub: client context (network name). */
export function useSuiClientContext(): { network: string; selectNetwork: (n: string) => void } {
  return {
    network: (import.meta.env.VITE_STACKS_NETWORK as string) || "testnet",
    selectNetwork: () => {},
  };
}

/**
 * dapp-kit parity: a Connect button. Renders a Stacks connect/disconnect button via
 * @stacks/connect. Accepts (and ignores) dapp-kit's styling props for drop-in use.
 */
export function ConnectButton(props: { className?: string; connectText?: ReactNode }) {
  const { account, status, connect, disconnect } = useWallet();
  const label = account
    ? `${account.address.slice(0, 5)}…${account.address.slice(-4)}`
    : status === "connecting"
    ? "Connecting…"
    : props.connectText ?? "Connect Wallet";
  return (
    <button
      type="button"
      className={props.className}
      onClick={() => (account ? disconnect() : connect().catch(() => {}))}
    >
      {label}
    </button>
  );
}
