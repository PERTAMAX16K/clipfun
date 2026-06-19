"use client";

import { X } from "lucide-react";
import type { ReactNode } from "react";
import { Button } from "@/components/ui/button";

export function Modal({
  open,
  onClose,
  title,
  eyebrow,
  children,
}: {
  open: boolean;
  onClose: () => void;
  title: string;
  eyebrow?: string;
  children: ReactNode;
}) {
  if (!open) return null;
  return (
    <div className="fixed inset-0 z-50 grid place-items-center bg-ink/70 p-4">
      <button
        aria-label="Close modal backdrop"
        className="absolute inset-0"
        onClick={onClose}
      />
      <section className="relative z-10 max-h-[90vh] w-full max-w-lg overflow-y-auto border-2 border-ink bg-cream shadow-brutal-xl">
        <header className="flex items-start justify-between border-b-2 border-ink p-5">
          <div>
            {eyebrow && (
              <p className="mb-1 text-[10px] font-black uppercase tracking-[0.16em] text-blue">
                {eyebrow}
              </p>
            )}
            <h2 className="font-display text-3xl uppercase leading-none">
              {title}
            </h2>
          </div>
          <Button
            aria-label="Close"
            variant="ghost"
            size="icon"
            onClick={onClose}
          >
            <X size={20} />
          </Button>
        </header>
        <div className="p-5">{children}</div>
      </section>
    </div>
  );
}
