// Form fields, signatures, and the unsaved-edits dialog.
import assert from "node:assert/strict";
import { FORM, formValues, imageCount, LARGE, pdfText } from "./fixtures.ts";
import { test } from "./harness.ts";
import { addedImages, closePdf, dropFiles, save } from "./helpers.ts";

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
  await save(page);
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
  await save(page);
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
