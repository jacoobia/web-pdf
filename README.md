<picture>
  <source media="(prefers-color-scheme: dark)" srcset="docs/images/header-dark.png">
  <img alt="Web PDF" src="docs/images/header-light.png">
</picture>

A PDF editor that runs in your browser. Files are edited locally and never uploaded.

<p>
  <img alt="Editing a CV in the dark theme, with page thumbnails and the edit panel" src="docs/images/editor-dark.png" width="72%">
  <img alt="The editor on a phone, with the edit panel open as a sheet" src="docs/images/editor-phone.png" width="25%">
</p>

## Features

- Edit existing text in place. Edits are drawn in the PDF's own font when it's available.
- Add new text boxes that wrap to a width you set.
- Move, copy and delete text and images, with snapping to nearby text.
- Add headers and footers with page numbers.
- Undo, redo, multi-select and a right-click menu.
- Light and dark themes, and a layout that works on phones.

PDFs are read and rendered with [MuPDF](https://mupdf.com) in a web worker, and new text is written with [pdf-lib](https://pdf-lib.js.org). Only the text you change is redrawn; the rest of the file is kept as it was.

## Browser support

Tested in Chrome and Brave, and it should work in any current browser. Chrome and Edge can also save back over the original file and load fonts installed on your computer. Firefox and Safari save the edited PDF as a download instead.

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

## Deploying

`bun run build` produces a static site in `dist/` that any static host can serve. Serve it over HTTPS, as saving to files and reading installed fonts only work on secure pages.

Web PDF is licensed under the AGPL, so a hosted copy has to offer its source code to its users. The app links to this repository; if you host a modified version, point `REPO_URL` in `src/components/EditorTools.tsx` at your fork.

## Contributing

See [CONTRIBUTING.md](CONTRIBUTING.md).

## Licence

[AGPL-3.0-or-later](LICENSE). Copyright (C) 2026 Jacob Hampton.
