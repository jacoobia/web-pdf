import type { ReactNode } from "react";
import { Icon } from "./Icon";
import "./Disclosure.css";

export const Disclosure = ({ title, open, children }: { title: string; open?: boolean; children: ReactNode }) => (
  <details className="disclosure" open={open}>
    <summary>
      <Icon name="chevron" size={16} />
      {title}
    </summary>
    <div className="disclosure-body">{children}</div>
  </details>
);
