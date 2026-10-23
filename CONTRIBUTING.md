# Contributing

Bug reports and pull requests are welcome.

## Reporting a bug

Open an issue saying what you did, what you expected and what happened instead, plus your browser. If it's specific to one PDF and you can share it, attach it. If you can't (a CV, say), a description of where the text came from helps: which app made the file, and the font.

## Making a change

1. Fork the repo and create a branch.
2. `bun install`, then `bun run dev`.
3. Make your change. Keep it focused on one thing.
4. Run `bun run lint`, `bun run typecheck` and, on Windows, `bun run test`.
5. Open a pull request saying what changed and why.

The pre-commit hook runs Biome on staged files and the typechecker. Commit messages are a single lower-case line of 72 characters or fewer, starting with the type of change: `feat: add a settings menu`, `fix: wrap long words`. The types are `feat`, `fix`, `perf`, `refactor`, `docs`, `test`, `chore`, `ci`, `build`, `style` and `revert`. There's no message body, but trailers such as `Co-Authored-By:` can go after a blank line. The commit-msg hook checks this.

If you use an AI agent, it should follow [AGENTS.md](AGENTS.md).

## Project layout

- `src/routes/` pages. `index.tsx` is the editor, and only composes components.
- `src/components/ui/` the UI toolkit: buttons, inputs, menus, dialogs and so on. Build new UI from these.
- `src/components/` the editor's own components, built from the toolkit.
- `src/lib/` logic with no markup: the PDF engine, the editor state hook, storage and browser helpers.
- `src/styles/theme.css` colour, size and spacing tokens. Components use these variables rather than raw values.

## Code style

Biome handles formatting and linting; `bun run format` fixes most of what it reports. Beyond that, match the code around your change and keep it readable without comments.

## Licence

By contributing, you agree your contribution is licensed under the AGPL-3.0-or-later, the same as the rest of the project.
