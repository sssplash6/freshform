"use client";

import { useEffect, useRef, useState } from "react";

import { CheckIcon, ChevronDownIcon } from "@/components/icons";

export type SelectOption = { value: string; label: string };

/**
 * Palette-styled dropdown that submits like a native select (hidden input
 * carries the value in FormData). Trigger + listbox with keyboard support:
 * arrows move, Enter/Space picks, Escape closes. Server actions validate the
 * value, so an empty submit gets a friendly error rather than silence.
 */
export function Select({
  name,
  options,
  placeholder = "Select…",
  defaultValue = "",
  ariaLabel,
}: {
  name: string;
  options: SelectOption[];
  placeholder?: string;
  defaultValue?: string;
  ariaLabel: string;
}) {
  const [open, setOpen] = useState(false);
  const [value, setValue] = useState(defaultValue);
  const [active, setActive] = useState(-1);
  const rootRef = useRef<HTMLDivElement>(null);
  const selectedIndex = options.findIndex((o) => o.value === value);
  const selected = selectedIndex >= 0 ? options[selectedIndex] : null;

  useEffect(() => {
    if (!open) return;
    function onPointerDown(e: PointerEvent) {
      if (!rootRef.current?.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener("pointerdown", onPointerDown);
    return () => document.removeEventListener("pointerdown", onPointerDown);
  }, [open]);

  function openMenu() {
    setActive(selectedIndex >= 0 ? selectedIndex : 0);
    setOpen(true);
  }

  function choose(i: number) {
    setValue(options[i].value);
    setOpen(false);
  }

  function onKeyDown(e: React.KeyboardEvent) {
    if (e.key === "ArrowDown") {
      e.preventDefault();
      if (!open) openMenu();
      else setActive((a) => Math.min(a + 1, options.length - 1));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      if (open) setActive((a) => Math.max(a - 1, 0));
    } else if (e.key === "Enter" || e.key === " ") {
      e.preventDefault();
      if (!open) openMenu();
      else if (active >= 0) choose(active);
    } else if (e.key === "Escape" && open) {
      e.stopPropagation();
      setOpen(false);
    }
  }

  return (
    <div ref={rootRef} className="relative" onKeyDown={onKeyDown}>
      <input type="hidden" name={name} value={value} />
      <button
        type="button"
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-label={ariaLabel}
        onClick={() => (open ? setOpen(false) : openMenu())}
        className={`flex w-full items-center justify-between gap-2 rounded-md border bg-white px-3.5 py-2.5 text-left text-[15px] transition ${
          open ? "border-navy" : "border-mist hover:border-navy/40"
        }`}
      >
        <span className={selected ? "text-gray-900" : "text-gray-400"}>
          {selected?.label ?? placeholder}
        </span>
        <ChevronDownIcon
          className={`h-4 w-4 shrink-0 transition-transform ${
            open ? "rotate-180 text-navy" : "text-gray-400"
          }`}
        />
      </button>

      {open && (
        <ul
          role="listbox"
          aria-label={ariaLabel}
          className="pop-in absolute z-20 mt-1.5 max-h-64 w-full overflow-auto rounded-lg border border-mist bg-white p-1 shadow-lg"
        >
          {options.length === 0 && (
            <li className="px-3 py-2 text-sm text-gray-400">No options</li>
          )}
          {options.map((o, i) => {
            const isSelected = o.value === value;
            return (
              <li key={o.value} role="option" aria-selected={isSelected}>
                <button
                  type="button"
                  tabIndex={-1}
                  onMouseEnter={() => setActive(i)}
                  onClick={() => choose(i)}
                  className={`flex w-full items-center justify-between gap-2 rounded-md px-3 py-2 text-left text-[15px] transition-colors ${
                    i === active ? "bg-mist/50" : ""
                  } ${isSelected ? "font-medium text-navy" : "text-gray-800"}`}
                >
                  <span className="truncate">{o.label}</span>
                  {isSelected && (
                    <CheckIcon className="h-4 w-4 shrink-0 text-brand" />
                  )}
                </button>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
