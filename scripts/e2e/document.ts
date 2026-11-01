// Document details, hidden details, and restoring unsaved edits.
import assert from "node:assert/strict";
import * as mupdf from "mupdf";
import { metaPdf, plainPdf } from "./fixtures.ts";
import { test } from "./harness.ts";
import { save } from "./helpers.ts";

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
  await save(page);
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
  await save(page);
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
