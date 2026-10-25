import { cx } from "../../lib/cx";
import { Icon } from "./Icon";
import "./AddBar.css";

export const AddBar = ({ label, onAdd, className }: { label: string; onAdd: () => void; className?: string }) => (
  <button
    type="button"
    className={cx("add-bar", className)}
    aria-label={label}
    title={label}
    onPointerDown={(e) => e.stopPropagation()}
    onClick={onAdd}
  >
    <span className="add-bar-plus">
      <Icon name="plus" size={14} />
    </span>
  </button>
);
