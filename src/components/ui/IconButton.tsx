import type { ComponentProps } from "react";
import { cx } from "../../lib/cx";
import { Icon, type IconName } from "./Icon";
import "./IconButton.css";

type Props = { icon: IconName; label: string; shortcut?: string; active?: boolean };

const title = (label: string, shortcut?: string) => (shortcut ? `${label} (${shortcut})` : label);

export function IconButton({
  icon,
  label,
  shortcut,
  active,
  className,
  ...props
}: Props & Omit<ComponentProps<"button">, "children">) {
  return (
    <button
      type="button"
      className={cx("tool", active && "on", className)}
      aria-label={label}
      aria-pressed={active}
      title={title(label, shortcut)}
      {...props}
    >
      <Icon name={icon} />
    </button>
  );
}

export function IconLink({
  icon,
  label,
  href,
  className,
  ...props
}: Props & { href: string } & Omit<ComponentProps<"a">, "children" | "href">) {
  return (
    <a
      href={href}
      className={cx("tool", className)}
      target="_blank"
      rel="noreferrer"
      aria-label={label}
      title={label}
      {...props}
    >
      <Icon name={icon} />
    </a>
  );
}
