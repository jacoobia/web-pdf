import { memo } from "react";
import type { FormField } from "../lib/model";
import "./FormFieldInput.css";

const fontSize = (f: FormField) =>
  f.size > 0 && f.size <= f.rect.h * (f.multiline ? 0.5 : 1) ? f.size : Math.min(12, f.rect.h * 0.7);

export const FormFieldInput = memo(function FormFieldInput({
  f,
  scale,
  onChange,
}: {
  f: FormField;
  scale: number;
  onChange: (id: string, change: Partial<FormField>) => void;
}) {
  const common = {
    className: `form-field ${f.kind}`,
    "aria-label": f.name,
    disabled: f.readOnly,
    style: {
      left: f.rect.x * scale,
      top: f.rect.y * scale,
      width: f.rect.w * scale,
      height: f.rect.h * scale,
      fontSize: fontSize(f) * scale,
    },
    onPointerDown: (e: React.PointerEvent) => e.stopPropagation(),
  };
  if (f.kind === "check" || f.kind === "radio")
    return (
      <input
        {...common}
        type={f.kind === "check" ? "checkbox" : "radio"}
        name={f.kind === "radio" ? `pdf-${f.name}` : undefined}
        checked={f.checked}
        onChange={(e) => onChange(f.id, { checked: f.kind === "radio" || e.target.checked })}
      />
    );
  if (f.kind === "choice")
    return (
      <select {...common} value={f.value} onChange={(e) => onChange(f.id, { value: e.target.value })}>
        {!f.options.includes(f.value) && <option value={f.value} />}
        {f.options.map((o) => (
          <option key={o}>{o}</option>
        ))}
      </select>
    );
  const text = {
    value: f.value,
    maxLength: f.maxLen || undefined,
    onChange: (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) =>
      onChange(f.id, { value: e.target.value }),
  };
  return f.multiline ? <textarea {...common} {...text} /> : <input {...common} {...text} type="text" />;
});
