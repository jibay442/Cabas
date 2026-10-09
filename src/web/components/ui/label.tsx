import { Label as LabelPrimitive } from "radix-ui";
import * as React from "react";
import { cn } from "../../lib/utils.ts";

export function Label({ className, ...props }: React.ComponentProps<typeof LabelPrimitive.Root>) {
  return <LabelPrimitive.Root data-slot="label" className={cn("flex items-center gap-2 text-sm leading-none font-medium select-none", className)} {...props} />;
}

/** Libellé + champ + aide, avec l'association label/champ faite automatiquement */
export function Field({ label, hint, className, children }: { label: string; hint?: React.ReactNode; className?: string; children: (id: string) => React.ReactNode }) {
  const id = React.useId();
  return (
    <div className={cn("grid gap-2", className)}>
      <Label htmlFor={id}>{label}</Label>
      {children(id)}
      {hint && <p className="text-muted-foreground text-xs">{hint}</p>}
    </div>
  );
}
