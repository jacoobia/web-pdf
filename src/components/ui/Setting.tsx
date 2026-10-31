import type { ReactNode } from "react";
import "./Setting.css";

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
