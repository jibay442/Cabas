import { ShoppingBasket } from "lucide-react";
import { cn } from "../lib/utils.ts";

export function Logo({ className }: { className?: string }) {
  return (
    <span className={cn("bg-primary text-primary-foreground inline-flex size-7 items-center justify-center rounded-md", className)} aria-hidden>
      <ShoppingBasket className="size-4" />
    </span>
  );
}
