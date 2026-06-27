import { Router, Request, Response } from "express";
import authRouter from "./auth";
import agentWalletRouter from "./agentWallet";

const router = Router();

// Stackpilot's surface is intentionally small: wallet sign-in (auth) and the
// autonomous agent wallet (policy + intent + Auto-DCA). Legacy product routes from
// the base project (tasks, events, points, bridge, chat, etc.) have been removed.
router.use("/auth", authRouter);
router.use(agentWalletRouter);

router.get("/info", (_req: Request, res: Response) => {
  res.json({
    name: "Stackpilot Express Server",
    version: "1.0.0",
    description: "Autonomous AI trading agent for Stacks, bounded by an on-chain Clarity policy.",
    timestamp: new Date().toISOString(),
    endpoints: {
      auth: ["GET /api/auth/nonce", "POST /api/auth/login", "GET /api/auth/verify", "POST /api/auth/logout"],
      agent: [
        "POST /api/agent/wallet/init",
        "GET /api/agent/wallet",
        "GET /api/agent/policy",
        "POST /api/agent/policy/create-call",
        "POST /api/agent/policy/bind",
        "POST /api/agent/policy/pause-call",
        "POST /api/agent/policy/resume-call",
        "POST /api/agent/policy/revoke-call",
        "POST /api/agent/intent",
        "POST /api/agent/swap",
        "POST /api/agent/dca/start",
        "POST /api/agent/dca/stop",
        "GET /api/agent/dca/status",
        "GET /api/agent/alerts",
      ],
    },
    blockchain: "Stacks",
  });
});

router.get("/status", (_req: Request, res: Response) => {
  res.json({
    status: "running",
    uptime: process.uptime(),
    memory: process.memoryUsage(),
    environment: process.env.NODE_ENV || "development",
    blockchain: "Stacks Testnet",
  });
});

export default router;
