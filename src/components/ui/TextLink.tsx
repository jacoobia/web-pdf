import type { ReactNode } from "react";
import "./TextLink.css";

type Props = { children: ReactNode } & ({ href: string; onClick?: never } | { href?: never; onClick: () => void });

export function TextLink({ href, onClick, children }: Props) {
  return href ? (
    <a className="link" href={href} target="_blank" rel="noreferrer">
      {children}
    </a>
  ) : (
    <button type="button" className="link" onClick={onClick}>
      {children}
    </button>
  );
}
