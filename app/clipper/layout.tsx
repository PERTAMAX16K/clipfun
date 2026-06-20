"use client";

import { AuthGate } from "@/components/auth-gate";
import type { ReactNode } from "react";

export default function ClipperLayout({ children }: { children: ReactNode }) {
  return <AuthGate clipperOnly>{children}</AuthGate>;
}
