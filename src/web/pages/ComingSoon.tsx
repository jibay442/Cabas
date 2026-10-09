import { EmptyState } from "../components/ui.tsx";
import { useT } from "../lib/i18n.tsx";

/** Écran provisoire des sections livrées aux étapes suivantes */
export function ComingSoon({ emoji, title }: { emoji: string; title: string }) {
  const t = useT();
  return (
    <EmptyState emoji={emoji} title={title}>
      {t("common.comingSoon")}
    </EmptyState>
  );
}
