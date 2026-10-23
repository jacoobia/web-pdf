# Web PDF

A PDF editor that runs entirely in your browser. I couldn't find a free, easy-to-use one online to edit my CV with, so I made one.

Your files never leave your machine. There's no server: the PDF is read, edited and saved in the page itself.

## What it does

- Edit existing text in place, keeping the original font where the PDF embeds it
- Add new text boxes, with wrapping and font, size and colour controls
- Move, resize, copy and delete text and images
- Add headers and footers, with an optional margin guide
- Snap to the edges and centres of nearby elements as you drag
- Undo and redo, multi-select and a right-click menu
- Reopen recent files from the start screen

Edits are saved as a new PDF. Only the parts you changed are redrawn; everything else is copied over untouched.

Chrome and Edge get the most out of it: they can save back over the original file and use fonts installed on your computer. Firefox and Safari work too, but save through a download.

## Running it

You need [Bun](https://bun.sh) 1.2 or newer.

```sh
bun install
bun run dev
```

| Command | What it does |
| --- | --- |
| `bun run dev` | Start the dev server |
| `bun run build` | Typecheck and build the static site into `dist/` |
| `bun run lint` | Lint and check formatting with Biome |
| `bun run format` | Fix what Biome can fix |
| `bun run test` | Run the end-to-end checks in `scripts/check.ts` (Windows only for now, as they embed Calibri and Arial) |

`bun install` also points git at the hooks in `.githooks`, which lint staged files and check commit messages.

## Hosting

`bun run build` produces a plain static site in `dist/`, so any static host works. The `.wasm` file needs to be served with the `application/wasm` content type, which most hosts already do.

## How it works

[MuPDF](https://mupdf.com) reads the PDF, renders the pages and removes the original text you edit or delete. [pdf-lib](https://pdf-lib.js.org) then writes the new text and embeds the fonts. Rendering and saving run in a web worker so the page stays responsive on large files.

## Contributing

See [CONTRIBUTING.md](CONTRIBUTING.md).

## Licence

Copyright (C) 2026 Jacob Hampton

Web PDF is free software under the [GNU Affero General Public License v3.0 or later](LICENSE). MuPDF is AGPL too, which is why: if you host a modified copy, you have to offer your users its source code.

The interface uses [IBM Plex Sans](https://github.com/IBM/plex) under the SIL Open Font License.
