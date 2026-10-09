import { Archive, ListChecks, Plus } from "lucide-react";
import type { ListSummaryDto } from "../../../shared/types.ts";
import { Button } from "../../components/ui/button.tsx";
import { useI18n } from "../../lib/i18n.tsx";
import { cn } from "../../lib/utils.ts";

function NavItem({ active, onClick, icon, label, meta }: { active: boolean; onClick: () => void; icon: React.ReactNode; label: string; meta: string }) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-current={active ? "true" : undefined}
      className={cn("flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-sm [&_svg]:size-4", active ? "bg-accent text-accent-foreground font-medium" : "hover:bg-accent/60")}
    >
      {icon}
      <span className="flex-1 truncate text-left">{label}</span>
      <span className="text-muted-foreground text-xs tabular-nums">{meta}</span>
    </button>
  );
}

/** Listes en cours + historique (barre latérale sur grand écran, panneau sur mobile) */
export function ListsNav({
  active,
  archived,
  currentId,
  canCreate,
  creating,
  onSelect,
  onCreate,
}: {
  active: ListSummaryDto[];
  archived: ListSummaryDto[];
  currentId: string | undefined;
  canCreate: boolean;
  creating: boolean;
  onSelect: (id: string) => void;
  onCreate: () => void;
}) {
  const { t, locale } = useI18n();
  const date = (iso: string | null) => (iso ? new Date(iso).toLocaleDateString(locale, { day: "numeric", month: "short" }) : "");

  return (
    <nav aria-label={t("list.lists")} className="grid gap-4">
      <div className="grid gap-0.5">
        <h2 className="text-muted-foreground px-2 pb-1 text-xs font-medium tracking-wide uppercase">{t("list.inProgress")}</h2>
        {active.map((l) => (
          <NavItem key={l.id} active={l.id === currentId} onClick={() => onSelect(l.id)} icon={<ListChecks />} label={l.name} meta={String(l.itemCount - l.checkedCount)} />
        ))}
        {active.length === 0 && <p className="text-muted-foreground px-2 text-xs">{t("list.noList")}</p>}
        {canCreate && (
          <Button variant="ghost" size="sm" className="text-primary mt-1 justify-start px-2" loading={creating} onClick={onCreate}>
            <Plus /> {t("list.newList")}
          </Button>
        )}
      </div>
      {archived.length > 0 && (
        <div className="grid gap-0.5">
          <h2 className="text-muted-foreground px-2 pb-1 text-xs font-medium tracking-wide uppercase">{t("list.history")}</h2>
          {archived.slice(0, 12).map((l) => (
            <NavItem key={l.id} active={l.id === currentId} onClick={() => onSelect(l.id)} icon={<Archive />} label={l.name} meta={date(l.archivedAt)} />
          ))}
        </div>
      )}
    </nav>
  );
}
