import AgentControls from "@/components/agent/AgentControls";

/**
 * Agent Policy page — the Autonomous Agent Wallet control panel. Rendered inside the
 * cockpit shell (sidebar + header). AgentControls provides its own header + the
 * two-column cockpit layout, so this page just hosts it on the dark cockpit canvas.
 */
export default function Agent() {
  return (
    <div className="bg-cockpit min-h-full">
      <AgentControls />
    </div>
  );
}
