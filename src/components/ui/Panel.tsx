import type { ReactNode } from "react";
import { cx } from "../../lib/cx";
import "./Panel.css";

export const Panel = ({
  label,
  floating,
  className,
  children,
}: {
  label: string;
  floating?: boolean;
  className?: string;
  children: ReactNode;
}) => (
  <aside className={cx("panel", floating && "floating", className)} aria-label={label}>
    {children}
  </aside>
);
