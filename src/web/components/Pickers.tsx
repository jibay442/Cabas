import { AVATAR_EMOJIS, MEMBER_COLORS } from "../../shared/defaults.ts";
import { cx } from "./ui.tsx";

export function EmojiPicker({ value, onChange, label, choices = AVATAR_EMOJIS }: { value: string; onChange: (v: string) => void; label: string; choices?: string[] }) {
  return (
    <fieldset>
      <legend className="mb-1.5 text-sm font-medium text-stone-700 dark:text-stone-300">{label}</legend>
      <div className="flex flex-wrap gap-1.5">
        {choices.map((emoji) => (
          <button
            key={emoji}
            type="button"
            aria-pressed={value === emoji}
            onClick={() => onChange(emoji)}
            className={cx(
              "size-11 rounded-xl text-2xl transition hover:bg-stone-200 dark:hover:bg-stone-800",
              value === emoji && "bg-accent/15 ring-2 ring-accent",
            )}
          >
            {emoji}
          </button>
        ))}
      </div>
    </fieldset>
  );
}

export function ColorPicker({ value, onChange, label, choices = MEMBER_COLORS }: { value: string; onChange: (v: string) => void; label: string; choices?: string[] }) {
  return (
    <fieldset>
      <legend className="mb-1.5 text-sm font-medium text-stone-700 dark:text-stone-300">{label}</legend>
      <div className="flex flex-wrap gap-2">
        {choices.map((color) => (
          <button
            key={color}
            type="button"
            aria-label={color}
            aria-pressed={value.toLowerCase() === color}
            onClick={() => onChange(color)}
            className={cx("size-9 rounded-full transition", value.toLowerCase() === color && "ring-4 ring-offset-2 ring-stone-400 dark:ring-offset-stone-900")}
            style={{ backgroundColor: color }}
          />
        ))}
      </div>
    </fieldset>
  );
}
