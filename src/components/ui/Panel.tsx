import type { ComponentProps } from "react";
import { cx } from "../../lib/cx";
import "./Panel.css";

export const Panel = ({
  label,
  floating,
  className,
  ...props
}: { label: string; floating?: boolean } & ComponentProps<"aside">) => (
  <aside className={cx("panel", floating && "floating", className)} aria-label={label} {...props} />
);
