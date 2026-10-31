import { cx } from "../../lib/cx";
import { Button } from "./Button";
import { Icon } from "./Icon";
import { Spinner } from "./Text";
import "./Toast.css";

export type ToastAction = { label: string; onClick: () => void };

export function Toast({
  ok,
  busy,
  lines,
  action,
  onDismiss,
}: {
  ok: boolean;
  busy?: boolean;
  lines: string[];
  action?: ToastAction;
  onDismiss: () => void;
}) {
  return (
    <div className={cx("toast", !busy && (ok ? "ok" : "bad"))} role={ok ? "status" : "alert"}>
      {busy ? (
        <Spinner />
      ) : (
        <span className="toast-icon">
          <Icon name={ok ? "check" : "alert"} />
        </span>
      )}
      <div className="toast-body">
        {lines.map((l) => (
          <p key={l}>{l}</p>
        ))}
      </div>
      {action && (
        <Button variant="primary" size="small" onClick={action.onClick}>
          {action.label}
        </Button>
      )}
      {!busy && (
        <Button variant="ghost" size="small" onClick={onDismiss}>
          Dismiss
        </Button>
      )}
    </div>
  );
}
