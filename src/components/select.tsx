export type SelectOption = { value: string; label: string };

/**
 * Native select with the shared field styling. Native controls preserve
 * browser validation, mobile pickers, and dependable screen-reader behavior.
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
  return (
    <select
      name={name}
      defaultValue={defaultValue}
      required={required}
      aria-label={ariaLabel}
      className="min-h-11 w-full rounded-md border border-line bg-surface px-3.5 py-2.5 text-[15px] text-ink transition hover:border-brand/40 focus:border-brand focus:outline-none"
    >
      {/* When not required, the empty option stays selectable so it can
        * serve as an "All …" filter choice. */}
      <option value="" disabled={required}>
        {placeholder}
      </option>
      {options.map((option) => (
        <option key={option.value} value={option.value}>
          {option.label}
        </option>
      ))}
    </select>
  );
}
