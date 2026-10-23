import type { ComponentProps, ReactNode } from "react";
import { cx } from "../../lib/cx";
import "./Field.css";

export const Field = ({ label, wide, children }: { label: ReactNode; wide?: boolean; children: ReactNode }) => (
  // biome-ignore lint/a11y/noLabelWithoutControl: the control is passed in as children
  <label className={cx("field", wide && "wide")}>
    <span className="field-label">{label}</span>
    {children}
  </label>
);

export const TextInput = ({ className, ...props }: Omit<ComponentProps<"input">, "type">) => (
  <input type="text" className={cx("input", className)} {...props} />
);

export const NumberInput = ({
  unit,
  className,
  ...props
}: Omit<ComponentProps<"input">, "type"> & { unit?: string }) => {
  const input = <input type="number" className={cx("input", className)} {...props} />;
  return unit ? (
    <span className="unit-input">
      {input}
      <span>{unit}</span>
    </span>
  ) : (
    input
  );
};

export const TextArea = ({ className, ...props }: ComponentProps<"textarea">) => (
  <textarea className={cx("input", className)} {...props} />
);

export const ColorInput = ({ className, ...props }: Omit<ComponentProps<"input">, "type">) => (
  <input type="color" className={cx("color-input", className)} {...props} />
);

export const Checkbox = ({ label, ...props }: Omit<ComponentProps<"input">, "type"> & { label: ReactNode }) => (
  <label className="check">
    <input type="checkbox" {...props} />
    {label}
  </label>
);

type Option = string | readonly [value: string, label: string];
const option = (o: Option) => {
  const [value, label] = typeof o === "string" ? [o, o] : o;
  return (
    <option key={value} value={value}>
      {label}
    </option>
  );
};

export const Select = ({
  options = [],
  groups = [],
  placeholder,
  className,
  ...props
}: Omit<ComponentProps<"select">, "children"> & {
  options?: readonly Option[];
  groups?: readonly { label: string; options: readonly Option[] }[];
  placeholder?: string;
}) => (
  <select className={cx("input", className)} {...props}>
    {placeholder !== undefined && <option value="">{placeholder}</option>}
    {options.map(option)}
    {groups
      .filter((g) => g.options.length)
      .map((g) => (
        <optgroup key={g.label} label={g.label}>
          {g.options.map(option)}
        </optgroup>
      ))}
  </select>
);
