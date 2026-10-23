import type { ReactNode } from "react";
import "./Setting.css";

export const SettingGroup = ({ title, children }: { title: string; children: ReactNode }) => (
  <section className="setting-group" aria-label={title}>
    <h3>{title}</h3>
    {children}
  </section>
);

export const Setting = ({
  title,
  description,
  children,
}: {
  title: string;
  description: ReactNode;
  children: ReactNode;
}) => (
  <div className="setting">
    <div className="setting-text">
      <p>{title}</p>
      <span>{description}</span>
    </div>
    <div className="setting-control">{children}</div>
  </div>
);
