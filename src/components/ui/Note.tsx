import type { ReactNode } from "react";
import { cx } from "../../lib/cx";
import "./Note.css";

export const Note = ({ ok, children }: { ok?: boolean; children: ReactNode }) => (
  <div className={cx("note", ok && "ok")}>{children}</div>
);
