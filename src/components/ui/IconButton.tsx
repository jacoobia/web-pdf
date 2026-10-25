import type { ComponentProps } from "react";
import { cx } from "../../lib/cx";
import { Icon, type IconName } from "./Icon";
import { Tooltip } from "./Tooltip";
import "./IconButton.css";

type Props = { icon: IconName; label: string; shortcut?: string; active?: boolean };

export function IconButton({
  icon,
  label,
  shortcut,
  active,
  className,
  ...props
}: Props & Omit<ComponentProps<"button">, "children">) {
  return (
    <Tooltip text={label} shortcut={shortcut}>
      <button
        type="button"
        className={cx("tool", active && "on", className)}
        aria-label={label}
        aria-pressed={active}
        {...props}
      >
        <Icon name={icon} />
      </button>
    </Tooltip>
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
    <Tooltip text={label}>
      <a href={href} className={cx("tool", className)} target="_blank" rel="noreferrer" aria-label={label} {...props}>
        <Icon name={icon} />
      </a>
    </Tooltip>
  );
}
