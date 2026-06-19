import type { HTMLAttributes } from "react";
import { cn } from "@/lib/utils";

const tones = {
  blue: "bg-blue text-white",
  lime: "bg-lime text-ink",
  orange: "bg-orange text-white",
  black: "bg-ink text-white",
  cream: "bg-cream text-ink",
  red: "bg-red-500 text-white",
};

export function Badge({
  className,
  tone = "black",
  ...props
}: HTMLAttributes<HTMLSpanElement> & { tone?: keyof typeof tones }) {
  return (
    <span
      className={cn(
        "inline-flex items-center border border-ink px-2.5 py-1 text-[10px] font-black uppercase tracking-[0.08em]",
        tones[tone],
        className,
      )}
      {...props}
    />
  );
}
