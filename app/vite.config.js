import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import path from "path";
import tailwindcss from "@tailwindcss/vite";
import { nodePolyfills } from "vite-plugin-node-polyfills";
export default defineConfig({
    plugins: [
        react(),
        tailwindcss(),
        nodePolyfills({ include: ["buffer", "process"] }),
    ],
    resolve: {
        alias: {
            "@": path.resolve(__dirname, "./src"),
        },
    },
    server: {
        host: true,
        port: 5173,
        allowedHosts: ["localhost", "stackpilot.app", "stackpilot.vercel.app"],
    },
});
