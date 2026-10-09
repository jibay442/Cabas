import { Loader2 } from "lucide-react";
import type { ReactNode } from "react";
import { cn } from "../../lib/utils.ts";

export function Spinner({ className }: { className?: string }) {
  return <Loader2 role="status" aria-label="…" className={cn("text-muted-foreground size-5 animate-spin", className)} />;
}

export function PageHeader({ title, description, actions, back }: { title: ReactNode; description?: ReactNode; actions?: ReactNode; back?: ReactNode }) {
  return (
    <div className="mb-6 flex flex-wrap items-end justify-between gap-4">
      <div className="min-w-0">
        {back}
        <h1 className="text-2xl font-semibold tracking-tight">{title}</h1>
        {description && <p className="text-muted-foreground mt-1 text-sm">{description}</p>}
      </div>
      {actions && <div className="flex items-center gap-2">{actions}</div>}
    </div>
  );
}

export function EmptyState({ icon, title, children, className }: { icon: ReactNode; title: string; children?: ReactNode; className?: string }) {
  return (
    <div className={cn("flex flex-col items-center gap-2 px-6 py-14 text-center", className)}>
      <div className="bg-muted text-muted-foreground flex size-12 items-center justify-center rounded-full [&_svg]:size-6">{icon}</div>
      <h2 className="mt-1 font-semibold">{title}</h2>
      {children && <div className="text-muted-foreground max-w-sm text-sm">{children}</div>}
    </div>
  );
}

/** Petit titre de section dans une carte ou un panneau */
export function SectionTitle({ children, action }: { children: ReactNode; action?: ReactNode }) {
  return (
    <div className="mb-2 flex items-center justify-between gap-2">
      <h3 className="text-sm font-semibold">{children}</h3>
      {action}
    </div>
  );
}
