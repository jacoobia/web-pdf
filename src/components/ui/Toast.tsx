import { cx } from "../../lib/cx";
import { Button } from "./Button";
import { Icon } from "./Icon";
import { Spinner } from "./Text";
import "./Toast.css";

export function Toast({
  ok,
  busy,
  lines,
  onDismiss,
}: {
  ok: boolean;
  busy?: boolean;
  lines: string[];
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
      {!busy && (
        <Button variant="ghost" size="small" onClick={onDismiss}>
          Dismiss
        </Button>
      )}
    </div>
  );
}
