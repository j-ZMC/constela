"use client";

import { useRef, type ReactNode } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";

// The app's buttons (DESIGN.md): 44 px and body text, the look from the Button variant. A long label wraps instead of
// leaving the screen, so text at 150% still fits a phone.
export const action = "h-auto min-h-11 max-w-full shrink whitespace-normal px-5 py-2 text-base";
// For the other actions on a screen, with variant="outline": the app's outline button, nothing added.
export const outlined = action;

// The app's fields, as in Jobs and Learn: 44 px, mint inside white cards, body text so phones don't zoom in.
export const control = "h-11 bg-background text-base font-normal md:text-base";
export const longControl = "min-h-11 bg-background text-base font-normal md:text-base";
const nativeSelect = "h-11 w-full rounded-lg border border-input bg-background px-3 text-base font-normal outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50";

export const panel = "flex flex-col gap-4 rounded-xl border bg-card p-5";
export const note = "flex flex-col gap-2 rounded-xl bg-secondary p-4";

export function Field({ label, children }: { label: string; children: ReactNode }) {
  return (
    <label className="flex min-w-0 flex-col gap-2 font-medium">
      {label}
      {children}
    </label>
  );
}

type TextProps = { label: string; value: string | undefined; maxLength: number; onChange: (value: string) => void };

export function TextField({ label, value, maxLength, onChange }: TextProps) {
  return (
    <Field label={label}>
      <Input value={value ?? ""} maxLength={maxLength} onChange={(e) => onChange(e.target.value)} className={control} />
    </Field>
  );
}

export function LongTextField({ label, value, maxLength, onChange }: TextProps) {
  return (
    <Field label={label}>
      <Textarea value={value ?? ""} maxLength={maxLength} rows={3} onChange={(e) => onChange(e.target.value)} className={longControl} />
    </Field>
  );
}

export function NumberField({ label, value, min, max, onChange }: { label: string; value: number | undefined; min: number; max?: number; onChange: (value: number | undefined) => void }) {
  return (
    <Field label={label}>
      <Input
        type="number"
        inputMode="numeric"
        min={min}
        max={max}
        value={value ?? ""}
        onChange={(e) => onChange(e.target.value === "" ? undefined : Number(e.target.value))}
        className={control}
      />
    </Field>
  );
}

// blank: the words for "nothing chosen yet". Without it, the field always has a value.
export function SelectField<T extends string>({
  label,
  value,
  options,
  blank,
  onChange,
}: {
  label: string;
  value: T | undefined;
  options: { value: T; label: string }[];
  blank?: string;
  onChange: (value: T | undefined) => void;
}) {
  return (
    <Field label={label}>
      <select value={value ?? ""} onChange={(e) => onChange((e.target.value || undefined) as T | undefined)} className={nativeSelect}>
        {blank && <option value="">{blank}</option>}
        {options.map((o) => (
          <option key={o.value} value={o.value}>
            {o.label}
          </option>
        ))}
      </select>
    </Field>
  );
}

// A list the employer can grow and shrink. An empty list still shows one blank row, so there is always a place to start.
export function Rows<T>({
  items,
  blank,
  max,
  noun,
  addLabel,
  render,
  onChange,
}: {
  items: T[];
  blank: T;
  max: number;
  noun: string; // names each Remove button: five buttons that all say "Remove" are no use to a screen reader
  addLabel: string;
  render: (item: T, i: number, change: (next: T) => void) => ReactNode;
  onChange: (items: T[]) => void;
}) {
  const add = useRef<HTMLButtonElement>(null);
  const rows = items.length > 0 ? items : [blank];
  return (
    <div className="flex flex-col gap-3">
      <ol className="flex flex-col gap-4">
        {rows.map((item, i) => (
          <li key={i} className="flex flex-col gap-2">
            {render(item, i, (next) => onChange(rows.with(i, next)))}
            {items.length > 0 && (
              <Button
                variant="ghost"
                className={`${action} w-fit font-normal underline underline-offset-4`}
                aria-label={`Remove ${noun} ${i + 1}`}
                onClick={() => {
                  onChange(rows.filter((_, at) => at !== i));
                  // This button is about to go. The next frame is when Add can take focus, even if it was disabled at the limit.
                  requestAnimationFrame(() => add.current?.focus());
                }}
              >
                Remove
              </Button>
            )}
          </li>
        ))}
      </ol>
      <Button ref={add} variant="outline" className={`${outlined} w-fit`} disabled={rows.length >= max} onClick={() => onChange([...rows, blank])}>
        {addLabel}
      </Button>
    </div>
  );
}
