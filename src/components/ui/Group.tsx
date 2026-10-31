import type { ReactNode } from "react";
import "./Group.css";

export const Group = ({ label, children }: { label: string; children: ReactNode }) => (
  <div className="group" role="group" aria-label={label}>
    {children}
  </div>
);
