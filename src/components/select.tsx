"use client";

import { useEffect, useRef, useState } from "react";

import { CheckIcon, ChevronDownIcon } from "@/components/icons";
import { cn } from "@/lib/cn";

export type SelectOption = { value: string; label: string };

/**
 * Custom select: a styled trigger + a popover listbox that matches the app's
 * surfaces (rounded, hairline border, soft shadow, brand-tinted selection)
 * instead of the raw browser dropdown. The chosen value rides a hidden input
 * so server-action forms read it exactly like a native <select>.
 */
export function Select({
  name,
  options,
  placeholder = "Select…",
  defaultValue = "",
  ariaLabel,
  required = true,
}: {
  name: string;
  options: SelectOption[];
  placeholder?: string;
  defaultValue?: string;
  ariaLabel: string;
  required?: boolean;
}) {
  const [value, setValue] = useState(defaultValue);
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    document.addEventListener("mousedown", onDown);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDown);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  const selected = options.find((o) => o.value === value);
  const choose = (v: string) => {
    setValue(v);
    setOpen(false);
  };

  return (
    <div ref={ref} className="relative">
      <input type="hidden" name={name} value={value} />
      <button
        type="button"
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-label={ariaLabel}
        onClick={() => setOpen((v) => !v)}
        className={cn(
          "flex h-10 w-full items-center justify-between gap-2 rounded-lg border bg-surface pl-3.5 pr-2.5 text-[15px] transition-colors focus:outline-none",
          open ? "border-brand" : "border-line hover:border-brand/40",
          selected ? "text-ink" : "text-muted-fg",
        )}
      >
        <span className="truncate">{selected ? selected.label : placeholder}</span>
        <ChevronDownIcon
          className={cn(
            "h-4 w-4 shrink-0 text-muted-fg transition-transform",
            open && "rotate-180",
          )}
        />
      </button>

      {open && (
        <ul
          role="listbox"
          className="pop-in absolute z-30 mt-1.5 max-h-64 w-full min-w-max overflow-auto rounded-xl border border-line bg-surface p-1 shadow-soft [--pop-origin:top]"
        >
          {!required && (
            <SelectItem selected={value === ""} onSelect={() => choose("")}>
              {placeholder}
            </SelectItem>
          )}
          {options.map((o) => (
            <SelectItem
              key={o.value}
              selected={o.value === value}
              onSelect={() => choose(o.value)}
            >
              {o.label}
            </SelectItem>
          ))}
        </ul>
      )}
    </div>
  );
}

function SelectItem({
  selected,
  onSelect,
  children,
}: {
  selected: boolean;
  onSelect: () => void;
  children: React.ReactNode;
}) {
  return (
    <li>
      <button
        type="button"
        role="option"
        aria-selected={selected}
        onClick={onSelect}
        className={cn(
          "flex w-full items-center justify-between gap-4 rounded-lg px-2.5 py-2 text-left text-sm transition-colors",
          selected
            ? "bg-brand-soft font-medium text-brand"
            : "text-ink hover:bg-canvas",
        )}
      >
        <span className="truncate">{children}</span>
        {selected && <CheckIcon className="h-4 w-4 shrink-0" />}
      </button>
    </li>
  );
}
