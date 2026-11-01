// Small actions and readings that several checks share.
import { readFileSync } from "node:fs";
import type { Page } from "playwright-core";
import type { PNG } from "./fixtures.ts";

export const save = (page: Page) => page.getByRole("button", { name: "Save", exact: true }).click();
export const closePdf = async (page: Page) => {
  await page.locator(".file-menu").click();
  await page.getByRole("menuitem", { name: "Close" }).click();
};
export const inViewport = (page: Page, sel: string) =>
  page.locator(sel).evaluate((n) => {
    const r = n.getBoundingClientRect();
    const m = document.querySelector(".pages")!.getBoundingClientRect();
    return r.top >= m.top && r.bottom <= m.bottom;
  });

export const findBar = (page: Page) => page.getByRole("textbox", { name: "Find", exact: true });
export const matchCount = (page: Page) => page.locator(".find-row .muted").innerText();

export const addedImages = (page: Page) => page.locator('.el.img.moved img[src^="blob:"]');
export const addImage = async (page: Page, file: typeof PNG) => {
  const chooser = page.waitForEvent("filechooser");
  await page.getByRole("button", { name: "Add image" }).click();
  await (await chooser).setFiles(file);
  await page.waitForTimeout(300);
};

export const mergeFrom = async (page: Page, file: string, button = "Merge…") => {
  const chooser = page.waitForEvent("filechooser");
  await page.getByRole("button", { name: button }).click();
  await (await chooser).setFiles(file);
  await page.waitForFunction(() => /Merged \d+ page/.test(document.querySelector(".toast")?.textContent ?? ""), null, {
    timeout: 30000,
  });
};
export const order = (page: Page) =>
  page.locator(".page").evaluateAll((n) => n.map((t) => (t as HTMLElement).dataset.page).join(","));

export const dropFiles = (page: Page, selector: string, files: string[]) =>
  page.locator(selector).evaluate(
    (el, list) => {
      const dt = new DataTransfer();
      for (const f of list) dt.items.add(new File([new Uint8Array(f.data)], f.name, { type: "application/pdf" }));
      for (const type of ["dragover", "drop"])
        el.dispatchEvent(new DragEvent(type, { dataTransfer: dt, bubbles: true, cancelable: true }));
    },
    files.map((f) => ({ name: f.split("/").pop()!, data: Array.from(readFileSync(f)) })),
  );

export const zoom = async (page: Page) => +(await page.locator(".zoom-level").first().innerText()).replace("%", "");
