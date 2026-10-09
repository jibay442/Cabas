import { Check } from "lucide-react";
import { MEMBER_COLORS } from "../../shared/defaults.ts";
import { cn } from "../lib/utils.ts";

export function ColorPicker({ value, onChange, label, choices = MEMBER_COLORS }: { value: string; onChange: (v: string) => void; label: string; choices?: string[] }) {
  return (
    <fieldset className="grid gap-2">
      <legend className="mb-2 text-sm font-medium">{label}</legend>
      <div className="flex flex-wrap gap-2">
        {choices.map((color) => {
          const selected = value.toLowerCase() === color.toLowerCase();
          return (
            <button
              key={color}
              type="button"
              aria-label={color}
              aria-pressed={selected}
              onClick={() => onChange(color)}
              className={cn("flex size-7 items-center justify-center rounded-full text-white ring-offset-2 ring-offset-background transition", selected && "ring-2 ring-ring")}
              style={{ backgroundColor: color }}
            >
              {selected && <Check className="size-3.5" />}
            </button>
          );
        })}
      </div>
    </fieldset>
  );
}
