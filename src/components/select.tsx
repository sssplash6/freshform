"use client";

import { useEffect, useId, useRef, useState } from "react";
import { createPortal } from "react-dom";

import { CheckIcon, ChevronDownIcon } from "@/components/icons";
import { cn } from "@/lib/cn";
import { useAnchoredPosition } from "@/lib/use-anchored-position";

export type SelectOption = { value: string; label: string };

/**
 * Custom select: a styled trigger + a popover listbox that matches the app's
 * surfaces (rounded, hairline border, soft shadow, brand-tinted selection)
 * instead of the raw browser dropdown. The chosen value rides a hidden input
 * so server-action forms read it exactly like a native <select>.
 *
 * The listbox is portaled to <body> and positioned `fixed`. It has to be: these
 * selects sit at the foot of `Panel`s, which are `overflow-hidden` to mask
 * their rounded corners, and an absolutely-positioned list is simply cut off at
 * that edge — a mentor list would render as an unusable few-pixel sliver.
 */
export function Select({
  name,
  options,
  placeholder = "Select…",
  defaultValue = "",
  ariaLabel,
  required = true,
  onChange,
}: {
  name: string;
  options: SelectOption[];
  placeholder?: string;
  defaultValue?: string;
  ariaLabel: string;
  required?: boolean;
  /** Notifies the parent when the choice changes, for dependent fields. */
  onChange?: (value: string) => void;
}) {
  const [value, setValue] = useState(defaultValue);
  const [open, setOpen] = useState(false);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const listRef = useRef<HTMLUListElement>(null);
  const listId = useId();

  const anchored = useAnchoredPosition(open, triggerRef, listRef, {
    matchTriggerWidth: true,
    maxHeight: 256,
  });

  useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent) => {
      // The list lives in a portal, so "inside" means either element — a
      // containment test on the trigger's wrapper alone would treat picking an
      // option as clicking away and close before the choice registered.
      const t = e.target as Node;
      if (triggerRef.current?.contains(t) || listRef.current?.contains(t)) return;
      setOpen(false);
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

  useEffect(() => {
    const list = listRef.current;
    if (!open || !list) return;
    // A select can live inside another popover (the row-action menus), and that
    // menu closes on any mousedown outside its own DOM. Now that the list is
    // portaled it IS outside, so choosing an option would tear the menu down
    // around it. Claim the event here, at the element, before it reaches the
    // document-level listeners that would misread it.
    const claim = (e: MouseEvent) => e.stopPropagation();
    list.addEventListener("mousedown", claim);
    return () => list.removeEventListener("mousedown", claim);
  }, [open]);

  const selected = options.find((o) => o.value === value);
  const choose = (v: string) => {
    setValue(v);
    setOpen(false);
    onChange?.(v);
  };

  return (
    <div className="relative">
      <input type="hidden" name={name} value={value} />
      <button
        ref={triggerRef}
        type="button"
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-controls={open ? listId : undefined}
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

      {open &&
        createPortal(
          <ul
            ref={listRef}
            id={listId}
            role="listbox"
            aria-label={ariaLabel}
            style={{
              ...anchored?.style,
              // Hidden for the single frame before it has been measured, so it
              // never flashes at the top-left corner.
              visibility: anchored ? "visible" : "hidden",
            }}
            className={cn(
              "pop-in z-50 max-w-[calc(100vw-1rem)] overflow-auto rounded-xl border border-line bg-surface p-1 shadow-soft",
              anchored?.up ? "[--pop-origin:bottom]" : "[--pop-origin:top]",
            )}
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
          </ul>,
          document.body,
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
