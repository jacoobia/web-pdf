import { useState } from "react";
import { Button } from "./Button";

/** A destructive action that can't be undone: the first click asks, the second does it. */
export function ConfirmButton({
  label,
  confirm,
  onConfirm,
}: {
  label: string;
  confirm: string;
  onConfirm: () => unknown;
}) {
  const [sure, setSure] = useState(false);
  return (
    <Button
      variant="ghost"
      tone={sure ? "danger" : undefined}
      onClick={() => (sure ? (setSure(false), onConfirm()) : setSure(true))}
      onBlur={() => setSure(false)}
    >
      {sure ? confirm : label}
    </Button>
  );
}
