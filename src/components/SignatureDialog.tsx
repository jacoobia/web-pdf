import { type PointerEvent, useEffect, useRef, useState } from "react";
import type { Editor } from "../lib/editor";
import { rememberSignature, SCRIPT_FONT, savedSignature, trimmed, typedSignature } from "../lib/signature";
import { Button, Checkbox, Dialog, Field, Muted, Segmented, Swatches, TextInput } from "./ui";
import "./SignatureDialog.css";

const INKS = [
  ["Black", "#111111"],
  ["Blue", "#1D3B8F"],
] as const;

export function SignatureDialog({ editor }: { editor: Editor }) {
  if (!editor.signing) return null;
  return <Signing editor={editor} />;
}

function Signing({ editor }: { editor: Editor }) {
  const [saved, setSaved] = useState(savedSignature);
  const [mode, setMode] = useState<"saved" | "draw" | "type">(saved ? "saved" : "draw");
  const [ink, setInk] = useState<string>(INKS[0][1]);
  const [name, setName] = useState("");
  const [drawn, setDrawn] = useState(false);
  const [remember, setRemember] = useState(false);
  const pad = useRef<HTMLCanvasElement>(null);
  const last = useRef<{ x: number; y: number } | null>(null);

  // biome-ignore lint/correctness/useExhaustiveDependencies: the pad is a new canvas each time Draw is shown
  useEffect(() => {
    const c = pad.current;
    if (!c) return;
    c.width = c.clientWidth * devicePixelRatio;
    c.height = c.clientHeight * devicePixelRatio;
    setDrawn(false);
  }, [mode]);

  const point = (e: PointerEvent<HTMLCanvasElement>) => {
    const r = e.currentTarget.getBoundingClientRect();
    return { x: (e.clientX - r.left) * devicePixelRatio, y: (e.clientY - r.top) * devicePixelRatio };
  };
  const stroke = (e: PointerEvent<HTMLCanvasElement>) => {
    const from = last.current;
    if (!from) return;
    const to = point(e);
    const ctx = e.currentTarget.getContext("2d")!;
    ctx.strokeStyle = ink;
    ctx.lineWidth = 2.5 * devicePixelRatio;
    ctx.lineCap = "round";
    ctx.lineJoin = "round";
    ctx.beginPath();
    ctx.moveTo(from.x, from.y);
    ctx.lineTo(to.x, to.y);
    ctx.stroke();
    last.current = to;
    setDrawn(true);
  };
  const clear = () => {
    const c = pad.current!;
    c.getContext("2d")!.clearRect(0, 0, c.width, c.height);
    setDrawn(false);
  };

  const ready = mode === "saved" ? !!saved : mode === "draw" ? drawn : !!name.trim();
  const add = async () => {
    const url =
      mode === "saved"
        ? saved!
        : (mode === "draw" ? trimmed(pad.current!) : typedSignature(name.trim(), ink))?.toDataURL("image/png");
    if (!url) return;
    if (remember && mode !== "saved") rememberSignature(url);
    await editor.placeSignature(await (await fetch(url)).blob());
  };

  return (
    <Dialog
      title="Add a signature"
      onClose={() => editor.setSigning(null)}
      bodyClass="signature"
      tabs={
        <Segmented
          role="tab"
          label="How to sign"
          value={mode}
          onChange={setMode}
          options={[...(saved ? [["saved", "Saved"] as const] : []), ["draw", "Draw"], ["type", "Type"]]}
        />
      }
      footer={
        <>
          <Button variant="ghost" onClick={() => editor.setSigning(null)}>
            Cancel
          </Button>
          <Button variant="primary" disabled={!ready} onClick={add}>
            Add signature
          </Button>
        </>
      }
    >
      <Muted>
        This places a picture of your signature on the page. It isn't a certificate-based digital signature.
      </Muted>
      {mode === "saved" && saved && (
        <>
          <div className="signature-box">
            <img src={saved} alt="Your saved signature" />
          </div>
          <div>
            <Button
              variant="ghost"
              tone="danger"
              onClick={() => (rememberSignature(null), setSaved(null), setMode("draw"))}
            >
              Forget this signature
            </Button>
          </div>
        </>
      )}
      {mode === "draw" && (
        <>
          <canvas
            ref={pad}
            className="signature-box signature-pad"
            aria-label="Draw your signature here"
            onPointerDown={(e) => (e.currentTarget.setPointerCapture(e.pointerId), (last.current = point(e)))}
            onPointerMove={stroke}
            onPointerUp={() => (last.current = null)}
          />
          <div className="signature-row">
            <Muted inline>Sign with your mouse, finger or pen.</Muted>
            <Button variant="ghost" disabled={!drawn} onClick={clear}>
              Clear
            </Button>
          </div>
        </>
      )}
      {mode === "type" && (
        <>
          <Field label="Your name">
            <TextInput value={name} autoComplete="name" onChange={(e) => setName(e.target.value)} />
          </Field>
          <div className="signature-box signature-typed" style={{ fontFamily: SCRIPT_FONT, color: ink }}>
            {name}
          </div>
        </>
      )}
      {mode !== "saved" && (
        <>
          <Swatches label="Ink colour" value={ink} options={INKS} onChange={setInk} />
          <Checkbox
            label="Remember this signature on this device"
            checked={remember}
            onChange={(e) => setRemember(e.target.checked)}
          />
        </>
      )}
    </Dialog>
  );
}
