import type { ReactNode } from "react";
import { cx } from "../../lib/cx";
import "./Text.css";

export const Muted = ({ inline, children }: { inline?: boolean; children: ReactNode }) =>
  inline ? <span className="muted">{children}</span> : <p className="muted">{children}</p>;

export const Kbd = ({ children }: { children: ReactNode }) => <kbd className="kbd">{children}</kbd>;

export const Dot = ({ title }: { title?: string }) => <span className="dot" title={title} />;

export const Tag = ({ ok, children }: { ok?: boolean; children: ReactNode }) => (
  <span className={cx("tag", ok && "ok")}>{children}</span>
);

export const Badge = ({ title, children }: { title?: string; children: ReactNode }) => (
  <span className="badge" title={title}>
    <Dot />
    {children}
  </span>
);

export const Pre = ({ children }: { children: ReactNode }) => <pre className="pre">{children}</pre>;

export const Spinner = () => <span className="spinner" aria-hidden="true" />;

export const List = ({ items, variant }: { items: ReactNode[]; variant?: "muted" }) => (
  <ul className={cx("list", variant)}>
    {items.map((item, i) => (
      <li key={i}>{item}</li>
    ))}
  </ul>
);

export const Callout = ({ tone, children }: { tone?: "danger"; children: ReactNode }) => (
  <div className={cx("callout", tone)}>{children}</div>
);
