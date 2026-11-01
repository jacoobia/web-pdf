// The guide, feedback, settings, the start screen and stored data.
import assert from "node:assert/strict";
import { LARGE } from "./fixtures.ts";
import { test, url } from "./harness.ts";
import { closePdf } from "./helpers.ts";

await test("the guide opens from ?, the header and the start screen, and moves between topics", async ({
  page,
  open,
}) => {
  const guide = page.getByRole("dialog", { name: "Guide" });
  const heading = guide.locator("article h3");
  await page.goto(url);
  await page.getByRole("button", { name: "Guide", exact: true }).click();
  assert.equal(await heading.innerText(), "Opening a PDF");
  await page.keyboard.press("Escape");
  await open();
  await page.locator('.el[aria-label="Jane Example"]').dblclick();
  await page.locator(".panel textarea").press("?");
  assert.equal(await guide.count(), 0, "typing ? in text doesn't open it");
  await page.keyboard.press("Escape");
  await page.locator(".pages").click({ position: { x: 5, y: 5 } });
  await page.keyboard.press("?");
  await guide.getByRole("button", { name: "Editing text" }).click();
  assert.equal(await heading.innerText(), "Editing text");
  await guide.locator("article").getByRole("button", { name: "fonts" }).click();
  assert.equal(await heading.innerText(), "Fonts");
  await guide.getByRole("button", { name: "Next: Find and replace" }).click();
  assert.equal(await heading.innerText(), "Find and replace");
  await page.keyboard.press("Escape");
  await guide.waitFor({ state: "detached" });
  await page.getByRole("button", { name: "Guide", exact: true }).click();
  assert.equal(await heading.innerText(), "Opening a PDF");
  await page.keyboard.press("Escape");
  await page.getByRole("button", { name: "More in the guide" }).click();
  assert.equal(await heading.innerText(), "Editing text", "opens at the topic it was asked for");
  const filter = guide.getByRole("textbox", { name: "Filter topics" });
  await filter.fill("page count");
  assert.deepEqual(await guide.locator("nav button").allInnerTexts(), ["Headers and footers"], "matches article text");
  await filter.press("Enter");
  assert.equal(await heading.innerText(), "Headers and footers");
  await page.keyboard.press("Escape");
  await page.keyboard.press("Control+k");
  assert.equal(await page.evaluate(() => document.activeElement?.getAttribute("aria-label")), "Filter topics");
  await filter.fill("zzz");
  await guide.getByText("No topics match.").waitFor();
  await filter.fill("");
  for (const topic of await guide.locator("nav button").allInnerTexts()) {
    await guide.getByRole("button", { name: topic, exact: true }).click();
    const img = guide.locator(".guide-media img");
    if (!(await img.count())) continue;
    await page.waitForFunction((n) => (n as HTMLImageElement).complete, await img.elementHandle());
    assert.ok(await img.evaluate((n) => (n as HTMLImageElement).naturalWidth > 0), `${topic} has its picture`);
  }
});

const WIDGET_STUB = `let open = false;
window.BugDrop = {
  open() {
    open = true;
    const b = document.createElement("button");
    b.textContent = "Close feedback";
    b.onclick = () => (open = false);
    document.body.append(b);
  },
  isOpen: () => open,
};
dispatchEvent(new CustomEvent("bugdrop:ready"));`;

await test("feedback runs in a sandboxed frame that can't reach the page or its storage", async ({ page, open }) => {
  await page.route("https://bugdrop.neonwatty.workers.dev/widget.js", (r) =>
    r.fulfill({ contentType: "text/javascript", body: WIDGET_STUB }),
  );
  await open();
  await page.getByRole("button", { name: "Send feedback" }).click();
  const frame = page.frameLocator("#feedback-frame");
  await frame.getByRole("button", { name: "Close feedback" }).waitFor();
  const reach = await page
    .frames()
    .find((f) => f.url().includes("feedback.html"))!
    .evaluate(() => {
      const can = (f: () => unknown) => {
        try {
          f();
          return true;
        } catch {
          return false;
        }
      };
      return { page: can(() => parent.document.title), storage: can(() => localStorage.length), origin: origin };
    });
  assert.deepEqual(reach, { page: false, storage: false, origin: "null" });
  await frame.getByRole("button", { name: "Close feedback" }).click();
  await page.locator("#feedback-frame").waitFor({ state: "detached" });
});

await test("settings are split into tabs, and margin size shows only with the margin on", async ({ page }) => {
  await page.goto(url);
  await page.getByRole("button", { name: "Settings" }).click();
  assert.equal(await page.getByRole("tab", { name: "Appearance" }).getAttribute("aria-selected"), "true");
  await page.getByRole("tab", { name: "Editing" }).click();
  const size = page.getByRole("spinbutton", { name: "Margin size in points" });
  assert.equal(await size.count(), 0, "hidden while the margin is off");
  await page.getByRole("switch", { name: "Keep inside the margin" }).click();
  await size.waitFor();
  await page.getByRole("tab", { name: "Privacy" }).click();
  assert.equal(await page.getByRole("button", { name: "Reset to defaults" }).count(), 0);
});

await test("the header's delete button removes the selection and is off with nothing selected", async ({
  page,
  open,
}) => {
  await open();
  const del = page.getByRole("button", { name: "Delete the selection" });
  assert.equal(await del.isDisabled(), true);
  await page.locator('.el[aria-label="Jane Example"]').click();
  await del.click();
  assert.equal(await page.locator('.el[aria-label="Jane Example"]').count(), 0);
  assert.equal(await del.isDisabled(), true, "nothing left selected");
});

await test("the start screen's drop box opens the file picker when clicked", async ({ page }) => {
  await page.goto(url);
  await page.evaluate(() => {
    const w = window as unknown as Record<string, unknown>;
    w.showOpenFilePicker = async () => {
      w.__picked = true;
      throw new DOMException("Closed", "AbortError");
    };
  });
  await page.getByRole("button", { name: /Drop a PDF here/ }).click();
  await page.waitForFunction(() => (window as unknown as { __picked?: boolean }).__picked);
  const drop = page.locator(".drop");
  const dataTransfer = await page.evaluateHandle(() => {
    const d = new DataTransfer();
    d.items.add(new File(["%PDF"], "cv.pdf", { type: "application/pdf" }));
    return d;
  });
  await drop.dispatchEvent("dragenter", { dataTransfer });
  assert.ok(await drop.evaluate((n) => n.classList.contains("over")), "highlights while a file is over it");
  assert.match(await drop.innerText(), /Drop to open/);
  await drop.dispatchEvent("dragleave", { dataTransfer });
  assert.ok(!(await drop.evaluate((n) => n.classList.contains("over"))), "settles when the file leaves");
});

await test("the start screen's clear list removes every recent file and its stored copy", async ({ page, open }) => {
  await open();
  await closePdf(page);
  await open(LARGE);
  await closePdf(page);
  assert.equal(await page.locator(".recent li").count(), 2);
  await page.getByRole("button", { name: "Clear list" }).click();
  await page.getByRole("button", { name: "Yes, clear the list" }).click();
  await page.locator(".recent").waitFor({ state: "detached" });
  await page.waitForTimeout(200);
  const files = await page.evaluate(
    () =>
      new Promise<number>((ok) => {
        const r = indexedDB.open("pdf-editor", 3);
        r.onsuccess = () => {
          const c = r.result.transaction("files").objectStore("files").count();
          c.onsuccess = () => ok(c.result);
        };
      }),
  );
  assert.equal(files, 0, "stored copies are deleted too");
});

await test("clearing stored data removes recent files, copies, drafts and the saved signature", async ({
  page,
  open,
}) => {
  await open();
  await page.evaluate(() => localStorage.setItem("signature", "data:image/png;base64,"));
  await closePdf(page);
  await page.locator(".recent").waitFor();
  await page.getByRole("button", { name: "Settings" }).click();
  await page.getByRole("tab", { name: "Privacy" }).click();
  await page.getByRole("button", { name: "Clear", exact: true }).click();
  await page.getByRole("button", { name: "Yes, clear everything" }).click();
  await page.getByText("Cleared").waitFor();
  await page.keyboard.press("Escape");
  assert.equal(await page.locator(".recent").count(), 0, "recent list gone");
  const left = await page.evaluate(async () => {
    const db = await new Promise<IDBDatabase>((ok) => {
      const r = indexedDB.open("pdf-editor", 3);
      r.onsuccess = () => ok(r.result);
    });
    const count = (s: string) =>
      new Promise<number>((ok) => {
        const r = db.transaction(s).objectStore(s).count();
        r.onsuccess = () => ok(r.result);
      });
    return { files: await count("files"), drafts: await count("drafts"), signature: localStorage.getItem("signature") };
  });
  assert.deepEqual(left, { files: 0, drafts: 0, signature: null });
});
