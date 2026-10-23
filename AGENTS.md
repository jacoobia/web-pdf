# AGENTS.md

Rules for AI agents working on Web PDF. They apply on top of [CONTRIBUTING.md](CONTRIBUTING.md); the layout of `src/` is described there.

## Privacy

Web PDF's promise is that files never leave the browser. Keep all work on the user's machine: no network requests, uploads, analytics, telemetry or third-party scripts. Links that the user clicks are fine.

The one exception is the BugDrop feedback form (`src/lib/feedback.ts`), which loads only when the user clicks Send feedback. Anything that shows the user's document or file names carries `data-bugdrop-mask`, so it's hidden from feedback screenshots.

## Dependencies

Solve problems with the platform and the packages already in `package.json`. Get the maintainer's agreement in the issue or pull request before adding a dependency. Anything added must have a licence compatible with the AGPL-3.0.

## Code style

- Match the surrounding code: terse and functional, short local names, early returns, small helpers. Biome formats it (`bun run format`).
- Write code that reads without comments. Add a comment only for a constraint the code can't show, such as a browser quirk or a performance trap, and keep it to one line explaining why.
- Keep the diff to the change at hand. Leave unrelated code, names and formatting alone.

## UI

- Build UI from `src/components/ui` and style it with the tokens in `src/styles/theme.css`. When something new is needed, add it to the toolkit as a component with its own CSS file and export it from `index.ts`.
- Check every UI change at phone width (about 390px) and at desktop width, in light and dark themes.
- New controls work from the keyboard and have accessible labels, like the existing toolkit components.
- Write UI text and docs in British English (colour, licence), in plain words, without em dashes.

## Performance

- PDF reading, rendering and saving run in `src/lib/render.worker.ts`. Keep that work off the main thread. The page imports `src/lib/model.ts`, which must not import MuPDF; MuPDF code goes in `src/lib/pdf.ts`.
- `PageCanvas` caches page and item views, and `useEditor` keeps handlers stable, so typing and dragging only re-render what changed. Keep new state and props flowing through those caches.
- Style state with plain classes on `.app`, never CSS `:has()`: Chrome re-checks it on every keystroke in large documents.
- Test changes to rendering or editing against the 60-page document from `bun scripts/sample.ts --heavy`.

## Checks

- Changes to `src/lib/pdf.ts`, `src/lib/model.ts` or `src/lib/snap.ts` add an assertion to `scripts/check.ts`.
- Work is done when `bun run lint`, `bun run typecheck`, `bun run test` (Windows) and `bun run build` pass, and UI changes have been tried in `bun run dev`. Report any failures as they are.

## Commits

The subject is one lower-case line of 72 characters or fewer: `type: summary`, where the type is one of `feat`, `fix`, `perf`, `refactor`, `docs`, `test`, `chore`, `ci`, `build`, `style` or `revert`. Summarise the change in a few words, such as `fix: wrap long words`. Put no prose body under it. Trailers such as `Co-Authored-By:` may follow after a blank line. The commit-msg hook enforces this.
