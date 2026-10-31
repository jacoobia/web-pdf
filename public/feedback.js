// Runs in a sandboxed frame with no access to the editor, its storage or the open PDF.
const params = new URLSearchParams(location.hash.slice(1));
const tell = (type, message) => parent.postMessage({ bugdrop: type, message }, "*");
document.documentElement.style.colorScheme = params.get("theme");

// BugDrop ticks "Include a screenshot" by default; untick it once, as this frame would only capture itself.
function untickScreenshot(form) {
  const box = form.querySelector("#include-screenshot");
  if (!box || box.dataset.unticked) return;
  box.dataset.unticked = "1";
  box.checked = false;
  box.dispatchEvent(new Event("change", { bubbles: true }));
}

function watch(api) {
  const form = document.getElementById("bugdrop-host")?.shadowRoot;
  if (form) {
    new MutationObserver(() => untickScreenshot(form)).observe(form, { childList: true, subtree: true });
    untickScreenshot(form);
  }
  const check = setInterval(() => {
    if (api.isOpen()) return;
    clearInterval(check);
    tell("closed");
  }, 300);
}

const script = document.createElement("script");
script.src = "https://bugdrop.neonwatty.workers.dev/widget.js";
Object.assign(script.dataset, {
  repo: params.get("repo"),
  button: "false",
  theme: params.get("theme"),
  color: params.get("color"),
  bg: params.get("bg"),
  text: params.get("text"),
  borderColor: params.get("border"),
  shadow: "none",
  radius: params.get("radius"),
  font: '"IBM Plex Sans", system-ui, sans-serif',
});
let started = false;
const ready = () => {
  if (started || !window.BugDrop) return;
  started = true;
  window.BugDrop.open();
  tell("ready");
  watch(window.BugDrop);
};
window.addEventListener("bugdrop:ready", ready, { once: true });
script.onload = ready;
script.onerror = () => tell("error", "the feedback form couldn't load. A content blocker may be stopping it.");
document.head.append(script);
