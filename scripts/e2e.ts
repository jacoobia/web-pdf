// Browser checks for the editor. Runs under Node (Playwright hangs under Bun on Windows) against a Vite dev server.
import assert from "node:assert/strict";
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import * as mupdf from "mupdf";
import { PDFDocument, PDFName } from "pdf-lib";
import type { Browser, BrowserContextOptions, Page } from "playwright-core";
import { chromium } from "playwright-core";
import { createServer } from "vite";

const dir = join(tmpdir(), "web-pdf-e2e");
mkdirSync(dir, { recursive: true });
const SAMPLE = "scripts/sample.pdf";
const FORM = "scripts/form.pdf";
const LARGE = "scripts/large.pdf";

const metaPdf = await (async () => {
  const d = await PDFDocument.create();
  d.addPage([595, 842]).drawText("Metadata page", { x: 40, y: 760, size: 14 });
  d.setTitle("Old title");
  d.setAuthor("Jane Example");
  d.setCreator("Word Processor 9");
  d.setProducer("PDF Maker 2");
  d.catalog.set(
    PDFName.of("Metadata"),
    d.context.register(d.context.stream("<x:xmpmeta xmlns:x='adobe:ns:meta/'/>", { Type: "Metadata", Subtype: "XML" })),
  );
  const file = join(dir, "meta.pdf");
  writeFileSync(file, await d.save());
  return file;
})();
const plainPdf = (() => {
  const doc = new mupdf.PDFDocument();
  doc.insertPage(0, doc.addPage([0, 0, 595, 842], 0, doc.newDictionary(), ""));
  const file = join(dir, "plain.pdf");
  writeFileSync(file, doc.saveToBuffer("compress").asUint8Array());
  return file;
})();
const pix = new mupdf.Pixmap(mupdf.ColorSpace.DeviceRGB, [0, 0, 400, 200], false);
pix.clear(60);
const PNG = { name: "logo.png", mimeType: "image/png", buffer: Buffer.from(pix.asPNG()) };
const JPG = { name: "photo.jpg", mimeType: "image/jpeg", buffer: Buffer.from(pix.asJPEG(80)) };

const pdfText = (bytes: Uint8Array, p: number) =>
  mupdf.Document.openDocument(bytes, "application/pdf").loadPage(p).toStructuredText("preserve-whitespace").asText();
const pageCount = (bytes: Uint8Array) => mupdf.Document.openDocument(bytes, "application/pdf").countPages();
const imageCount = (bytes: Uint8Array, p: number) => {
  let n = 0;
  mupdf.Document.openDocument(bytes, "application/pdf")
    .loadPage(p)
    .toStructuredText("preserve-images")
    .walk({ onImageBlock: () => void n++ });
  return n;
};

const server = await createServer({ logLevel: "silent", server: { port: 0 } });
await server.listen();
const url = server.resolvedUrls!.local[0];
const browser: Browser = await chromium.launch({ channel: "chrome" });

type T = {
  page: Page;
  open: (file?: string) => Promise<void>;
  saved: () => Promise<{ bytes: Uint8Array; name: string }>;
  toast: () => Promise<string>;
  tab: (name: string) => Promise<void>;
};

const tty = process.stdout.isTTY;
const paint = (code: number, s: string) => (tty ? `\x1b[${code}m${s}\x1b[0m` : s);
const [green, red, cyan, dim, bold] = [32, 31, 36, 2, 1].map((code) => (s: string) => paint(code, s));
const FRAMES = "⠋⠙⠹⠸⠼⠴⠦⠧⠇⠏";
const BANNER = String.raw`
 _____ ____  _____   _____         _
| ____|___ \| ____| |_   _|__  ___| |_ ___
|  _|   __) |  _|     | |/ _ \/ __| __/ __|
| |___ / __/| |___    | |  __/\__ \ |_\__ \
|_____|_____|_____|   |_|\___||___/\__|___/
`;
console.log(cyan(BANNER));
const startedAll = performance.now();

const failures: string[] = [];
let passed = 0;

async function test(
  name: string,
  run: (t: T) => Promise<void>,
  opts: BrowserContextOptions = {},
  prefs: Record<string, string> = {},
) {
  const ctx = await browser.newContext({ viewport: { width: 1400, height: 900 }, ...opts });
  await ctx.addInitScript((p) => {
    if (window !== top) return;
    if (!sessionStorage.getItem("seeded")) {
      localStorage.clear();
      for (const [k, v] of Object.entries(p)) localStorage.setItem(k, v);
      sessionStorage.setItem("seeded", "1");
    }
    const w = window as unknown as Record<string, unknown>;
    w.showSaveFilePicker = async (o: { suggestedName: string }) => ({
      name: o.suggestedName,
      createWritable: async () => ({
        write: async (d: Uint8Array) => {
          w.__saved = { bytes: Array.from(d), name: o.suggestedName };
        },
        close: async () => {},
      }),
    });
  }, prefs);
  const page = await ctx.newPage();
  const errors: string[] = [];
  page.on("pageerror", (e) => errors.push(e.message));
  page.on("console", (m) => m.text().includes("Content Security Policy") && errors.push(m.text()));
  page.on("dialog", (d) => d.accept());
  const t: T = {
    page,
    open: async (file = SAMPLE) => {
      await page.goto(url);
      await page.waitForSelector(".start");
      await page.locator('input[accept=".pdf"]').first().setInputFiles(file);
      await page.waitForSelector('.page canvas[width]:not([width="0"])', { state: "attached" });
      await page.waitForTimeout(400);
    },
    saved: async () => {
      await page.waitForFunction(() => (window as unknown as { __saved?: unknown }).__saved, null, { timeout: 30000 });
      const s = await page.evaluate(() => {
        const w = window as unknown as { __saved: { bytes: number[]; name: string } };
        const out = w.__saved;
        (w as unknown as { __saved?: unknown }).__saved = undefined;
        return out;
      });
      return { bytes: Uint8Array.from(s.bytes), name: s.name };
    },
    toast: async () =>
      (
        await page
          .locator(".toast")
          .innerText()
          .catch(() => "")
      ).split("\n")[0],
    tab: async (name) => page.getByRole("tab", { name, exact: true }).click(),
  };
  const started = performance.now();
  let frame = 0;
  const spin = tty
    ? setInterval(() => process.stdout.write(`\r  ${cyan(FRAMES[frame++ % FRAMES.length])} ${name}`), 80)
    : undefined;
  const took = () => dim(`${((performance.now() - started) / 1000).toFixed(1)}s`);
  const done = (line: string) => {
    clearInterval(spin);
    process.stdout.write(tty ? `\r\x1b[2K${line}\n` : `${line}\n`);
  };
  try {
    await run(t);
    assert.deepEqual(errors, [], "no page errors");
    passed++;
    done(`  ${green(tty ? "✔" : "pass")} ${name} ${took()}`);
  } catch (err) {
    failures.push(name);
    const why = (err as Error).message.split("\n").join("\n      ");
    done(`  ${red(tty ? "✖" : "FAIL")} ${name} ${took()}\n      ${red(why)}`);
  } finally {
    await ctx.close();
  }
}

const save = async (t: T) => t.page.getByRole("button", { name: "Save", exact: true }).click();
const closePdf = async (page: Page) => {
  await page.locator(".file-menu").click();
  await page.getByRole("menuitem", { name: "Close" }).click();
};
const inViewport = (page: Page, sel: string) =>
  page.locator(sel).evaluate((n) => {
    const r = n.getBoundingClientRect();
    const m = document.querySelector(".pages")!.getBoundingClientRect();
    return r.top >= m.top && r.bottom <= m.bottom;
  });

await test("spell check is on in British English by default and inherited by text boxes", async ({ page, open }) => {
  await open();
  assert.equal(await page.locator(".app").getAttribute("lang"), "en-GB");
  await page.locator('.el[aria-label="Jane Example"]').click();
  assert.equal(await page.locator(".panel textarea").evaluate((n) => (n as HTMLTextAreaElement).spellcheck), true);
});

await test("spell check setting switches language and turns off, and survives a reload", async ({ page, open }) => {
  await open();
  await page.getByRole("button", { name: "Settings" }).click();
  await page.getByRole("tab", { name: "Editing" }).click();
  await page.getByRole("radio", { name: "US" }).click();
  assert.equal(await page.locator(".app").getAttribute("lang"), "en-US");
  await page.getByRole("radio", { name: "Off" }).click();
  assert.equal(await page.locator(".app").getAttribute("lang"), null);
  assert.equal(await page.locator(".app").getAttribute("spellcheck"), "false");
  await page.keyboard.press("Escape");
  await open();
  assert.equal(await page.locator(".app").getAttribute("spellcheck"), "false", "pref kept after reload");
  await page.locator('.el[aria-label="Jane Example"]').click();
  assert.equal(await page.locator(".panel textarea").evaluate((n) => (n as HTMLTextAreaElement).spellcheck), false);
});

const findBar = (page: Page) => page.getByRole("textbox", { name: "Find", exact: true });
const count = (page: Page) => page.locator(".find-row .muted").innerText();

await test("find opens with Ctrl+F, counts matches and cycles through them", async ({ page, open }) => {
  await open(LARGE);
  await page.keyboard.press("Control+f");
  assert.ok(await findBar(page).evaluate((n) => n === document.activeElement), "find box focused");
  await findBar(page).fill("Senior Software Engineer");
  const total = +(await count(page)).split(" of ")[1];
  assert.ok(total > 4, `found ${total}`);
  assert.equal(await count(page), `1 of ${total}`);
  await findBar(page).press("Enter");
  assert.equal(await count(page), `2 of ${total}`);
  const sel = await page.locator(".el.sel").getAttribute("aria-label");
  assert.equal(sel, "Senior Software Engineer", "the match is selected");
  assert.ok(await inViewport(page, ".el.sel"), "the match is scrolled into view");
  await findBar(page).press("Shift+Enter");
  await findBar(page).press("Shift+Enter");
  assert.equal(await count(page), `${total} of ${total}`, "wraps backwards");
  await findBar(page).press("Enter");
  assert.equal(await count(page), `1 of ${total}`, "wraps forwards");
});

await test("replace changes one match; replace all changes every match in one undo step", async ({
  page,
  open,
  toast,
}) => {
  await open(LARGE);
  await page.getByRole("button", { name: "Find and replace" }).click();
  await findBar(page).fill("Example Company 0 /");
  await page.getByRole("textbox", { name: "Replace with" }).fill("Umbrella Corp /");
  await page.getByRole("button", { name: "Replace", exact: true }).click();
  assert.equal(await count(page), "No matches");
  await findBar(page).fill("Umbrella Corp /");
  assert.equal(await count(page), "1 of 1");
  await findBar(page).fill("Senior Software Engineer");
  const total = +(await count(page)).split(" of ")[1];
  await page.getByRole("textbox", { name: "Replace with" }).fill("Special Agent");
  await page.getByRole("button", { name: "Replace all" }).click();
  assert.equal(await toast(), `Replaced ${total} in ${total} text items.`);
  assert.equal(await count(page), "No matches");
  await page.keyboard.press("Escape");
  await page.locator(".pages").click({ position: { x: 5, y: 5 } });
  await page.keyboard.press("Control+z");
  await page.keyboard.press("Control+f");
  await findBar(page).fill("Senior Software Engineer");
  assert.equal(await count(page), `1 of ${total}`, "one undo restores them all");
});

await test("find skips deleted pages and Escape closes without clearing the selection", async ({ page, open, tab }) => {
  await open(LARGE);
  await tab("Pages");
  await page.getByRole("button", { name: "Delete page" }).click();
  await page.keyboard.press("Control+f");
  await findBar(page).fill("Example Company 0 /");
  assert.equal(await count(page), "No matches", "page 1 is deleted");
  await findBar(page).fill("Example Company 4 /");
  await findBar(page).press("Enter");
  await page.keyboard.press("Escape");
  assert.equal(await page.locator(".find-bar").count(), 0);
  assert.equal(await page.locator(".el.sel").count(), 1);
});

await test("document info shows the file's details and saves edits and stripping", async ({
  page,
  open,
  tab,
  saved,
}) => {
  await open(metaPdf);
  await tab("Document");
  assert.equal(await page.getByRole("textbox", { name: "Title" }).inputValue(), "Old title");
  assert.equal(await page.getByRole("textbox", { name: "Author" }).inputValue(), "Jane Example");
  const hidden = await page.locator(".panel .list").last().innerText();
  assert.match(hidden, /Word Processor 9/);
  assert.match(hidden, /XMP/);
  await page.getByRole("textbox", { name: "Title" }).fill("New title");
  assert.equal(await page.locator(".badge").count(), 1, "Edited badge");
  await page.getByRole("checkbox", { name: "Remove these when saving" }).check();
  await save({ page } as T);
  const { bytes } = await saved();
  const doc = mupdf.Document.openDocument(bytes, "application/pdf");
  assert.equal(doc.getMetaData("info:Title"), "New title");
  assert.equal(doc.getMetaData("info:Creator") ?? "", "");
});

await test("a file with no hidden details says so, and saves as made with Web PDF", async ({
  page,
  open,
  tab,
  saved,
}) => {
  await open(plainPdf);
  await tab("Document");
  assert.match(await page.locator(".panel").innerText(), /No other hidden details were found/);
  assert.equal(await page.getByRole("checkbox", { name: "Remove these when saving" }).count(), 0);
  await save({ page } as T);
  const { bytes } = await saved();
  assert.equal(mupdf.Document.openDocument(bytes, "application/pdf").getMetaData("info:Producer"), "Web PDF");
});

await test("document info edits come back with Restore edits", async ({ page, open, tab }) => {
  await open(metaPdf);
  await tab("Document");
  await page.getByRole("textbox", { name: "Title" }).fill("Draft title");
  await page.waitForTimeout(1600);
  await open(metaPdf);
  await page.getByRole("button", { name: "Restore edits" }).click();
  await tab("Document");
  assert.equal(await page.getByRole("textbox", { name: "Title" }).inputValue(), "Draft title");
});

await test("with saving as you go turned off, reopening offers no edits to restore", async ({ page, open, tab }) => {
  await open(metaPdf);
  await tab("Document");
  await page.getByRole("textbox", { name: "Title" }).fill("Draft title");
  await page.waitForTimeout(1600);
  await page.getByRole("button", { name: "Settings" }).click();
  await page.getByRole("tab", { name: "Privacy" }).click();
  await page.getByRole("switch", { name: "Save edits as you go" }).click();
  await page.getByRole("button", { name: "Done" }).click();
  await page.waitForTimeout(300);
  await open(metaPdf);
  await page.waitForTimeout(300);
  assert.equal(await page.getByRole("button", { name: "Restore edits" }).count(), 0);
  await page.getByRole("button", { name: "Settings" }).click();
  await page.getByRole("tab", { name: "Privacy" }).click();
  await page.getByRole("switch", { name: "Save edits as you go" }).click();
  await page.getByRole("button", { name: "Done" }).click();
  await open(metaPdf);
  await page.waitForTimeout(300);
  assert.equal(
    await page.getByRole("button", { name: "Restore edits" }).count(),
    0,
    "turning it off deleted the draft",
  );
});

const addedImages = (page: Page) => page.locator('.el.img.moved img[src^="blob:"]');
const addImage = async (page: Page, file: typeof PNG) => {
  const chooser = page.waitForEvent("filechooser");
  await page.getByRole("button", { name: "Add image" }).click();
  await (await chooser).setFiles(file);
  await page.waitForTimeout(300);
};

await test("add image places PNG, JPEG and WebP centred, sized and selected", async ({ page, open }) => {
  await open();
  const webp = await page.evaluate(async () => {
    const c = new OffscreenCanvas(300, 300);
    c.getContext("2d")!.fillRect(0, 0, 300, 300);
    return Array.from(new Uint8Array(await (await c.convertToBlob({ type: "image/webp" })).arrayBuffer()));
  });
  const files = [PNG, JPG, { name: "pic.webp", mimeType: "image/webp", buffer: Buffer.from(webp) }];
  for (const [i, f] of files.entries()) {
    await addImage(page, f);
    assert.equal(await addedImages(page).count(), i + 1, `${f.name} added`);
    const pg = (await page.locator(".page").first().boundingBox())!;
    const box = (await page.locator(".el.sel").boundingBox())!;
    assert.ok(Math.abs(box.x + box.width / 2 - (pg.x + pg.width / 2)) < 2, `${f.name} centred`);
    assert.ok(box.width <= pg.width * 0.4 + 1, `${f.name} at most 40% wide`);
    assert.equal(await page.locator(".el.sel .resize.corner").count(), 1, "corner handle");
  }
});

await test("images can be dropped or pasted in", async ({ page, open }) => {
  await open();
  const bytes = Array.from(PNG.buffer);
  await page.evaluate((b) => {
    const dt = new DataTransfer();
    dt.items.add(new File([new Uint8Array(b)], "dropped.png", { type: "image/png" }));
    document
      .querySelector(".app")!
      .dispatchEvent(new DragEvent("drop", { dataTransfer: dt, bubbles: true, cancelable: true }));
  }, bytes);
  await page.waitForTimeout(400);
  assert.equal(await addedImages(page).count(), 1, "dropped");
  await page.evaluate((b) => {
    const dt = new DataTransfer();
    dt.items.add(new File([new Uint8Array(b)], "pasted.png", { type: "image/png" }));
    document.body.dispatchEvent(new ClipboardEvent("paste", { clipboardData: dt, bubbles: true, cancelable: true }));
  }, bytes);
  await page.waitForTimeout(400);
  assert.equal(await addedImages(page).count(), 2, "pasted");
});

await test(
  "the corner handle keeps proportions and stops at the margin",
  async ({ page, open }) => {
    await open();
    await addImage(page, PNG);
    const handle = page.locator(".el.sel .resize.corner");
    const before = (await page.locator(".el.sel").boundingBox())!;
    const h = (await handle.boundingBox())!;
    await page.mouse.move(h.x + 3, h.y + 3);
    await page.mouse.down();
    await page.mouse.move(h.x + 63, h.y + 3, { steps: 6 });
    await page.mouse.up();
    const after = (await page.locator(".el.sel").boundingBox())!;
    assert.ok(after.width > before.width + 50, "wider");
    assert.ok(Math.abs(after.width / after.height - before.width / before.height) < 0.05, "same proportions");
    const h2 = (await handle.boundingBox())!;
    await page.mouse.move(h2.x + 3, h2.y + 3);
    await page.mouse.down();
    await page.mouse.move(h2.x + 2000, h2.y + 3, { steps: 6 });
    await page.mouse.up();
    const pg = (await page.locator(".page").first().boundingBox())!;
    const far = (await page.locator(".el.sel").boundingBox())!;
    assert.ok(far.x + far.width <= pg.x + pg.width - 36 * 1.5 + 2, "stopped at the margin");
  },
  {},
  { marginOn: "1" },
);

await test("added images copy, delete, undo and save into the file", async ({ page, open, saved }) => {
  await open();
  await addImage(page, PNG);
  await page.keyboard.press("Control+c");
  await page.keyboard.press("Control+v");
  await page.waitForTimeout(300);
  assert.equal(await addedImages(page).count(), 2, "pasted copy");
  await page.keyboard.press("Delete");
  assert.equal(await addedImages(page).count(), 1, "deleted");
  await page.keyboard.press("Control+z");
  assert.equal(await addedImages(page).count(), 2, "undo brings it back with its picture");
  await save({ page } as T);
  const { bytes } = await saved();
  assert.equal(imageCount(bytes, 0), 3, "the original image and two added ones");
});

await test("added images come back with Restore edits", async ({ page, open }) => {
  await open();
  await addImage(page, JPG);
  await page.waitForTimeout(1600);
  await open();
  await page.getByRole("button", { name: "Restore edits" }).click();
  await page.waitForTimeout(400);
  assert.equal(await addedImages(page).count(), 1);
});

const mergeFrom = async (page: Page, file: string, button = "Merge…") => {
  const chooser = page.waitForEvent("filechooser");
  await page.getByRole("button", { name: button }).click();
  await (await chooser).setFiles(file);
  await page.waitForFunction(() => /Merged \d+ page/.test(document.querySelector(".toast")?.textContent ?? ""), null, {
    timeout: 30000,
  });
};
const order = (page: Page) =>
  page.locator(".page").evaluateAll((n) => n.map((t) => (t as HTMLElement).dataset.page).join(","));

const dropFiles = (page: Page, selector: string, files: string[]) =>
  page.locator(selector).evaluate(
    (el, list) => {
      const dt = new DataTransfer();
      for (const f of list) dt.items.add(new File([new Uint8Array(f.data)], f.name, { type: "application/pdf" }));
      for (const type of ["dragover", "drop"])
        el.dispatchEvent(new DragEvent(type, { dataTransfer: dt, bubbles: true, cancelable: true }));
    },
    files.map((f) => ({ name: f.split("/").pop()!, data: Array.from(readFileSync(f)) })),
  );

await test("merge adds another PDF's pages where you choose, drawn and undoable", async ({
  page,
  open,
  tab,
  toast,
}) => {
  await open();
  await tab("Pages");
  await mergeFrom(page, LARGE);
  assert.equal(await toast(), "Merged 4 pages from large.pdf.");
  assert.equal(await order(page), "0,1,2,3,4");
  assert.equal(await page.locator(".thumb").count(), 5);
  await page.locator('.page[data-page="1"]').scrollIntoViewIfNeeded();
  await page.waitForTimeout(800);
  assert.ok((await page.locator('.page[data-page="1"] .el').count()) > 10, "merged page has items");
  await page.keyboard.press("Control+z");
  assert.equal(await order(page), "0");
  await page.getByRole("combobox", { name: "Where to add the pages" }).selectOption("At the start");
  await mergeFrom(page, LARGE);
  assert.equal(await order(page), "5,6,7,8,0");
});

await test("dropping a PDF on the page list merges it at that spot", async ({ page, open, toast }) => {
  await open();
  await dropFiles(page, '.thumb[data-page="0"]', [LARGE]);
  await page.waitForFunction(() => /Merged/.test(document.querySelector(".toast")?.textContent ?? ""));
  assert.equal(await toast(), "Merged 4 pages from large.pdf.");
  assert.equal(await order(page), "1,2,3,4,0");
});

await test("merge PDFs joins files in the chosen order into a new document", async ({ page, saved }) => {
  await page.goto(url);
  await dropFiles(page, ".app", [SAMPLE, LARGE]);
  const rows = page.locator(".merge-list li");
  assert.equal(await rows.count(), 2, "dropping two PDFs opens the merge list");
  await page.getByRole("button", { name: "Cancel" }).click();
  await page.getByRole("button", { name: "Merge PDFs" }).click();
  const chooser = page.waitForEvent("filechooser");
  await page.getByText("Add PDFs…").click();
  await (await chooser).setFiles([SAMPLE, LARGE]);
  await page.getByRole("button", { name: "Move large.pdf up" }).click();
  assert.deepEqual(await page.locator(".merge-name").allInnerTexts(), ["large.pdf", "sample.pdf"]);
  await page.getByRole("button", { name: "Merge", exact: true }).click();
  await page.waitForSelector('.page canvas[width]:not([width="0"])', { state: "attached" });
  assert.equal(await page.locator(".thumb").count(), 5);
  await save({ page } as T);
  const { bytes, name } = await saved();
  assert.equal(name, "Merged.pdf");
  assert.equal(pageCount(bytes), 5);
  assert.equal(pdfText(bytes, 0), pdfText(readFileSync(LARGE), 0), "large.pdf first");
  assert.match(pdfText(bytes, 4), /Jane Example/);
});

await test("edits on merged pages save, and come back with Restore edits", async ({ page, open, tab, saved }) => {
  await open();
  await tab("Pages");
  await mergeFrom(page, LARGE);
  await page.locator('.page[data-page="1"]').scrollIntoViewIfNeeded();
  await page.waitForTimeout(600);
  await page.locator('.page[data-page="1"] .el[aria-label="Jane Example"]').dblclick();
  await page.locator(".panel textarea").fill("Leon S. Kennedy");
  await page.waitForTimeout(1600);
  await open();
  await page.getByRole("button", { name: "Restore edits" }).click();
  await page.waitForTimeout(600);
  assert.equal(await page.locator(".thumb").count(), 5, "merged pages restored");
  await save({ page } as T);
  const { bytes } = await saved();
  assert.equal(pageCount(bytes), 5);
  assert.match(pdfText(bytes, 1), /Leon S\. Kennedy/);
});

await test("save some pages writes just those pages, in order, as a copy", async ({
  page,
  open,
  tab,
  saved,
  toast,
}) => {
  await open();
  await tab("Pages");
  await mergeFrom(page, LARGE);
  await page.getByPlaceholder(/For example/).fill("3, 1");
  await page.getByRole("button", { name: "Save pages" }).click();
  const { bytes, name } = await saved();
  assert.equal(name, "sample-pages.pdf");
  assert.equal(pageCount(bytes), 2);
  assert.equal(pdfText(bytes, 0), pdfText(readFileSync(LARGE), 1), "page 3 first");
  assert.match(pdfText(bytes, 1), /Jane Example/);
  assert.equal(await page.locator(".badge").count(), 1, "still marked as edited");
  await page.getByPlaceholder(/For example/).fill("9");
  await page.getByRole("button", { name: "Save pages" }).click();
  assert.match(await toast(), /isn't a page list/);
});

const zoom = async (page: Page) => +(await page.locator(".zoom-level").first().innerText()).replace("%", "");

await test(
  "two-finger pinch zooms around the fingers without zooming the browser",
  async ({ page, open }) => {
    await open(LARGE);
    await page.evaluate(() => {
      const w = window as unknown as { __renders: number };
      w.__renders = 0;
      const send = Worker.prototype.postMessage;
      Worker.prototype.postMessage = function (m: { type?: string; original?: boolean }, ...rest: never[]) {
        if (m?.type === "render" && !m.original) w.__renders++;
        return send.call(this, m, ...rest);
      };
    });
    const start = await zoom(page);
    const main = (await page.locator(".pages").boundingBox())!;
    const [cx, cy] = [main.x + main.width / 2, main.y + main.height / 2];
    const under = () =>
      page.evaluate(
        ([x, y]) => {
          const pg = document.elementsFromPoint(x, y).find((n) => n.classList.contains("page")) as HTMLElement;
          const r = pg.getBoundingClientRect();
          return { page: pg.dataset.page, fx: (x - r.left) / r.width, fy: (y - r.top) / r.height };
        },
        [cx, cy],
      );
    const before = await under();
    const cdp = await page.context().newCDPSession(page);
    const touch = (type: string, d: number) =>
      cdp.send("Input.dispatchTouchEvent", {
        type,
        touchPoints:
          type === "touchEnd"
            ? []
            : [
                { x: cx - d / 2, y: cy, id: 1 },
                { x: cx + d / 2, y: cy, id: 2 },
              ],
      });
    await touch("touchStart", 100);
    for (const d of [120, 140, 160, 180, 200]) await touch("touchMove", d);
    await touch("touchEnd", 0);
    await page.evaluate(() => void ((window as unknown as { __renders: number }).__renders = 0));
    await page.waitForTimeout(800);
    const after = await zoom(page);
    assert.ok(Math.abs(after - Math.min(400, start * 2)) <= 2, `zoom ${start}% -> ${after}%`);
    const now = await under();
    assert.equal(now.page, before.page, "same page under the fingers");
    assert.ok(
      Math.abs(now.fx - before.fx) < 0.03 && Math.abs(now.fy - before.fy) < 0.03,
      "same spot under the fingers",
    );
    assert.equal(await page.evaluate(() => visualViewport!.scale), 1, "browser didn't zoom");
    assert.ok(
      (await page.evaluate(() => (window as unknown as { __renders: number }).__renders)) <= 6,
      "re-rendered once it settled",
    );
  },
  { hasTouch: true, isMobile: true, viewport: { width: 390, height: 844 } },
);

await test(
  "a second finger stops a drag and doesn't select anything",
  async ({ page, open }) => {
    await open(LARGE);
    const el = page.locator(".el.hit").nth(4);
    const id = await el.getAttribute("data-id");
    const item = page.locator(`[data-id="${id}"]`);
    const b = (await item.boundingBox())!;
    const cdp = await page.context().newCDPSession(page);
    const [x, y] = [b.x + b.width / 2, b.y + b.height / 2];
    const send = (type: string, points: { x: number; y: number; id: number }[]) =>
      cdp.send("Input.dispatchTouchEvent", { type, touchPoints: points });
    await send("touchStart", [{ x, y, id: 1 }]);
    await send("touchMove", [{ x: x + 20, y, id: 1 }]);
    const mid = (await item.boundingBox())!;
    await send("touchStart", [
      { x: x + 20, y, id: 1 },
      { x: x + 20, y: y + 120, id: 2 },
    ]);
    await send("touchMove", [
      { x: x + 80, y, id: 1 },
      { x: x + 80, y: y + 120, id: 2 },
    ]);
    await send("touchEnd", []);
    await page.waitForTimeout(300);
    const end = (await item.boundingBox())!;
    assert.ok(
      Math.abs(end.x - mid.x) < 2,
      `drag stopped (moved ${Math.round(end.x - mid.x)}px after the second finger)`,
    );
    assert.ok((await page.locator(".el.sel").count()) <= 1, "nothing else selected");
  },
  { hasTouch: true, isMobile: true, viewport: { width: 390, height: 844 } },
);

await test("Ctrl+wheel zooms around the cursor; a plain wheel scrolls", async ({ page, open }) => {
  await open(LARGE);
  const start = await zoom(page);
  const main = (await page.locator(".pages").boundingBox())!;
  await page.mouse.move(main.x + main.width / 2, main.y + 300);
  await page.keyboard.down("Control");
  await page.mouse.wheel(0, -100);
  await page.keyboard.up("Control");
  await page.waitForTimeout(300);
  assert.ok((await zoom(page)) > start, "zoomed in");
  const z = await zoom(page);
  const top = await page.locator(".pages").evaluate((m) => m.scrollTop);
  await page.mouse.wheel(0, 400);
  await page.waitForTimeout(300);
  assert.equal(await zoom(page), z, "plain wheel doesn't zoom");
  assert.ok((await page.locator(".pages").evaluate((m) => m.scrollTop)) > top, "plain wheel scrolls");
});

await test("new PDF starts an empty page that saves as Untitled.pdf", async ({ page, saved }) => {
  await page.goto(url);
  await page.getByRole("button", { name: "New PDF" }).click();
  await page.waitForSelector('.page canvas[width]:not([width="0"])', { state: "attached" });
  await page.getByRole("button", { name: "Add text" }).click();
  await page.locator('.page[data-page="0"]').click({ position: { x: 100, y: 100 } });
  await page.locator(".panel textarea").fill("Leon S. Kennedy");
  await save({ page } as T);
  const { bytes, name } = await saved();
  assert.equal(name, "Untitled.pdf");
  assert.equal(pageCount(bytes), 1);
  assert.match(pdfText(bytes, 0), /Leon S\. Kennedy/);
  assert.equal(await page.evaluate(() => localStorage.getItem("recent")), null, "not added to recent files");
});

await test("pages tab holds page tools; file size and ATS live in the document tab", async ({ page, open, tab }) => {
  await open();
  await tab("Pages");
  const header = page.getByRole("textbox", { name: "Header left" });
  assert.equal(await header.isVisible(), false, "header & footer starts closed");
  await page.getByText("Header & footer").click();
  await header.fill("Leon S. Kennedy");
  await tab("Document");
  await page.getByRole("button", { name: "Check saved size" }).waitFor();
  await page.getByRole("button", { name: "Check how ATS reads it" }).waitFor();
  await tab("Pages");
  assert.equal(await header.isVisible(), true, "stays open once it has text");
});

await test(
  "with editing on the page, text opens in place and new text boxes start there",
  async ({ page, open, saved }) => {
    await open();
    await page.locator('.el[aria-label="Jane Example"]').dblclick();
    const inline = page.locator("textarea.inline-text");
    assert.equal(await inline.evaluate((t) => t === document.activeElement), true, "focused on open");
    await inline.fill("Leon S. Kennedy");
    await page.keyboard.press("Escape");
    await inline.waitFor({ state: "detached" });
    assert.equal(
      await page.evaluate(() => document.activeElement?.getAttribute("aria-label")),
      "Leon S. Kennedy",
      "focus returns to the text",
    );
    await page.getByRole("button", { name: "Add text" }).click();
    await page.locator('.page[data-page="0"]').click({ position: { x: 100, y: 700 } });
    await inline.fill("Raccoon City");
    await page.locator('.page[data-page="0"]').click({ position: { x: 400, y: 900 } });
    await inline.waitFor({ state: "detached" });
    await save({ page } as T);
    const text = pdfText((await saved()).bytes, 0);
    assert.match(text, /Leon S\. Kennedy/);
    assert.match(text, /Raccoon City/);
  },
  {},
  { editText: "page" },
);

const formValues = (bytes: Uint8Array) =>
  (mupdf.Document.openDocument(bytes, "application/pdf") as mupdf.PDFDocument)
    .loadPage(0)
    .getWidgets()
    .map((w) => `${w.getName()}=${w.getValue()}`);

await test("form fields fill in on the page, save into the file, and come back with Restore edits", async ({
  page,
  open,
  saved,
}) => {
  await open(FORM);
  await page.getByRole("textbox", { name: "name" }).fill("Leon S. Kennedy");
  await page.getByRole("textbox", { name: "notes" }).fill("Rookie\nRaccoon City");
  await page.getByRole("checkbox", { name: "subscribe" }).check();
  await page.getByRole("radio", { name: "size" }).nth(1).check();
  await page.getByRole("combobox", { name: "country" }).selectOption("Ireland");
  assert.equal(await page.getByRole("textbox", { name: "ref" }).isDisabled(), true, "read-only field");
  assert.equal(await page.locator(".badge").count(), 1, "marked as edited");
  await page.waitForTimeout(1600);
  await open(FORM);
  assert.equal(await page.getByRole("textbox", { name: "name" }).inputValue(), "");
  await page.getByRole("button", { name: "Restore edits" }).click();
  assert.equal(await page.getByRole("textbox", { name: "name" }).inputValue(), "Leon S. Kennedy");
  await save({ page } as T);
  assert.deepEqual(formValues((await saved()).bytes), [
    "name=Leon S. Kennedy",
    "notes=Rookie\nRaccoon City",
    "subscribe=Yes",
    "size=1",
    "size=1",
    "country=Ireland",
    "ref=ABC-123",
    "signature=",
  ]);
});

await test("signatures are drawn or typed, fill a signature field, and can be remembered", async ({
  page,
  open,
  saved,
}) => {
  await open(FORM);
  await page.getByRole("button", { name: /Sign here/ }).click();
  const add = page.getByRole("button", { name: "Add signature" });
  assert.equal(await add.isDisabled(), true, "nothing drawn yet");
  const pad = (await page.locator(".signature-pad").boundingBox())!;
  await page.mouse.move(pad.x + 40, pad.y + 80);
  await page.mouse.down();
  for (let i = 1; i <= 20; i++) await page.mouse.move(pad.x + 40 + i * 12, pad.y + 80 + (i % 2 ? 25 : -25));
  await page.mouse.up();
  assert.equal(await add.isDisabled(), false, "drawn");
  await page.getByRole("tab", { name: "Type" }).click();
  await page.getByRole("textbox", { name: "Your name" }).fill("Leon S. Kennedy");
  await page.getByText("Remember this signature on this device").click();
  await add.click();
  await page.waitForTimeout(400);
  const sig = (await addedImages(page).first().boundingBox())!;
  const field = (await page.locator('.page[data-page="0"]').boundingBox())!;
  const scale = field.width / 595;
  assert.ok(sig.x >= field.x + 159 * scale && sig.x + sig.width <= field.x + 401 * scale, "fits the field's width");
  assert.equal(await page.getByRole("button", { name: /Sign here/ }).count(), 0, "field shows as signed");
  await page.getByRole("button", { name: "Add a signature" }).click();
  assert.equal(await page.getByRole("tab", { name: "Saved" }).getAttribute("aria-selected"), "true");
  await page.getByRole("button", { name: "Add signature" }).click();
  await page.waitForTimeout(400);
  assert.equal(await addedImages(page).count(), 2);
  await page.getByRole("button", { name: "Add a signature" }).click();
  await page.getByRole("button", { name: "Forget this signature" }).click();
  assert.equal(await page.getByRole("tab", { name: "Saved" }).count(), 1, "one click only asks");
  await page.getByRole("button", { name: "Yes, forget it" }).click();
  assert.equal(await page.getByRole("tab", { name: "Saved" }).count(), 0, "the second click forgets it");
  await page.waitForFunction(() => document.activeElement?.textContent === "Draw");
  await page.keyboard.press("Escape");
  await save({ page } as T);
  assert.equal(imageCount((await saved()).bytes, 0), 2);
});

await test("unsaved edits ask before closing or opening another file", async ({ page, open, saved }) => {
  const edit = async () => {
    await page.locator('.el[aria-label="Jane Example"]').dblclick();
    await page.locator(".panel textarea").fill("Leon S. Kennedy");
  };
  const dialog = page.getByRole("dialog", { name: "Unsaved edits" });
  await open();
  await edit();
  await closePdf(page);
  await dialog.getByRole("button", { name: "Cancel" }).click();
  assert.equal(await page.locator(".page").count(), 1, "cancel keeps it open");
  await closePdf(page);
  await dialog.getByRole("button", { name: "Save a copy" }).click();
  assert.match(pdfText((await saved()).bytes, 0), /Leon S\. Kennedy/);
  await page.waitForSelector(".start");
  await open();
  await edit();
  await dropFiles(page, ".app", [LARGE]);
  await dialog.getByRole("button", { name: "Don't save" }).click();
  await page.waitForFunction(() => document.querySelectorAll(".thumb").length === 4);
  await closePdf(page);
  await page.waitForSelector(".start");
});

await test("tooltips show the label and shortcut on hover and keyboard focus", async ({ page, open }) => {
  await open();
  const find = page.getByRole("button", { name: "Find and replace" });
  await find.hover();
  const tip = page.getByRole("tooltip");
  await tip.waitFor();
  assert.equal(await tip.innerText(), "Find and replace\nCtrl+F");
  assert.equal(await find.getAttribute("aria-describedby"), await tip.getAttribute("id"));
  await page.keyboard.press("Escape");
  await tip.waitFor({ state: "detached" });
  assert.equal(await find.getAttribute("aria-describedby"), null);
  await page.mouse.move(700, 600);
  await page.getByRole("button", { name: "Add text" }).focus();
  await page.keyboard.press("Tab");
  await tip.waitFor();
  assert.equal(await page.evaluate(() => document.activeElement?.getAttribute("aria-label")), await tip.innerText());
});

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

for (const uiStyle of ["toolbar", "canvas"])
  await test(
    `on a phone, tools and zoom share the bottom dock and the rest is under More, in ${uiStyle} style`,
    async ({ page, open }) => {
      await open();
      assert.equal(await page.locator(".zoom-float").isVisible(), true);
      assert.equal(await page.locator('.header [aria-label="Zoom"]').isVisible(), false);
      await page.locator(".zoom-float").getByRole("button", { name: "Add text" }).click();
      assert.equal(
        await page.locator(".zoom-float").getByRole("button", { name: "Add text" }).getAttribute("aria-pressed"),
        "true",
      );
      assert.equal(await page.getByRole("button", { name: "Settings" }).count(), 0, "view buttons are under More");
      await page.getByRole("button", { name: "More" }).click();
      await page.getByRole("menuitem", { name: "Find and replace" }).click();
      await page.getByRole("textbox", { name: "Find", exact: true }).waitFor();
    },
    { hasTouch: true, isMobile: true, viewport: { width: 390, height: 844 } },
    { uiStyle },
  );

await test(
  "on a phone, the edit sheet and dialogs sit above the on-screen keyboard",
  async ({ page, open }) => {
    await page.addInitScript(() => {
      const handlers: (() => void)[] = [];
      const fake = {
        height: innerHeight,
        offsetTop: 0,
        scale: 1,
        addEventListener: (_: string, f: () => void) => handlers.push(f),
        removeEventListener: () => {},
      };
      Object.defineProperty(window, "visualViewport", { get: () => fake });
      (window as unknown as { keyboard: (px: number) => void }).keyboard = (px) => {
        fake.height = innerHeight - px;
        for (const f of handlers) f();
      };
    });
    await open();
    const keyboard = (px: number) =>
      page.evaluate((v) => (window as unknown as { keyboard: (n: number) => void }).keyboard(v), px);
    const top = 844 - 300;
    await page.locator('.el[aria-label="Jane Example"]').tap();
    await page.locator(".panel textarea").focus();
    await keyboard(300);
    const panel = (await page.locator(".panel").boundingBox())!;
    assert.ok(panel.y + panel.height <= top + 1, `sheet ends at ${panel.y + panel.height}, keyboard starts at ${top}`);
    const field = (await page.locator(".panel textarea").boundingBox())!;
    assert.ok(field.y >= panel.y && field.y + field.height <= top + 1, "the focused field is in view");
    assert.equal(await page.locator(".zoom-float").isVisible(), false, "the dock steps aside while typing");
    await keyboard(0);
    await page.getByRole("button", { name: "More" }).click();
    await page.getByRole("menuitem", { name: "Settings" }).click();
    await keyboard(300);
    const dialog = (await page.getByRole("dialog", { name: "Settings" }).boundingBox())!;
    assert.ok(dialog.y + dialog.height <= top + 1, "dialogs sit above the keyboard too");
  },
  { hasTouch: true, isMobile: true, viewport: { width: 390, height: 844 } },
);

await test(
  "on a phone, dragging a sheet's handle down closes it, and a short drag springs back",
  async ({ page, open }) => {
    await open();
    const drag = async (handle: string, dy: number) => {
      const b = (await page.locator(handle).boundingBox())!;
      await page.mouse.move(b.x + b.width / 2, b.y + b.height / 2);
      await page.mouse.down();
      await page.mouse.move(b.x + b.width / 2, b.y + b.height / 2 + dy, { steps: 6 });
      await page.mouse.up();
    };
    await page.locator('.el[aria-label="Jane Example"]').tap();
    await page.locator(".panel").waitFor();
    await page.locator(".panel").evaluate((n) => n.scrollTo(0, n.scrollHeight));
    const [panel, handle] = await Promise.all(
      [".panel", ".panel .sheet-handle"].map(async (s) => (await page.locator(s).boundingBox())!),
    );
    assert.ok(handle.y - panel.y < 4, "the handle stays at the top while the sheet scrolls");
    await drag(".panel .sheet-handle", 30);
    assert.equal(await page.locator(".panel").isVisible(), true, "a short drag keeps it open");
    await page.waitForTimeout(300);
    await drag(".panel .sheet-handle", 160);
    await page.locator(".panel").waitFor({ state: "hidden" });
    const dock = (await page.locator(".dock-handle").boundingBox())!;
    await page.mouse.move(dock.x + dock.width / 2, dock.y + dock.height / 2);
    await page.mouse.down();
    await page.mouse.move(dock.x + dock.width / 2, dock.y - 100, { steps: 6 });
    assert.match(
      await page.locator(".panel").evaluate((n) => n.style.clipPath),
      /inset/,
      "mid-swipe the panel is growing out of the dock",
    );
    assert.equal(await page.locator(".zoom-float").isVisible(), true, "the dock is still there while it morphs");
    const hushed = () => page.locator(".panel").evaluate((n) => n.classList.contains("hush"));
    assert.ok(await hushed(), "its content waits until it has grown");
    await page.mouse.up();
    await page.waitForTimeout(400);
    assert.equal(
      await page.locator(".panel").evaluate((n) => n.style.clipPath),
      "",
      "released past the threshold, it finishes opening",
    );
    assert.equal(await page.locator(".zoom-float").isVisible(), false);
    assert.ok(!(await hushed()), "then the content fades in");
    await drag(".panel .sheet-handle", 160);
    await page.locator(".panel").waitFor({ state: "hidden" });
    await page.waitForTimeout(400);
    assert.equal(
      await page.locator(".zoom-float").evaluate((n) => getComputedStyle(n).opacity),
      "1",
      "the dock is back once the panel has gone",
    );
    await page.locator(".dock-handle").tap();
    await page.waitForTimeout(400);
    assert.ok(!(await hushed()), "a quick tap still ends with the panel's content showing");
    await drag(".panel .sheet-handle", 160);
    await page.locator(".panel").waitFor({ state: "hidden" });
    await page.getByRole("button", { name: "More" }).click();
    await page.getByRole("menuitem", { name: "Settings" }).click();
    await drag(".dialog .sheet-handle", 160);
    await page.getByRole("dialog").waitFor({ state: "detached" });
  },
  { hasTouch: true, isMobile: true, viewport: { width: 390, height: 844 } },
);

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

await test(
  "settings that only matter on a desktop are hidden on a phone",
  async ({ page }) => {
    await page.goto(url);
    await page.getByRole("button", { name: "Settings" }).click();
    for (const name of ["Interface style", "Page thumbnails", "Panel side"])
      assert.equal(await page.getByText(name, { exact: true }).isVisible(), false, `${name} hidden`);
    assert.equal(await page.getByText("Theme", { exact: true }).isVisible(), true);
  },
  { hasTouch: true, isMobile: true, viewport: { width: 390, height: 844 } },
);

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

await browser.close();
await server.close();
const total = dim(`in ${((performance.now() - startedAll) / 1000).toFixed(1)}s`);
console.log(
  failures.length
    ? `\n  ${bold(red(`${failures.length} failed`))}, ${passed} passed ${total}`
    : `\n  ${bold(green(`ok: all ${passed} browser checks passed`))} ${total}`,
);
process.exit(failures.length ? 1 : 0);
