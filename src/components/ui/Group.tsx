import type { ReactNode } from "react";
import { cx } from "../../lib/cx";
import "./Group.css";

export const Group = ({ label, plain, children }: { label: string; plain?: boolean; children: ReactNode }) => (
  <div className={cx("group", plain && "plain")} role="group" aria-label={label}>
    {children}
  </div>
);
