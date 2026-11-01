import { type KeyboardEvent, type ReactNode, useEffect, useId, useRef } from "react";
import { cx } from "../../lib/cx";
import { IconButton } from "./IconButton";
import { SheetHandle } from "./SheetHandle";
import "./Dialog.css";

const FOCUSABLE = "button, input, select, textarea, a[href]";

export function Dialog({
  title,
  onClose,
  tabs,
  footer,
  bodyClass,
  wide,
  children,
}: {
  title: string;
  onClose: () => void;
  tabs?: ReactNode;
  footer?: ReactNode;
  bodyClass?: string;
  wide?: boolean;
  children: ReactNode;
}) {
  const dialog = useRef<HTMLDivElement>(null);
  const titleId = useId();
  useEffect(() => {
    const before = document.activeElement as HTMLElement | null;
    dialog.current?.querySelector<HTMLElement>("button, input")?.focus();
    return () => before?.focus?.();
  }, []);
  const onKeyDown = (e: KeyboardEvent) => {
    e.stopPropagation();
    if (e.key === "Escape") return onClose();
    if (e.key !== "Tab") return;
    const all = [...dialog.current!.querySelectorAll<HTMLElement>(FOCUSABLE)].filter(
      (n) => !(n as HTMLButtonElement).disabled,
    );
    const [first, last] = [all[0], all.at(-1)!];
    if (e.shiftKey && document.activeElement === first) e.preventDefault(), last.focus();
    else if (!e.shiftKey && document.activeElement === last) e.preventDefault(), first.focus();
  };
  return (
    <div className="scrim" onPointerDown={(e) => e.target === e.currentTarget && onClose()}>
      <div
        ref={dialog}
        className={cx("dialog", wide && "wide")}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        onKeyDown={onKeyDown}
      >
        <SheetHandle onClose={onClose} />
        <div className="dialog-head">
          <h2 id={titleId}>{title}</h2>
          <IconButton icon="close" label={`Close ${title.toLowerCase()}`} onClick={onClose} />
        </div>
        {tabs && <div className="dialog-tabs">{tabs}</div>}
        <div className={cx("dialog-body", bodyClass)}>{children}</div>
        {footer && <div className="dialog-foot">{footer}</div>}
      </div>
    </div>
  );
}
