// Merging, saving some pages, zooming, new PDFs and the pages tab.
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { LARGE, pageCount, pdfText, SAMPLE } from "./fixtures.ts";
import { PHONE, test, url } from "./harness.ts";
import { dropFiles, mergeFrom, order, save, zoom } from "./helpers.ts";

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
  await save(page);
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
  await save(page);
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
  PHONE,
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
  PHONE,
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
  await save(page);
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
