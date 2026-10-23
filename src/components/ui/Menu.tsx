import { type CSSProperties, type KeyboardEvent, useEffect, useRef } from "react";
import { cx } from "../../lib/cx";
import { Kbd } from "./Text";
import "./Menu.css";

export type MenuItem = {
  label: string;
  onSelect: () => unknown;
  shortcut?: string;
  disabled?: boolean;
  danger?: boolean;
};
export type MenuEntry = MenuItem | "separator";

const ITEM_H = 31;

export function Menu({
  items,
  onClose,
  at,
  className,
}: {
  items: MenuEntry[];
  onClose: () => void;
  at?: { left: number; top: number };
  className?: string;
}) {
  const menu = useRef<HTMLDivElement>(null);
  useEffect(() => menu.current?.querySelector<HTMLElement>("button:not(:disabled)")?.focus(), []);
  const onKeyDown = (e: KeyboardEvent) => {
    e.stopPropagation();
    const btns = [...menu.current!.querySelectorAll<HTMLElement>("button:not(:disabled)")];
    const i = btns.indexOf(document.activeElement as HTMLElement);
    if (e.key === "Escape" || e.key === "Tab") e.preventDefault(), onClose();
    if (e.key === "ArrowDown") e.preventDefault(), btns[(i + 1) % btns.length]?.focus();
    if (e.key === "ArrowUp") e.preventDefault(), btns[(i - 1 + btns.length) % btns.length]?.focus();
  };
  const style: CSSProperties | undefined = at && {
    position: "fixed",
    left: Math.max(8, Math.min(at.left, innerWidth - 244)),
    top: Math.max(8, Math.min(at.top, innerHeight - items.length * ITEM_H - 12)),
  };
  return (
    <div
      className="menu-backdrop"
      onPointerDown={onClose}
      onWheel={onClose}
      onContextMenu={(e) => (e.preventDefault(), onClose())}
    >
      <div
        ref={menu}
        role="menu"
        className={cx("menu", className)}
        style={style}
        onPointerDown={(e) => e.stopPropagation()}
        onKeyDown={onKeyDown}
      >
        {items.map((it, i) =>
          it === "separator" ? (
            <hr key={`sep-${i}`} />
          ) : (
            <button
              type="button"
              key={it.label}
              role="menuitem"
              disabled={it.disabled}
              className={it.danger ? "danger" : undefined}
              onClick={() => (onClose(), it.onSelect())}
            >
              <span>{it.label}</span>
              {it.shortcut && <Kbd>{it.shortcut}</Kbd>}
            </button>
          ),
        )}
      </div>
    </div>
  );
}
