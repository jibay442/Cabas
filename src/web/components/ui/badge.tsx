import { cva, type VariantProps } from "class-variance-authority";
import * as React from "react";
import { cn } from "../../lib/utils.ts";

const badgeVariants = cva(
  "inline-flex items-center justify-center rounded-md border px-2 py-0.5 text-xs font-medium w-fit whitespace-nowrap shrink-0 [&>svg]:size-3 gap-1",
  {
    variants: {
      variant: {
        default: "border-transparent bg-primary text-primary-foreground",
        secondary: "border-transparent bg-secondary text-secondary-foreground",
        destructive: "border-transparent bg-destructive/15 text-destructive",
        success: "border-transparent bg-success/15 text-success",
        warning: "border-transparent bg-warning/20 text-foreground",
        outline: "text-foreground",
      },
    },
    defaultVariants: { variant: "default" },
  },
);

export function Badge({ className, variant, ...props }: React.ComponentProps<"span"> & VariantProps<typeof badgeVariants>) {
  return <span data-slot="badge" className={cn(badgeVariants({ variant }), className)} {...props} />;
}

/** Pastille à point coloré, comme les étiquettes d'url-aveliis */
export function DotBadge({ color, children, className }: { color: string; children: React.ReactNode; className?: string }) {
  return (
    <span className={cn("bg-card inline-flex items-center gap-1.5 rounded-full border px-2 py-0.5 text-xs font-medium whitespace-nowrap", className)}>
      <span className="size-1.5 rounded-full" style={{ backgroundColor: color }} aria-hidden />
      {children}
    </span>
  );
}
