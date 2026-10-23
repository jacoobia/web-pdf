<picture>
  <source media="(prefers-color-scheme: dark)" srcset="docs/images/header-dark.png">
  <img alt="Web PDF" src="docs/images/header-light.png">
</picture>

A PDF editor that runs in your browser. Files are edited locally and never uploaded.

<p>
  <img alt="Editing a CV in the dark theme, with page thumbnails and the edit panel" src="docs/images/editor-dark.png" width="72%">
  <img alt="The editor on a phone, with the edit panel open as a sheet" src="docs/images/editor-phone.png" width="25%">
</p>

## Getting started

Requires [Bun](https://bun.sh) 1.2 or newer.

```sh
git clone https://github.com/jacoobia/quick-pdf.git
cd quick-pdf
bun install
bun run dev
```

## Scripts

| Command | Description |
| --- | --- |
| `bun run dev` | Start the dev server |
| `bun run build` | Typecheck and build to `dist/` |
| `bun run lint` | Lint and check formatting |
| `bun run format` | Fix lint and formatting issues |
| `bun run typecheck` | Run the TypeScript compiler |
| `bun run test` | Run the end-to-end checks (Windows only) |

## Contributing

See [CONTRIBUTING.md](CONTRIBUTING.md).

## Licence

[AGPL-3.0-or-later](LICENSE). Copyright (C) 2026 Jacob Hampton.
