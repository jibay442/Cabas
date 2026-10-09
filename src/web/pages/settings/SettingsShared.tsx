import { ArrowLeft } from "lucide-react";
import type { ReactNode } from "react";
import { Link } from "react-router";
import { useT } from "../../lib/i18n.tsx";
import { cn } from "../../lib/utils.ts";

export function BackToSettings({ to = "/reglages", label }: { to?: string; label?: string }) {
  const t = useT();
  return (
    <Link to={to} className="text-muted-foreground hover:text-foreground mb-2 inline-flex items-center gap-1 text-sm">
      <ArrowLeft className="size-4" /> {label ?? t("nav.settings")}
    </Link>
  );
}

/** Carte de réglages : titre, description, contenu */
export function SettingsCard({ title, description, children, className }: { title?: ReactNode; description?: ReactNode; children: ReactNode; className?: string }) {
  return (
    <section className={cn("bg-card rounded-xl border p-5 shadow-sm", className)}>
      {(title || description) && (
        <header className="mb-4">
          {title && <h2 className="font-semibold">{title}</h2>}
          {description && <p className="text-muted-foreground mt-1 text-sm">{description}</p>}
        </header>
      )}
      {children}
    </section>
  );
}
