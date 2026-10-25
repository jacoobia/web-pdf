import {
  cloneElement,
  type ReactElement,
  type SyntheticEvent,
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
  useSyncExternalStore,
} from "react";
import { createPortal } from "react-dom";
import { cx } from "../../lib/cx";
import "./Tooltip.css";

type Tip = { text: string; shortcut?: string; anchor: HTMLElement };

const ID = "app-tooltip";
const DELAY = 450;
let tip: Tip | null = null;
let timer = 0;
let warmUntil = 0;
const subscribers = new Set<() => void>();
const publish = (next: Tip | null) => {
  tip = next;
  for (const s of subscribers) s();
};
const subscribe = (s: () => void) => (subscribers.add(s), () => void subscribers.delete(s));

function show(next: Tip) {
  clearTimeout(timer);
  const go = () => {
    if (!next.anchor.isConnected) return;
    if (next.shortcut || next.anchor.getAttribute("aria-label") !== next.text)
      next.anchor.setAttribute("aria-describedby", ID);
    publish(next);
  };
  // Moving straight from one tooltip to the next shows it at once, like native tooltips.
  if (tip || performance.now() < warmUntil) go();
  else timer = window.setTimeout(go, DELAY);
}

function hide() {
  clearTimeout(timer);
  if (!tip) return;
  if (tip.anchor.getAttribute("aria-describedby") === ID) tip.anchor.removeAttribute("aria-describedby");
  warmUntil = performance.now() + 300;
  publish(null);
}

type Handlers = {
  onPointerEnter?: (e: React.PointerEvent<HTMLElement>) => void;
  onPointerLeave?: (e: React.PointerEvent<HTMLElement>) => void;
  onPointerDown?: (e: React.PointerEvent<HTMLElement>) => void;
  onFocus?: (e: React.FocusEvent<HTMLElement>) => void;
  onBlur?: (e: React.FocusEvent<HTMLElement>) => void;
};

const chain =
  <E extends SyntheticEvent>(own: ((e: E) => void) | undefined, mine: (e: E) => void) =>
  (e: E) => {
    own?.(e);
    mine(e);
  };

/** Shows `text` (and an optional keyboard `shortcut`) next to the child on hover or keyboard focus. */
export function Tooltip({
  text,
  shortcut,
  children,
}: {
  text?: string;
  shortcut?: string;
  children: ReactElement<Handlers>;
}) {
  if (!text) return children;
  const own = children.props;
  return cloneElement(children, {
    onPointerEnter: chain(own.onPointerEnter, (e) => {
      if (e.pointerType !== "touch") show({ text, shortcut, anchor: e.currentTarget });
    }),
    onPointerLeave: chain(own.onPointerLeave, hide),
    onPointerDown: chain(own.onPointerDown, hide),
    onFocus: chain(own.onFocus, (e) => {
      if (e.currentTarget.matches(":focus-visible")) show({ text, shortcut, anchor: e.currentTarget });
    }),
    onBlur: chain(own.onBlur, hide),
  });
}

const GAP = 6;
const EDGE = 8;

/** Renders the one tooltip on screen. Mount once, near the root. */
export function TooltipHost() {
  const current = useSyncExternalStore(subscribe, () => tip);
  const box = useRef<HTMLDivElement>(null);
  const [place, setPlace] = useState<{ left: number; top: number; below: boolean } | null>(null);

  useLayoutEffect(() => {
    if (!current || !box.current) return setPlace(null);
    const a = current.anchor.getBoundingClientRect();
    const t = box.current.getBoundingClientRect();
    const below = a.bottom + GAP + t.height <= innerHeight - EDGE;
    setPlace({
      left: Math.max(EDGE, Math.min(a.left + a.width / 2 - t.width / 2, innerWidth - t.width - EDGE)),
      top: below ? a.bottom + GAP : a.top - GAP - t.height,
      below,
    });
  }, [current]);

  useEffect(() => {
    if (!current) return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && hide();
    window.addEventListener("scroll", hide, true);
    window.addEventListener("resize", hide);
    window.addEventListener("keydown", onKey);
    return () => {
      window.removeEventListener("scroll", hide, true);
      window.removeEventListener("resize", hide);
      window.removeEventListener("keydown", onKey);
    };
  }, [current]);

  if (!current || !current.anchor.isConnected) return null;
  return createPortal(
    <div
      ref={box}
      id={ID}
      role="tooltip"
      className={cx("tooltip", place && "shown", place && (place.below ? "below" : "above"))}
      style={place ? { left: place.left, top: place.top } : { left: 0, top: 0, visibility: "hidden" }}
    >
      <span>{current.text}</span>
      {current.shortcut && <kbd className="kbd">{current.shortcut}</kbd>}
    </div>,
    document.body,
  );
}
