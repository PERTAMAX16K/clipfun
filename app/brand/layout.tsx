"use client";

import { AuthGate } from "@/components/auth-gate";
import type { ReactNode } from "react";

export default function BrandLayout({ children }: { children: ReactNode }) {
  return <AuthGate brandOnly>{children}</AuthGate>;
}
