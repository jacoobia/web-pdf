// Presentational pieces shared by the header, panels and Settings: icons, tool groups, segmented controls, switches.
import { useEffect, useRef, type CSSProperties, type KeyboardEvent, type ReactNode } from "react";

const p = (d: string) => <path d={d} />;
const ICONS = {
  open: p("m6 14 1.5-2.9A2 2 0 0 1 9.24 10H20a2 2 0 0 1 1.94 2.5l-1.54 6a2 2 0 0 1-1.95 1.5H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h3.9a2 2 0 0 1 1.69.9l.81 1.2a2 2 0 0 0 1.67.9H18a2 2 0 0 1 2 2v2"),
  close: <>{p("M18 6 6 18")}{p("m6 6 12 12")}</>,
  undo: <>{p("M9 14 4 9l5-5")}{p("M4 9h10.5a5.5 5.5 0 0 1 0 11H11")}</>,
  redo: <>{p("m15 14 5-5-5-5")}{p("M20 9H9.5a5.5 5.5 0 0 0 0 11H13")}</>,
  pointer: p("M4.037 4.688a.495.495 0 0 1 .651-.651l16 6.5a.5.5 0 0 1-.063.947l-6.124 1.58a2 2 0 0 0-1.438 1.435l-1.579 6.126a.5.5 0 0 1-.947.063z"),
  text: <>{p("M4 7V4h16v3")}{p("M9 20h6")}{p("M12 4v16")}</>,
  minus: p("M5 12h14"),
  plus: <>{p("M5 12h14")}{p("M12 5v14")}</>,
  fit: <>{p("M8 3H5a2 2 0 0 0-2 2v3")}{p("M21 8V5a2 2 0 0 0-2-2h-3")}{p("M3 16v3a2 2 0 0 0 2 2h3")}{p("M16 21h3a2 2 0 0 0 2-2v-3")}</>,
  panelRight: <><rect x="3" y="3" width="18" height="18" rx="2" />{p("M15 3v18")}</>,
  panelLeft: <><rect x="3" y="3" width="18" height="18" rx="2" />{p("M9 3v18")}</>,
  sun: <><circle cx="12" cy="12" r="4" />{p("M12 2v2M12 20v2m-7.07-17.07 1.41 1.41m11.32 11.32 1.41 1.41M2 12h2m16 0h2M6.34 17.66l-1.41 1.41M19.07 4.93l-1.41 1.41")}</>,
  moon: p("M12 3a6 6 0 0 0 9 9 9 9 0 1 1-9-9Z"),
  settings: <>{p("M12.22 2h-.44a2 2 0 0 0-2 2v.18a2 2 0 0 1-1 1.73l-.43.25a2 2 0 0 1-2 0l-.15-.08a2 2 0 0 0-2.73.73l-.22.38a2 2 0 0 0 .73 2.73l.15.1a2 2 0 0 1 1 1.72v.51a2 2 0 0 1-1 1.74l-.15.09a2 2 0 0 0-.73 2.73l.22.38a2 2 0 0 0 2.73.73l.15-.08a2 2 0 0 1 2 0l.43.25a2 2 0 0 1 1 1.73V20a2 2 0 0 0 2 2h.44a2 2 0 0 0 2-2v-.18a2 2 0 0 1 1-1.73l.43-.25a2 2 0 0 1 2 0l.15.08a2 2 0 0 0 2.73-.73l.22-.39a2 2 0 0 0-.73-2.73l-.15-.08a2 2 0 0 1-1-1.74v-.5a2 2 0 0 1 1-1.74l.15-.09a2 2 0 0 0 .73-2.73l-.22-.38a2 2 0 0 0-2.73-.73l-.15.08a2 2 0 0 1-2 0l-.43-.25a2 2 0 0 1-1-1.73V4a2 2 0 0 0-2-2z")}<circle cx="12" cy="12" r="3" /></>,
  file: <>{p("M15 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7Z")}{p("M14 2v4a2 2 0 0 0 2 2h4")}{p("M16 13H8M16 17H8M10 9H8")}</>,
  check: p("M20 6 9 17l-5-5"),
  alert: <><circle cx="12" cy="12" r="10" />{p("M12 8v4M12 16h.01")}</>,
  chevron: p("m6 9 6 6 6-6"),
} satisfies Record<string, ReactNode>;
export type IconName = keyof typeof ICONS;

export const Icon = ({ name, size = 16 }: { name: IconName; size?: number }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}
    strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    {ICONS[name]}
  </svg>
);

/** An icon button. `active` marks a toggled tool; the shortcut goes in the tooltip. */
export function Tool({ icon, label, onClick, active, disabled, shortcut }: {
  icon: IconName; label: string; onClick: () => void; active?: boolean; disabled?: boolean; shortcut?: string;
}) {
  return (
    <button className={active ? "tool on" : "tool"} aria-label={label} aria-pressed={active} title={shortcut ? `${label} (${shortcut})` : label}
      onClick={onClick} disabled={disabled}>
      <Icon name={icon} />
    </button>
  );
}

/** Related tools sit together in one quiet container. */
export const Group = ({ label, children, plain }: { label: string; children: ReactNode; plain?: boolean }) => (
  <div className={plain ? "group plain" : "group"} role="group" aria-label={label}>{children}</div>
);

export function Segmented<T extends string>({ label, value, options, onChange, role = "radio" }: {
  label: string; value: T; options: readonly (readonly [T, string])[]; onChange: (v: T) => void; role?: "radio" | "tab";
}) {
  return (
    <div className="seg" role={role === "tab" ? "tablist" : "radiogroup"} aria-label={label}>
      {options.map(([v, l]) => (
        <button key={v} role={role} aria-checked={role === "radio" ? value === v : undefined}
          aria-selected={role === "tab" ? value === v : undefined} className={value === v ? "on" : ""} onClick={() => onChange(v)}>
          {l}
        </button>
      ))}
    </div>
  );
}

export const Switch = ({ label, checked, onChange }: { label: string; checked: boolean; onChange: (v: boolean) => void }) => (
  <button role="switch" aria-checked={checked} aria-label={label} className={checked ? "switch on" : "switch"} onClick={() => onChange(!checked)}>
    <span />
  </button>
);

export const ACCENTS = [["Teal", "#0F766E"], ["Blue", "#2563EB"], ["Amber", "#B45309"], ["Rose", "#BE123C"]] as const;
export const DEFAULT_PREFS = { theme: "system", uiStyle: "toolbar", accent: "#0F766E", side: "right", snap: "1", marginOn: "0", marginPt: "36" };
export type Prefs = typeof DEFAULT_PREFS;
const isHex = (s: string) => /^#[0-9a-f]{6}$/i.test(s);

/** The Settings window: appearance, layout and editing preferences. Changes apply immediately. */
export function Settings({ prefs, set, onClose }: {
  prefs: Prefs; set: <K extends keyof Prefs>(key: K, value: string) => void; onClose: () => void;
}) {
  const dialog = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const before = document.activeElement as HTMLElement | null;
    dialog.current?.querySelector<HTMLElement>("button, input")?.focus();
    return () => before?.focus?.();
  }, []);
  // Keep Tab inside the window while it's open.
  const onKeyDown = (e: KeyboardEvent) => {
    e.stopPropagation();
    if (e.key === "Escape") return onClose();
    if (e.key !== "Tab") return;
    const all = [...dialog.current!.querySelectorAll<HTMLElement>("button, input, select")].filter((n) => !(n as HTMLButtonElement).disabled);
    const [first, last] = [all[0], all.at(-1)!];
    if (e.shiftKey && document.activeElement === first) (e.preventDefault(), last.focus());
    else if (!e.shiftKey && document.activeElement === last) (e.preventDefault(), first.focus());
  };
  const mm = ((+prefs.marginPt || 0) / 72) * 25.4;
  return (
    <div className="scrim" onPointerDown={(e) => e.target === e.currentTarget && onClose()}>
      <div ref={dialog} className="dialog" role="dialog" aria-modal="true" aria-labelledby="settings-title" onKeyDown={onKeyDown}>
        <div className="dialog-head">
          <h2 id="settings-title">Settings</h2>
          <Tool icon="close" label="Close settings" onClick={onClose} />
        </div>
        <div className="dialog-body">
          <section className="settings-section" aria-label="Appearance">
            <h3>Appearance</h3>
            <div className="setting">
              <div><p>Theme</p><span>Also switchable from the header.</span></div>
              <Segmented label="Theme" value={prefs.theme} onChange={(v) => set("theme", v)}
                options={[["system", "System"], ["light", "Light"], ["dark", "Dark"]]} />
            </div>
            <div className="setting">
              <div><p>Interface style</p><span>Toolbar keeps a docked sidebar. Canvas adds page thumbnails and floating panels.</span></div>
              <Segmented label="Interface style" value={prefs.uiStyle} onChange={(v) => set("uiStyle", v)}
                options={[["toolbar", "Toolbar"], ["canvas", "Canvas"]]} />
            </div>
            <div className="setting">
              <div><p>Accent colour</p><span>Used for the Save button, selection and focus.</span></div>
              <div className="swatches" role="radiogroup" aria-label="Accent colour">
                {ACCENTS.map(([name, hex]) => (
                  <button key={hex} role="radio" aria-checked={prefs.accent.toLowerCase() === hex.toLowerCase()} aria-label={name} title={name}
                    className="swatch" style={{ "--swatch": hex } as CSSProperties} onClick={() => set("accent", hex)} />
                ))}
                <label className="swatch custom" title="Custom colour">
                  <Icon name="plus" size={14} />
                  <input type="color" aria-label="Custom accent colour" value={isHex(prefs.accent) ? prefs.accent : "#0f766e"}
                    onChange={(e) => set("accent", e.target.value)} />
                </label>
              </div>
            </div>
            <div className="accent-preview" aria-hidden="true">
              <span className="btn primary">Save</span>
              <span className="switch on"><span /></span>
              <span className="preview-sel">Selected text</span>
              <input type="text" className="hex" aria-label="Accent hex value" defaultValue={prefs.accent} key={prefs.accent}
                onChange={(e) => isHex(e.target.value) && set("accent", e.target.value)} />
            </div>
          </section>
          <section className="settings-section" aria-label="Layout">
            <h3>Layout</h3>
            <div className="setting">
              <div><p>Panel side</p><span>Which side the sidebar or floating panel sits on.</span></div>
              <Segmented label="Panel side" value={prefs.side} onChange={(v) => set("side", v)} options={[["left", "Left"], ["right", "Right"]]} />
            </div>
          </section>
          <section className="settings-section" aria-label="Editing">
            <h3>Editing</h3>
            <div className="setting">
              <div><p>Snap to other text</p><span>Hold Shift while dragging to move freely.</span></div>
              <Switch label="Snap to other text" checked={prefs.snap === "1"} onChange={(v) => set("snap", v ? "1" : "0")} />
            </div>
            <div className="setting">
              <div><p>Keep inside the margin</p><span>Dragging, arrow keys and new text stop at the dashed line.</span></div>
              <Switch label="Keep inside the margin" checked={prefs.marginOn === "1"} onChange={(v) => set("marginOn", v ? "1" : "0")} />
            </div>
            <div className="setting">
              <div><p>Margin size</p><span>{((+prefs.marginPt || 0) / 72).toFixed(2)} in, {mm.toFixed(1)} mm</span></div>
              <label className="unit-input">
                <input type="number" min="0" step="1" aria-label="Margin size in points" value={prefs.marginPt} onChange={(e) => set("marginPt", e.target.value)} />
                <span>pt</span>
              </label>
            </div>
          </section>
        </div>
        <div className="dialog-foot">
          <button className="btn ghost" onClick={() => (Object.keys(DEFAULT_PREFS) as (keyof Prefs)[]).forEach((k) => set(k, DEFAULT_PREFS[k]))}>
            Reset to defaults
          </button>
          <button className="btn primary" onClick={onClose}>Done</button>
        </div>
      </div>
    </div>
  );
}
