import type { ReactNode } from "react";
import { cx } from "../../lib/cx";
import "./Setting.css";

export const Setting = ({
  title,
  description,
  className,
  children,
}: {
  title: string;
  description: ReactNode;
  className?: string;
  children: ReactNode;
}) => (
  <div className={cx("setting", className)}>
    <div className="setting-text">
      <p>{title}</p>
      <span>{description}</span>
    </div>
    <div className="setting-control">{children}</div>
  </div>
);
