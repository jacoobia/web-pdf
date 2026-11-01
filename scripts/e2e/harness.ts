// Runs each browser check in a fresh Chrome context against a Vite dev server, and prints the results.
import assert from "node:assert/strict";
import type { Browser, BrowserContextOptions, Page } from "playwright-core";
import { chromium } from "playwright-core";
import { createServer } from "vite";
import { SAMPLE } from "./fixtures.ts";

/** A phone-sized, touch-screen browser. */
export const PHONE: BrowserContextOptions = { hasTouch: true, isMobile: true, viewport: { width: 390, height: 844 } };

const server = await createServer({ logLevel: "silent", server: { port: 0 } });
await server.listen();
export const url = server.resolvedUrls!.local[0];
const browser: Browser = await chromium.launch({ channel: "chrome" });

export type T = {
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

export async function test(
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

export async function finish() {
  await browser.close();
  await server.close();
  const total = dim(`in ${((performance.now() - startedAll) / 1000).toFixed(1)}s`);
  console.log(
    failures.length
      ? `\n  ${bold(red(`${failures.length} failed`))}, ${passed} passed ${total}`
      : `\n  ${bold(green(`ok: all ${passed} browser checks passed`))} ${total}`,
  );
  process.exit(failures.length ? 1 : 0);
}
