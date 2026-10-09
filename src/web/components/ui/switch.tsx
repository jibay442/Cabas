import { Switch as SwitchPrimitive } from "radix-ui";
import * as React from "react";
import { cn } from "../../lib/utils.ts";

export function Switch({ className, ...props }: React.ComponentProps<typeof SwitchPrimitive.Root>) {
  return (
    <SwitchPrimitive.Root
      data-slot="switch"
      className={cn(
        "peer data-[state=checked]:bg-primary data-[state=unchecked]:bg-input focus-visible:border-ring focus-visible:ring-ring/50 dark:data-[state=unchecked]:bg-input/80 inline-flex h-[1.15rem] w-8 shrink-0 items-center rounded-full border border-transparent shadow-xs transition-all outline-none focus-visible:ring-[3px] disabled:cursor-not-allowed disabled:opacity-50",
        className,
      )}
      {...props}
    >
      <SwitchPrimitive.Thumb
        data-slot="switch-thumb"
        className="bg-background dark:data-[state=unchecked]:bg-foreground dark:data-[state=checked]:bg-primary-foreground pointer-events-none block size-4 rounded-full ring-0 transition-transform data-[state=checked]:translate-x-[calc(100%-2px)] data-[state=unchecked]:translate-x-0"
      />
    </SwitchPrimitive.Root>
  );
}

/** Ligne « libellé + description + interrupteur » */
export function SwitchRow({ label, description, checked, onCheckedChange }: { label: string; description?: string; checked: boolean; onCheckedChange: (v: boolean) => void }) {
  const id = React.useId();
  return (
    <div className="flex items-center justify-between gap-4 py-2.5">
      <label htmlFor={id} className="grid gap-0.5 text-sm">
        <span className="font-medium">{label}</span>
        {description && <span className="text-muted-foreground text-xs">{description}</span>}
      </label>
      <Switch id={id} checked={checked} onCheckedChange={onCheckedChange} />
    </div>
  );
}
