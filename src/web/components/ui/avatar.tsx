import { cn } from "../../lib/utils.ts";

/** Initiales : « Claire » → « C », « Jean-Baptiste » → « JB » */
export function initials(name: string): string {
  const words = name.trim().split(/[\s-]+/).filter(Boolean);
  return words
    .slice(0, 2)
    .map((w) => w.charAt(0))
    .join("")
    .toUpperCase();
}

/** Avatar sobre : initiales sur la couleur du membre */
export function Avatar({ name, color, size = "md", className, title }: { name: string; color: string; size?: "xs" | "sm" | "md" | "lg"; className?: string; title?: string }) {
  return (
    <span
      role="img"
      aria-label={title ?? name}
      title={title ?? name}
      className={cn(
        "inline-flex shrink-0 items-center justify-center rounded-full font-semibold text-white select-none",
        size === "xs" && "size-5 text-[10px]",
        size === "sm" && "size-6 text-[11px]",
        size === "md" && "size-8 text-xs",
        size === "lg" && "size-12 text-base",
        className,
      )}
      style={{ backgroundColor: color }}
    >
      {initials(name)}
    </span>
  );
}
