const WIDGET = "https://bugdrop.neonwatty.workers.dev/widget.js";

type BugDrop = { open(): void; isOpen(): boolean };
const bugdrop = () => (window as unknown as { BugDrop?: BugDrop }).BugDrop;

let loading: Promise<BugDrop> | undefined;

function load(repo: string) {
  const css = getComputedStyle(document.documentElement);
  const token = (name: string) => css.getPropertyValue(name).trim();
  return new Promise<BugDrop>((resolve, reject) => {
    const script = document.createElement("script");
    script.src = WIDGET;
    Object.assign(script.dataset, {
      repo,
      button: "false",
      theme: document.documentElement.dataset.theme === "dark" ? "dark" : "light",
      color: token("--accent"),
      bg: token("--surface"),
      text: token("--text"),
      borderColor: token("--border"),
      shadow: "none",
      radius: token("--radius-lg"),
      font: '"IBM Plex Sans", system-ui, sans-serif',
    });
    const ready = () => {
      const api = bugdrop();
      if (api) resolve(api);
    };
    window.addEventListener("bugdrop:ready", ready, { once: true });
    script.onload = ready;
    script.onerror = () => reject(new Error("the feedback form couldn't load. A content blocker may be stopping it."));
    setTimeout(() => reject(new Error("the feedback form took too long to load.")), 15_000);
    document.head.append(script);
  });
}

// BugDrop ticks "Include a screenshot" by default; untick each new form once so screenshots are opt-in.
function untickScreenshot(form: ShadowRoot) {
  const box = form.querySelector<HTMLInputElement>("#include-screenshot");
  if (!box || box.dataset.unticked) return;
  box.dataset.unticked = "1";
  box.checked = false;
  box.dispatchEvent(new Event("change", { bubbles: true }));
}

// Viewport captures skip BugDrop's masks, so masked content is hidden outright while the form is open.
function whileOpen(api: BugDrop) {
  const root = document.documentElement;
  root.classList.add("feedback-open");
  const form = document.getElementById("bugdrop-host")?.shadowRoot;
  const watch = new MutationObserver(() => form && untickScreenshot(form));
  if (form) {
    watch.observe(form, { childList: true, subtree: true });
    untickScreenshot(form);
  }
  const check = setInterval(() => {
    if (api.isOpen()) return;
    clearInterval(check);
    watch.disconnect();
    root.classList.remove("feedback-open");
  }, 500);
}

// The widget is a third-party script, so it's only fetched when someone asks to send feedback.
export async function openFeedback(repo: string) {
  loading ??= load(repo).catch((err) => {
    loading = undefined;
    throw err;
  });
  const api = await loading;
  api.open();
  whileOpen(api);
}
