import type { CSSProperties } from "react";
import { cx } from "../../lib/cx";
import { Icon } from "./Icon";
import "./AddBar.css";

export const AddBar = ({
  label,
  onAdd,
  className,
  style,
}: {
  label: string;
  onAdd: () => void;
  className?: string;
  style?: CSSProperties;
}) => (
  <button
    type="button"
    className={cx("add-bar", className)}
    style={style}
    aria-label={label}
    title={label}
    onPointerDown={(e) => e.stopPropagation()}
    onClick={onAdd}
  >
    <Icon name="plus" size={16} />
  </button>
);
