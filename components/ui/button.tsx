import { Slot } from "@radix-ui/react-slot";
import { cva, type VariantProps } from "class-variance-authority";
import type { ButtonHTMLAttributes } from "react";
import { cn } from "@/lib/utils";

const buttonVariants = cva(
  "inline-flex h-11 items-center justify-center gap-2 border-2 border-ink px-5 text-xs font-black uppercase tracking-[0.08em] transition-all disabled:cursor-not-allowed disabled:opacity-50 active:translate-x-[2px] active:translate-y-[2px]",
  {
    variants: {
      variant: {
        primary:
          "bg-lime text-ink shadow-brutal hover:-translate-x-0.5 hover:-translate-y-0.5 hover:shadow-brutal-lg",
        blue: "bg-blue text-white shadow-brutal hover:-translate-x-0.5 hover:-translate-y-0.5",
        orange:
          "bg-orange text-white shadow-brutal hover:-translate-x-0.5 hover:-translate-y-0.5",
        outline: "bg-cream text-ink shadow-brutal hover:bg-white",
        ghost: "border-transparent bg-transparent shadow-none hover:bg-ink/5",
        black: "bg-ink text-white shadow-brutal",
      },
      size: {
        default: "h-11 px-5",
        sm: "h-9 px-3 text-[10px]",
        lg: "h-14 px-7 text-sm",
        icon: "h-10 w-10 p-0",
      },
    },
    defaultVariants: {
      variant: "primary",
      size: "default",
    },
  },
);

interface ButtonProps
  extends ButtonHTMLAttributes<HTMLButtonElement>,
    VariantProps<typeof buttonVariants> {
  asChild?: boolean;
}

export function Button({
  className,
  variant,
  size,
  asChild,
  ...props
}: ButtonProps) {
  const Comp = asChild ? Slot : "button";
  return (
    <Comp
      className={cn(buttonVariants({ variant, size }), className)}
      {...props}
    />
  );
}
