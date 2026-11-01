// Editing text and images, find and replace, and tooltips.
import assert from "node:assert/strict";
import { imageCount, JPG, LARGE, PNG, pdfText } from "./fixtures.ts";
import { test } from "./harness.ts";
import { addedImages, addImage, findBar, inViewport, matchCount, save } from "./helpers.ts";

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

await test("find opens with Ctrl+F, counts matches and cycles through them", async ({ page, open }) => {
  await open(LARGE);
  await page.keyboard.press("Control+f");
  assert.ok(await findBar(page).evaluate((n) => n === document.activeElement), "find box focused");
  await findBar(page).fill("Senior Software Engineer");
  const total = +(await matchCount(page)).split(" of ")[1];
  assert.ok(total > 4, `found ${total}`);
  assert.equal(await matchCount(page), `1 of ${total}`);
  await findBar(page).press("Enter");
  assert.equal(await matchCount(page), `2 of ${total}`);
  const sel = await page.locator(".el.sel").getAttribute("aria-label");
  assert.equal(sel, "Senior Software Engineer", "the match is selected");
  assert.ok(await inViewport(page, ".el.sel"), "the match is scrolled into view");
  await findBar(page).press("Shift+Enter");
  await findBar(page).press("Shift+Enter");
  assert.equal(await matchCount(page), `${total} of ${total}`, "wraps backwards");
  await findBar(page).press("Enter");
  assert.equal(await matchCount(page), `1 of ${total}`, "wraps forwards");
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
  assert.equal(await matchCount(page), "No matches");
  await findBar(page).fill("Umbrella Corp /");
  assert.equal(await matchCount(page), "1 of 1");
  await findBar(page).fill("Senior Software Engineer");
  const total = +(await matchCount(page)).split(" of ")[1];
  await page.getByRole("textbox", { name: "Replace with" }).fill("Special Agent");
  await page.getByRole("button", { name: "Replace all" }).click();
  assert.equal(await toast(), `Replaced ${total} in ${total} text items.`);
  assert.equal(await matchCount(page), "No matches");
  await page.keyboard.press("Escape");
  await page.locator(".pages").click({ position: { x: 5, y: 5 } });
  await page.keyboard.press("Control+z");
  await page.keyboard.press("Control+f");
  await findBar(page).fill("Senior Software Engineer");
  assert.equal(await matchCount(page), `1 of ${total}`, "one undo restores them all");
});

await test("find skips deleted pages and Escape closes without clearing the selection", async ({ page, open, tab }) => {
  await open(LARGE);
  await tab("Pages");
  await page.getByRole("button", { name: "Delete page" }).click();
  await page.keyboard.press("Control+f");
  await findBar(page).fill("Example Company 0 /");
  assert.equal(await matchCount(page), "No matches", "page 1 is deleted");
  await findBar(page).fill("Example Company 4 /");
  await findBar(page).press("Enter");
  await page.keyboard.press("Escape");
  assert.equal(await page.locator(".find-bar").count(), 0);
  assert.equal(await page.locator(".el.sel").count(), 1);
});

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
  await save(page);
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
    await save(page);
    const text = pdfText((await saved()).bytes, 0);
    assert.match(text, /Leon S\. Kennedy/);
    assert.match(text, /Raccoon City/);
  },
  {},
  { editText: "page" },
);

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
