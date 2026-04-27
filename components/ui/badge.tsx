import type { HTMLAttributes } from "react";
import { cva, type VariantProps } from "class-variance-authority";

import { cn } from "@/lib/utils";

const badgeVariants = cva("inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-semibold capitalize transition-colors", {
  variants: {
    variant: {
      default: "border-primary/25 bg-primary/10 text-primary",
      secondary: "border-white/10 bg-secondary text-secondary-foreground",
      success: "border-emerald-400/30 bg-emerald-400/10 text-emerald-200",
      warning: "border-amber-400/30 bg-amber-400/10 text-amber-200",
      destructive: "border-destructive/30 bg-destructive/10 text-destructive-foreground",
    },
  },
  defaultVariants: {
    variant: "default",
  },
});

export interface BadgeProps extends HTMLAttributes<HTMLDivElement>, VariantProps<typeof badgeVariants> {}

export function Badge({ className, variant, ...props }: BadgeProps) {
  return <div className={cn(badgeVariants({ variant }), className)} {...props} />;
}
