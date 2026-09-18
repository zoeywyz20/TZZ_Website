import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // This production host falls back to WASM SWC; its TypeScript CLI output is
  // truncated during Next builds, while the compiler API completes normally.
  experimental: {
    useTypeScriptCli: false,
  },
};

export default nextConfig;
