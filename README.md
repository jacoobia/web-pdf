<div align="center">

<picture>
  <source media="(prefers-color-scheme: dark)" srcset="docs/images/header-dark.png">
  <img alt="Web PDF" src="docs/images/header-light.png" width="840">
</picture>

A PDF editor that runs in your browser. Files are edited locally and never uploaded.

[![CI](https://img.shields.io/github/actions/workflow/status/jacoobia/web-pdf/ci.yml?branch=main&style=flat-square&label=CI)](https://github.com/jacoobia/web-pdf/actions/workflows/ci.yml)
[![Licence](https://img.shields.io/badge/licence-AGPL--3.0-0F766E?style=flat-square)](LICENSE)
[![React](https://img.shields.io/badge/React_19-0F766E?style=flat-square&logo=react&logoColor=white)](https://react.dev)
[![TypeScript](https://img.shields.io/badge/TypeScript-0F766E?style=flat-square&logo=typescript&logoColor=white)](https://www.typescriptlang.org)
[![Bun](https://img.shields.io/badge/Bun-0F766E?style=flat-square&logo=bun&logoColor=white)](https://bun.sh)

[Features](#features) · [Browser support](#browser-support) · [Getting started](#getting-started) · [Deploying](#deploying) · [Contributing](#contributing)

</div>

<table>
  <tr>
    <td width="74%"><img alt="Editing a CV in the dark theme, with page thumbnails and the edit panel" src="docs/images/editor-dark.png"></td>
    <td width="26%"><img alt="The editor on a phone, with the edit panel open as a sheet" src="docs/images/editor-phone.png"></td>
  </tr>
  <tr>
    <td align="center"><sub>Desktop</sub></td>
    <td align="center"><sub>Phone</sub></td>
  </tr>
</table>

## Features

- Start a new PDF from an empty page, A4 or US Letter depending on where you are.
- Edit existing text in place. Edits are drawn in the PDF's own font when it's available.
- Find and replace text across the whole document, with spell check as you type.
- Add new text boxes that wrap to a width you set, with bold, italic and alignment.
- Add and edit links on text, such as an email address or a portfolio.
- Move, copy and delete text and images, with snapping to nearby text.
- Add images such as a photo or signature, and resize any image on the page.
- Merge PDFs: join several files into a new one in the order you choose, or merge a PDF into the one you have open at the start, the end or around the current page. Dropping a PDF on the page list merges it at that spot.
- Reorder, rotate, delete and add blank pages, or save some pages on their own.
- Add headers and footers with page numbers.
- Shrink large images when saving to fit upload limits.
- Edit the title, author, subject and keywords in the Info tab, and remove hidden details such as the app that made the file. Saved copies are marked as made with Web PDF unless you remove the hidden details.
- Check how applicant tracking software will read a CV.
- Edits are saved in your browser as you go, so a closed tab doesn't lose work.
- Undo, redo, multi-select and a right-click menu.
- Light and dark themes, and a layout that works on phones, with pinch to zoom.

### How it works

| | |
| --- | --- |
| Reading, rendering and saving | [MuPDF](https://mupdf.com), in a web worker |
| Measuring text for the preview | [pdf-lib](https://pdf-lib.js.org) and [fontkit](https://github.com/foliojs/fontkit), so lines wrap where they will in the saved file |
| Saving | Only the text you change is redrawn; the rest of the file is kept as it was. |

## Browser support

| | Chrome, Edge | Brave | Firefox, Safari |
| --- | :---: | :---: | :---: |
| Edit and save PDFs | ✓ | ✓ | ✓ |
| Save back over the original file | ✓ | ✓ | Saves as a download |
| Load fonts installed on your computer | ✓ | Sometimes | |

<sub>Tested in Chrome and Brave.</sub>

## Getting started

Requires [Bun](https://bun.sh) 1.2 or newer.

```sh
git clone https://github.com/jacoobia/web-pdf.git
cd web-pdf
bun install
bun run dev
```

| Command | Description |
| --- | --- |
| `bun run dev` | Start the dev server |
| `bun run build` | Typecheck and build to `dist/` |
| `bun run lint` | Lint and check formatting |
| `bun run format` | Fix lint and formatting issues |
| `bun run typecheck` | Run the TypeScript compiler |
| `bun run test` | Run the PDF engine checks (Windows only) |
| `bun run test:e2e` | Run the browser checks in Chrome (Windows only, needs Node 24) |

## Deploying

`bun run build` produces a static site in `dist/` that any static host can serve. Serve it over HTTPS, as saving to files and reading installed fonts only work on secure pages.

Web PDF is licensed under the AGPL, so a hosted copy has to offer its source code to its users. The app links to this repository; if you host a modified version, point `REPO_URL` in `src/components/EditorTools.tsx` at your fork.

## Contributing

See [CONTRIBUTING.md](CONTRIBUTING.md).

## Licence

[AGPL-3.0-or-later](LICENSE). Copyright (C) 2026 Jacob Hampton.
