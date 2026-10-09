import type { LucideIcon } from "lucide-react";
import { EmptyState, PageHeader } from "../components/ui/misc.tsx";
import { useT } from "../lib/i18n.tsx";

/** Écran provisoire des sections livrées aux étapes suivantes */
export function ComingSoon({ icon: Icon, title }: { icon: LucideIcon; title: string }) {
  const t = useT();
  return (
    <>
      <PageHeader title={title} />
      <div className="bg-card rounded-xl border shadow-sm">
        <EmptyState icon={<Icon />} title={t("common.comingSoonTitle")}>
          {t("common.comingSoon")}
        </EmptyState>
      </div>
    </>
  );
}
