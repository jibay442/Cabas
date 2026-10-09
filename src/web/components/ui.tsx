// Petit kit d'interface : boutons, champs, cartes, fenêtres, avatars.

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useId,
  useRef,
  useState,
  type ButtonHTMLAttributes,
  type InputHTMLAttributes,
  type ReactNode,
  type SelectHTMLAttributes,
} from "react";
import { Link } from "react-router";
import { useT } from "../lib/i18n.tsx";

const cx = (...classes: (string | false | null | undefined)[]) => classes.filter(Boolean).join(" ");
export { cx };

type Variant = "primary" | "secondary" | "ghost" | "danger";

const variants: Record<Variant, string> = {
  primary: "bg-accent text-white hover:brightness-110 shadow-sm",
  secondary: "bg-white text-stone-800 ring-1 ring-stone-200 hover:bg-stone-50 dark:bg-stone-800 dark:text-stone-100 dark:ring-stone-700 dark:hover:bg-stone-700",
  ghost: "text-stone-700 hover:bg-stone-200/60 dark:text-stone-200 dark:hover:bg-stone-800",
  danger: "bg-red-700 text-white hover:bg-red-800",
};

export function Button({
  variant = "primary",
  size = "md",
  loading,
  className,
  children,
  disabled,
  ...props
}: ButtonHTMLAttributes<HTMLButtonElement> & { variant?: Variant; size?: "sm" | "md" | "lg"; loading?: boolean }) {
  return (
    <button
      type="button"
      disabled={disabled || loading}
      className={cx(
        "inline-flex items-center justify-center gap-2 rounded-xl font-medium transition active:scale-[0.98] disabled:opacity-50 disabled:pointer-events-none",
        "focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent",
        size === "sm" && "h-9 px-3 text-sm",
        size === "md" && "h-11 px-4",
        size === "lg" && "h-13 px-5 text-lg",
        variants[variant],
        className,
      )}
      {...props}
    >
      {loading && <Spinner small />}
      {children}
    </button>
  );
}

export function Spinner({ small }: { small?: boolean }) {
  return (
    <span
      role="status"
      aria-label="…"
      className={cx("inline-block animate-spin rounded-full border-2 border-current border-r-transparent", small ? "size-4" : "size-8")}
    />
  );
}

const fieldClass =
  "w-full rounded-xl bg-white px-3 h-11 ring-1 ring-stone-300 placeholder:text-stone-400 focus:outline-none focus:ring-2 focus:ring-accent dark:bg-stone-900 dark:ring-stone-700";

export function Field({ label, hint, children }: { label: string; hint?: ReactNode; children: (id: string) => ReactNode }) {
  const id = useId();
  return (
    <div className="space-y-1.5">
      <label htmlFor={id} className="block text-sm font-medium text-stone-700 dark:text-stone-300">
        {label}
      </label>
      {children(id)}
      {hint && <p className="text-xs text-stone-500 dark:text-stone-400">{hint}</p>}
    </div>
  );
}

export function Input({ label, hint, className, ...props }: InputHTMLAttributes<HTMLInputElement> & { label?: string; hint?: ReactNode }) {
  const input = (id?: string) => <input id={id} className={cx(fieldClass, className)} {...props} />;
  return label ? <Field label={label} hint={hint}>{input}</Field> : input();
}

export function Select({
  label,
  className,
  children,
  ...props
}: SelectHTMLAttributes<HTMLSelectElement> & { label?: string }) {
  const select = (id?: string) => (
    <select id={id} className={cx(fieldClass, "appearance-none pr-8", className)} {...props}>
      {children}
    </select>
  );
  return label ? <Field label={label}>{select}</Field> : select();
}

export function Toggle({ label, checked, onChange, description }: { label: string; checked: boolean; onChange: (v: boolean) => void; description?: string }) {
  return (
    <label className="flex cursor-pointer items-center justify-between gap-4 py-2">
      <span>
        <span className="block">{label}</span>
        {description && <span className="block text-sm text-stone-500 dark:text-stone-400">{description}</span>}
      </span>
      <input type="checkbox" className="peer sr-only" checked={checked} onChange={(e) => onChange(e.target.checked)} />
      <span
        aria-hidden
        className="relative h-7 w-12 shrink-0 rounded-full bg-stone-300 transition peer-checked:bg-accent peer-focus-visible:outline-2 peer-focus-visible:outline-offset-2 peer-focus-visible:outline-accent dark:bg-stone-700 after:absolute after:left-1 after:top-1 after:size-5 after:rounded-full after:bg-white after:shadow after:transition peer-checked:after:translate-x-5"
      />
    </label>
  );
}

export function Card({ className, children }: { className?: string; children: ReactNode }) {
  return <div className={cx("rounded-2xl bg-white p-4 shadow-sm ring-1 ring-stone-200/70 dark:bg-stone-900 dark:ring-stone-800", className)}>{children}</div>;
}

export function Avatar({ emoji, color, size = "md", label }: { emoji: string; color: string; size?: "sm" | "md" | "lg"; label?: string }) {
  return (
    <span
      role={label ? "img" : undefined}
      aria-label={label}
      aria-hidden={label ? undefined : true}
      className={cx(
        "inline-flex shrink-0 items-center justify-center rounded-full",
        size === "sm" && "size-7 text-base",
        size === "md" && "size-10 text-xl",
        size === "lg" && "size-16 text-4xl",
      )}
      style={{ backgroundColor: `${color}2e`, boxShadow: `inset 0 0 0 2px ${color}` }}
    >
      {emoji}
    </span>
  );
}

export function Badge({ children, tone = "neutral" }: { children: ReactNode; tone?: "neutral" | "accent" | "warn" }) {
  return (
    <span
      className={cx(
        "inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium",
        tone === "neutral" && "bg-stone-200 text-stone-700 dark:bg-stone-800 dark:text-stone-300",
        tone === "accent" && "bg-accent/15 text-accent-ink",
        tone === "warn" && "bg-amber-100 text-amber-900 dark:bg-amber-900/40 dark:text-amber-200",
      )}
    >
      {children}
    </span>
  );
}

export function PageHeader({ title, back, action }: { title: string; back?: string; action?: ReactNode }) {
  const t = useT();
  return (
    <div className="mb-4 flex items-center gap-2">
      {back && (
        <Link to={back} className="-ml-2 rounded-full p-2 text-xl hover:bg-stone-200 dark:hover:bg-stone-800" aria-label={t("common.back")}>
          ←
        </Link>
      )}
      <h1 className="flex-1 text-2xl font-bold tracking-tight">{title}</h1>
      {action}
    </div>
  );
}

export function EmptyState({ emoji, title, children }: { emoji: string; title: string; children?: ReactNode }) {
  return (
    <div className="flex flex-col items-center gap-2 px-6 py-16 text-center">
      <span className="text-6xl" aria-hidden>
        {emoji}
      </span>
      <h2 className="text-lg font-semibold">{title}</h2>
      {children && <div className="max-w-sm text-stone-600 dark:text-stone-400">{children}</div>}
    </div>
  );
}

/** Fenêtre modale (feuille en bas sur mobile, centrée sur grand écran) basée sur <dialog> */
export function Sheet({ open, onClose, title, children }: { open: boolean; onClose: () => void; title: string; children: ReactNode }) {
  const t = useT();
  const ref = useRef<HTMLDialogElement>(null);
  useEffect(() => {
    const dialog = ref.current;
    if (!dialog) return;
    if (open && !dialog.open) dialog.showModal();
    if (!open && dialog.open) dialog.close();
  }, [open]);

  return (
    <dialog
      ref={ref}
      onClose={onClose}
      onClick={(e) => e.target === ref.current && onClose()}
      aria-label={title}
      className="m-0 mt-auto w-full max-w-none rounded-t-3xl bg-white p-0 text-stone-900 shadow-xl sm:m-auto sm:max-w-md sm:rounded-3xl dark:bg-stone-900 dark:text-stone-100"
    >
      {open && (
        <div className="animate-pop max-h-[85dvh] overflow-y-auto p-5 pb-[max(1.25rem,env(safe-area-inset-bottom))]">
          <div className="mb-4 flex items-center justify-between">
            <h2 className="text-lg font-semibold">{title}</h2>
            <button type="button" onClick={onClose} className="rounded-full p-2 hover:bg-stone-100 dark:hover:bg-stone-800" aria-label={t("common.close")}>
              ✕
            </button>
          </div>
          {children}
        </div>
      )}
    </dialog>
  );
}

// ── Notifications éphémères ──

interface Toast {
  id: number;
  text: string;
  tone: "info" | "error";
}

const ToastContext = createContext<(text: string, tone?: Toast["tone"]) => void>(() => {});

export function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([]);
  const push = useCallback((text: string, tone: Toast["tone"] = "info") => {
    const id = Date.now() + Math.random();
    setToasts((t) => [...t, { id, text, tone }]);
    setTimeout(() => setToasts((t) => t.filter((x) => x.id !== id)), 3500);
  }, []);
  return (
    <ToastContext.Provider value={push}>
      {children}
      <div aria-live="polite" className="pointer-events-none fixed inset-x-0 top-3 z-50 flex flex-col items-center gap-2 px-4">
        {toasts.map((t) => (
          <div
            key={t.id}
            className={cx(
              "animate-pop rounded-xl px-4 py-2.5 text-sm font-medium shadow-lg",
              t.tone === "error" ? "bg-red-700 text-white" : "bg-stone-900 text-white dark:bg-stone-100 dark:text-stone-900",
            )}
          >
            {t.text}
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  );
}

export const useToast = () => useContext(ToastContext);
