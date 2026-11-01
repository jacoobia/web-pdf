// The phone layout: dock, menus, sheets and the on-screen keyboard.
import assert from "node:assert/strict";
import { PHONE, test, url } from "./harness.ts";

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
    PHONE,
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
  PHONE,
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
    assert.equal(
      await page.locator(".panel").getByRole("button", { name: "Hide the panel" }).count(),
      0,
      "the handle replaces the close button",
    );
    await page.mouse.move(195, (await page.locator(".panel .sheet-handle").boundingBox())!.y + 10);
    await page.mouse.down();
    await page.mouse.move(195, 200, { steps: 6 });
    const untouched = await page.locator(".panel").evaluate((n) => !n.classList.contains("hush") && !n.style.clipPath);
    await page.mouse.up();
    assert.ok(untouched, "swiping up on an open panel does nothing");
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
  PHONE,
);

await test(
  "settings that only matter on a desktop are hidden on a phone",
  async ({ page }) => {
    await page.goto(url);
    await page.getByRole("button", { name: "Settings" }).click();
    for (const name of ["Interface style", "Page thumbnails", "Panel side"])
      assert.equal(await page.getByText(name, { exact: true }).isVisible(), false, `${name} hidden`);
    assert.equal(await page.getByText("Theme", { exact: true }).isVisible(), true);
  },
  PHONE,
);
