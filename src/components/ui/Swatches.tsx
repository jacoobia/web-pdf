import type { CSSProperties } from "react";
import { Icon } from "./Icon";
import "./Swatches.css";

const same = (a: string, b: string) => a.toLowerCase() === b.toLowerCase();

export function Swatches({
  label,
  value,
  options,
  onChange,
}: {
  label: string;
  value: string;
  options: readonly (readonly [name: string, hex: string])[];
  onChange: (hex: string) => void;
}) {
  return (
    <div className="swatches" role="radiogroup" aria-label={label}>
      {options.map(([name, hex]) => (
        <button
          type="button"
          key={hex}
          role="radio"
          aria-checked={same(value, hex)}
          aria-label={name}
          title={name}
          className="swatch"
          style={{ "--swatch": hex } as CSSProperties}
          onClick={() => onChange(hex)}
        />
      ))}
      <label className="swatch custom" title="Custom colour">
        <Icon name="plus" size={14} />
        <input
          type="color"
          aria-label={`Custom ${label.toLowerCase()}`}
          value={/^#[0-9a-f]{6}$/i.test(value) ? value : options[0][1]}
          onChange={(e) => onChange(e.target.value)}
        />
      </label>
    </div>
  );
}
