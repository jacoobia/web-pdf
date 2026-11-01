// Browser checks for the editor: bun run test:e2e. Runs under Node, as Playwright hangs under Bun on Windows.
// Each file is one area of the app. They're loaded one at a time, so the checks run in order rather than all at once.
import { finish } from "./harness.ts";

for (const area of ["editing", "document", "pages", "forms", "app", "phone"]) await import(`./${area}.ts`);
await finish();
