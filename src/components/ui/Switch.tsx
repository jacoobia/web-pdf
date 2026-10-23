import { cx } from "../../lib/cx";
import "./Switch.css";

export const Switch = ({
  label,
  checked,
  onChange,
}: {
  label: string;
  checked: boolean;
  onChange: (v: boolean) => void;
}) => (
  <button
    type="button"
    role="switch"
    aria-checked={checked}
    aria-label={label}
    className={cx("switch", checked && "on")}
    onClick={() => onChange(!checked)}
  >
    <span />
  </button>
);
