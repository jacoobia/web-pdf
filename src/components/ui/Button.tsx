import type { ComponentProps, ReactNode } from "react";
import { cx } from "../../lib/cx";
import "./Button.css";

type Look = { variant?: "primary" | "ghost"; tone?: "danger"; size?: "small" };

const classes = ({ variant, tone, size }: Look, className?: string) => cx("btn", variant, tone, size, className);

export function Button({ variant, tone, size, className, ...props }: ComponentProps<"button"> & Look) {
  return <button type="button" className={classes({ variant, tone, size }, className)} {...props} />;
}

export function ButtonLink({ variant, tone, size, className, ...props }: ComponentProps<"a"> & Look) {
  return (
    <a target="_blank" rel="noreferrer" className={classes({ variant, tone, size }, className)} {...props}>
      {props.children}
    </a>
  );
}

export function FileButton({
  accept,
  multiple,
  onFiles,
  children,
  ...look
}: Look & { accept: string; multiple?: boolean; onFiles: (files: FileList | null) => void; children: ReactNode }) {
  return (
    <label className={classes(look)}>
      {children}
      <input
        type="file"
        accept={accept}
        multiple={multiple}
        hidden
        onChange={(e) => (onFiles(e.target.files), (e.target.value = ""))}
      />
    </label>
  );
}
