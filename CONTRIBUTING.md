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

The pre-commit hook runs Biome on staged files and the typechecker. Commit messages are a single line of 72 characters or fewer, written as a summary of the change ("Fix wrapping of long words"), which the commit-msg hook checks.

## Code style

Biome handles formatting and linting; `bun run format` fixes most of what it reports. Beyond that, match the code around your change. Comments explain why something is done, not what the next line does.

## Licence

By contributing, you agree your contribution is licensed under the AGPL-3.0-or-later, the same as the rest of the project.
