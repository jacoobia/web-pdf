import "./Segmented.css";

export function Segmented<T extends string>({
  label,
  value,
  options,
  onChange,
  role = "radio",
}: {
  label: string;
  value: T;
  options: readonly (readonly [T, string])[];
  onChange: (v: T) => void;
  role?: "radio" | "tab";
}) {
  return (
    // biome-ignore lint/a11y/useAriaPropsSupportedByRole: Biome can't see through the conditional role; both take a label
    <div className="seg" role={role === "tab" ? "tablist" : "radiogroup"} aria-label={label}>
      {options.map(([v, l]) => (
        // biome-ignore lint/a11y/useAriaPropsSupportedByRole: as above, role is radio or tab
        <button
          type="button"
          key={v}
          role={role}
          aria-checked={role === "radio" ? value === v : undefined}
          aria-selected={role === "tab" ? value === v : undefined}
          className={value === v ? "on" : ""}
          onClick={() => onChange(v)}
        >
          {l}
        </button>
      ))}
    </div>
  );
}
