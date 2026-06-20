import type { NextConfig } from "next";
import path from "path";

const emptyStub = path.resolve(__dirname, "lib/stubs/empty.mjs");

const nextConfig: NextConfig = {
  reactStrictMode: true,
  outputFileTracingRoot: process.cwd(),
};

export default nextConfig;
