// The BugDrop widget is a third-party script, so it runs in a sandboxed frame that can't see the
// page, its storage or the open PDF. It's only loaded when someone asks to send feedback.
export function openFeedback(repo: string) {
  if (document.getElementById("feedback-frame")) return Promise.resolve();
  const css = getComputedStyle(document.documentElement);
  const token = (name: string) => css.getPropertyValue(name).trim();
  const params = new URLSearchParams({
    repo,
    theme: document.documentElement.dataset.theme === "dark" ? "dark" : "light",
    color: token("--accent"),
    bg: token("--surface"),
    text: token("--text"),
    border: token("--border"),
    radius: token("--radius-lg"),
  });
  const frame = document.createElement("iframe");
  frame.id = "feedback-frame";
  frame.title = "Send feedback";
  frame.sandbox.add("allow-scripts", "allow-forms", "allow-popups", "allow-popups-to-escape-sandbox");
  frame.src = `${import.meta.env.BASE_URL}feedback.html#${params}`;

  return new Promise<void>((resolve, reject) => {
    const close = () => {
      frame.remove();
      window.removeEventListener("message", onMessage);
      clearTimeout(timer);
    };
    const fail = (message: string) => {
      close();
      reject(new Error(message));
    };
    const onMessage = (e: MessageEvent) => {
      if (e.source !== frame.contentWindow) return;
      const { bugdrop, message } = e.data ?? {};
      if (bugdrop === "ready") {
        clearTimeout(timer);
        frame.focus();
        resolve();
      } else if (bugdrop === "closed") close();
      else if (bugdrop === "error") fail(message);
    };
    const timer = setTimeout(() => fail("the feedback form took too long to load."), 15_000);
    window.addEventListener("message", onMessage);
    document.body.append(frame);
  });
}
