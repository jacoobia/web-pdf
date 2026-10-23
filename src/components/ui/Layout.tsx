import type { ReactNode } from "react";
import { cx } from "../../lib/cx";
import "./Layout.css";

export const Grid = ({ cols = 2, children }: { cols?: 2 | 3; children: ReactNode }) => (
  <div className={cx("grid", cols === 3 && "three")}>{children}</div>
);

export const Row = ({ children }: { children: ReactNode }) => <div className="row">{children}</div>;

export const Stack = ({ gap = "md", children }: { gap?: "sm" | "md" | "lg"; children: ReactNode }) => (
  <div className={`stack ${gap}`}>{children}</div>
);

export const Section = ({ title, label, children }: { title?: ReactNode; label?: string; children: ReactNode }) => (
  <section className="section" aria-label={label}>
    {title && <h2 className="section-title">{title}</h2>}
    {children}
  </section>
);
