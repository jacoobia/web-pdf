import type { ReactNode } from "react";
import { Callout, Kbd } from "./ui";

export type Topic = {
  id: string;
  section: string;
  title: string;
  /** Alt text for public/guide/<id>.webp; `moving` ones also have a <id>-still.webp for reduced motion. */
  shot?: string;
  moving?: boolean;
  body: (go: Go) => ReactNode;
};
type Go = (id: string) => ReactNode;

const k = (...keys: string[]) =>
  keys.map((key, i) => (
    <span key={key}>
      {i > 0 && "+"}
      <Kbd>{key}</Kbd>
    </span>
  ));

const SHORTCUTS: [ReactNode, string][] = [
  [k("Ctrl", "Z"), "Undo"],
  [k("Ctrl", "Y"), "Redo"],
  [k("Ctrl", "F"), "Find and replace"],
  [k("Ctrl", "A"), "Select everything on the pages"],
  [k("Ctrl", "C"), "Copy"],
  [k("Ctrl", "X"), "Cut"],
  [k("Ctrl", "V"), "Paste text, an image or copied items"],
  [k("Ctrl", "D"), "Duplicate"],
  [k("Ctrl", "B"), "Bold"],
  [k("Ctrl", "I"), "Italic"],
  [k("Enter"), "Edit the focused text"],
  [k("Ctrl", "Enter"), "Finish editing text on the page"],
  [k("Delete"), "Delete the selection"],
  [k("Arrow keys"), "Nudge by 1 pt"],
  [k("Shift", "Arrow keys"), "Nudge by 10 pt"],
  [k("Esc"), "Clear the selection, or stop adding text"],
  [k("Ctrl", "Mouse wheel"), "Zoom"],
  [k("?"), "Open this guide"],
  [k("Ctrl", "K"), "Search this guide"],
];

export const TOPICS: Topic[] = [
  {
    id: "open",
    section: "Getting started",
    title: "Opening a PDF",
    body: () => (
      <>
        <p>
          Drop a PDF anywhere in the window, or click the drop box on the start screen to choose one. The file is read
          on your computer and never uploaded.
        </p>
        <p>
          Files you open appear under <strong>Recently opened</strong>. Chrome and Edge reopen the file itself, and may
          ask for permission first. A copy of files up to 50 MB is also kept in this browser, so they can be reopened
          anywhere.
        </p>
        <Callout>
          Remove a file from the list with the cross next to it, or empty the list with <strong>Clear list</strong>.
          This also deletes the stored copies.
        </Callout>
      </>
    ),
  },
  {
    id: "new",
    section: "Getting started",
    title: "Starting a new PDF",
    body: (go) => (
      <>
        <p>
          Choose <strong>New PDF</strong> on the start screen or in the file menu. You get one empty page: A4, or Letter
          if that's the paper size where you are.
        </p>
        <p>
          Fill it with {go("add-text")} and {go("images")}, and add more pages from the <strong>Pages</strong> tab. It
          saves as Untitled.pdf unless you choose another name.
        </p>
      </>
    ),
  },
  {
    id: "save",
    section: "Getting started",
    title: "Saving",
    body: (go) => (
      <>
        <p>
          Press <strong>Save</strong>. In Chrome and Edge you choose where the file goes, and can save over the
          original. Other browsers download a copy named like <em>cv-edited.pdf</em>.
        </p>
        <p>
          After saving, Web PDF reads the new file back to check that old text is gone and new text can be selected and
          searched. If anything looks wrong, it tells you what to check.
        </p>
        <p>If you close the PDF or open another with unsaved edits, you're asked whether to save a copy first.</p>
        <p>To save only some pages, see {go("split")}.</p>
      </>
    ),
  },
  {
    id: "restore",
    section: "Getting started",
    title: "Restoring unsaved edits",
    body: (go) => (
      <>
        <p>
          Edits are kept in this browser as you work, so closing the tab doesn't lose them. Open the same file again and
          a message offers <strong>Restore edits</strong>. Dismiss it to start from the file as it is.
        </p>
        <p>
          Turn this off with <strong>Save edits as you go</strong> in Settings. Turning it off deletes any stored edits.
          See {go("privacy")} for everything kept in the browser.
        </p>
      </>
    ),
  },
  {
    id: "edit-text",
    section: "Editing",
    title: "Editing text",
    shot: "Double-clicking a name on the page and typing a new one in place",
    moving: true,
    body: (go) => (
      <>
        <ol>
          <li>Double-click the text, or select it and press Enter.</li>
          <li>Type your changes.</li>
          <li>Click away to finish.</li>
        </ol>
        <p>
          The <strong>Edit text</strong> setting chooses where you type: in the side panel, or on the page itself. On
          the page, press <Kbd>Esc</Kbd> or <Kbd>Ctrl</Kbd>+<Kbd>Enter</Kbd> to finish.
        </p>
        <p>
          Only text you change is redrawn. Everything else stays exactly as it was. <strong>Reset to original</strong>{" "}
          undoes all changes to the selected text.
        </p>
        <Callout>
          If edited text looks different from the rest, the PDF's font probably isn't loaded. See {go("fonts")}.
        </Callout>
      </>
    ),
  },
  {
    id: "add-text",
    section: "Editing",
    title: "Adding text",
    body: () => (
      <>
        <ol>
          <li>
            Choose <strong>Add text</strong> in the toolbar.
          </li>
          <li>Click where the text should go.</li>
          <li>Type it.</li>
        </ol>
        <p>
          Press <Kbd>Esc</Kbd> or choose <strong>Select</strong> to stop adding text. You can also paste text copied
          from another app with <Kbd>Ctrl</Kbd>+<Kbd>V</Kbd>.
        </p>
      </>
    ),
  },
  {
    id: "select",
    section: "Editing",
    title: "Selecting and moving",
    shot: "Dragging across lines to select them, then dragging them down the page",
    moving: true,
    body: () => (
      <>
        <ul>
          <li>Click text or an image to select it, then drag to move it.</li>
          <li>Drag across empty space to select several things at once.</li>
          <li>
            Use the arrow keys to nudge by 1 pt, or hold <Kbd>Shift</Kbd> to nudge by 10 pt.
          </li>
        </ul>
        <p>
          Dragged items snap to line up with other text. Hold <Kbd>Shift</Kbd> while dragging to move freely, or{" "}
          <Kbd>Ctrl</Kbd> to move in whole points. Settings has options for snapping and for keeping items inside the
          page margin.
        </p>
        <p>
          Right-click for cut, copy, paste, duplicate and delete. With several lines of text selected,{" "}
          <strong>Merge into one text box</strong> joins them into a single box that wraps.
        </p>
      </>
    ),
  },
  {
    id: "style",
    section: "Editing",
    title: "Styling text",
    body: () => (
      <>
        <p>With text selected, the Edit tab sets:</p>
        <ul>
          <li>
            <strong>Bold</strong> and <strong>italic</strong>, and left, centre or right alignment.
          </li>
          <li>
            <strong>Font</strong>, <strong>size</strong> and <strong>colour</strong>.
          </li>
          <li>
            <strong>Width</strong>, which makes long text wrap. You can also drag the handle on the right edge of the
            text, and double-click it to go back to automatic width.
          </li>
          <li>
            <strong>Line spacing</strong> for text that runs over several lines.
          </li>
          <li>
            <strong>Link</strong>, a web address or email that opens when the text is clicked in a PDF reader.
          </li>
        </ul>
      </>
    ),
  },
  {
    id: "images",
    section: "Editing",
    title: "Images",
    shot: "An image added to the page and resized by dragging its corner",
    moving: true,
    body: () => (
      <>
        <p>
          Choose <strong>Add image</strong>, drop a picture onto the page, or paste one. PNG, JPEG and WebP all work.
          New images are placed in the middle of the page.
        </p>
        <p>
          Drag the corner handle to resize. It keeps the image's proportions. Images already in the PDF can be moved,
          resized and deleted too.
        </p>
      </>
    ),
  },
  {
    id: "fonts",
    section: "Editing",
    title: "Fonts",
    body: () => (
      <>
        <p>
          PDFs usually carry only the letters they use, so edited text needs the full font. The <strong>Fonts</strong>{" "}
          tab lists every font in the file and shows whether it's loaded.
        </p>
        <ul>
          <li>
            <strong>Load font file…</strong> takes a .ttf or .otf file. On Windows, installed fonts are in
            C:\Windows\Fonts.
          </li>
          <li>
            <strong>Find on this PC</strong> loads installed fonts directly, in Chrome and Edge.
          </li>
          <li>
            For a missing font, the tab links to Google Fonts and, where there is one, a free lookalike with the same
            letter widths.
          </li>
        </ul>
        <p>
          <strong>Change font</strong> redraws all text, or one page's text, in another font. Bold and italic are kept
          where the font has them.
        </p>
      </>
    ),
  },
  {
    id: "find",
    section: "Editing",
    title: "Find and replace",
    body: () => (
      <>
        <p>
          Press <Kbd>Ctrl</Kbd>+<Kbd>F</Kbd> or choose the search button. Press <Kbd>Enter</Kbd> for the next match and{" "}
          <Kbd>Shift</Kbd>+<Kbd>Enter</Kbd> for the previous one.
        </p>
        <p>
          Replace changes the current match. Replace all changes every match, and one undo puts them all back. Deleted
          pages are skipped.
        </p>
      </>
    ),
  },
  {
    id: "pages",
    section: "Pages",
    title: "Arranging pages",
    shot: "Right-clicking a page thumbnail and rotating the page",
    moving: true,
    body: () => (
      <>
        <p>
          The page thumbnails down the side show every page. Drag a thumbnail to reorder, or right-click it to rotate,
          move, add a blank page or delete it.
        </p>
        <p>
          The <strong>Pages</strong> tab does the same for the page at the top of the view, and adds a blank page after
          it.
        </p>
      </>
    ),
  },
  {
    id: "merge",
    section: "Pages",
    title: "Merging PDFs",
    body: () => (
      <>
        <p>To join several PDFs into a new one:</p>
        <ol>
          <li>
            Choose <strong>Merge PDFs</strong> on the start screen, or drop several PDFs onto the window.
          </li>
          <li>Put them in order with the up and down arrows.</li>
          <li>
            Choose <strong>Merge</strong>.
          </li>
        </ol>
        <p>To add another PDF's pages to the one that's open:</p>
        <ul>
          <li>Drop it on a page thumbnail. Its pages go in at that spot.</li>
          <li>
            Or use <strong>Merge a PDF</strong> in the Pages tab and choose where the pages go.
          </li>
        </ul>
        <p>Merging can be undone like any other edit.</p>
      </>
    ),
  },
  {
    id: "header",
    section: "Pages",
    title: "Headers and footers",
    shot: "Typing a footer with page numbers and seeing it appear on the page",
    moving: true,
    body: () => (
      <>
        <p>
          Open <strong>Header &amp; footer</strong> in the Pages tab. Each has a left, centre and right slot. Type{" "}
          <code>{"{page}"}</code> for the page number and <code>{"{pages}"}</code> for the page count, as in{" "}
          <em>
            Page {"{page}"} of {"{pages}"}
          </em>
          .
        </p>
        <p>Set the font, size, colour and distance from the edge, and choose whether to skip the first page.</p>
      </>
    ),
  },
  {
    id: "split",
    section: "Pages",
    title: "Saving some pages",
    body: () => (
      <>
        <p>
          In the Pages tab, type the pages you want under <strong>Save some pages</strong>, like <em>1-3, 5</em>, and
          choose <strong>Save pages</strong>. They're saved as a new PDF in that order, and the open file isn't changed.
        </p>
      </>
    ),
  },
  {
    id: "forms",
    section: "Forms and signatures",
    title: "Filling in forms",
    body: (go) => (
      <>
        <p>
          When a PDF has form fields, you can fill them in on the page: type into text boxes, tick checkboxes, pick an
          option from a list. Fields the form locks are greyed out.
        </p>
        <p>
          Answers are saved into the file, so other PDF readers show them too, and they come back with {go("restore")}.
        </p>
      </>
    ),
  },
  {
    id: "sign",
    section: "Forms and signatures",
    title: "Signing",
    shot: "Typing a signature and placing it in a form's signature box",
    moving: true,
    body: () => (
      <>
        <ol>
          <li>
            Choose <strong>Sign here</strong> on a form's signature box, or <strong>Add a signature</strong> in the
            toolbar.
          </li>
          <li>Draw your signature, or type your name and it's written in a handwriting font.</li>
          <li>Pick an ink colour.</li>
          <li>
            Choose <strong>Add signature</strong>.
          </li>
        </ol>
        <p>
          On a signature box, it's sized to fit the box. Otherwise it's placed in the middle of the page, ready to move.
        </p>
        <p>
          Tick <strong>Remember this signature on this device</strong> to reuse it from the <strong>Saved</strong> tab
          next time. <strong>Forget this signature</strong> deletes it.
        </p>
        <Callout>
          This places a picture of your signature. It isn't a certificate-based digital signature, which some official
          forms ask for.
        </Callout>
      </>
    ),
  },
  {
    id: "details",
    section: "Document",
    title: "Document details",
    body: () => (
      <>
        <p>
          The <strong>Document</strong> tab shows the title, author and other details that PDF readers display. Edit
          them there.
        </p>
        <p>
          <strong>Hidden details</strong> lists what else the file holds, such as the app that made it. Tick{" "}
          <strong>Remove these when saving</strong> to save a copy without them.
        </p>
      </>
    ),
  },
  {
    id: "size",
    section: "Document",
    title: "Making the file smaller",
    body: () => (
      <>
        <p>
          Under <strong>File size</strong> in the Document tab, choose how images are saved. <em>Balanced</em> and{" "}
          <em>Smallest</em> scale large images down and save them as JPEG. Text and drawings aren't changed.
        </p>
        <p>Check the size it saves at before you save, which helps with upload limits.</p>
      </>
    ),
  },
  {
    id: "ats",
    section: "Document",
    title: "Checking a CV for ATS",
    body: () => (
      <>
        <p>
          Applicant tracking software reads the text out of a CV rather than looking at it. <strong>ATS check</strong>{" "}
          in the Document tab shows the text exactly as such software gets it, in the order it reads it, and points out
          anything likely to trip it up.
        </p>
      </>
    ),
  },
  {
    id: "shortcuts",
    section: "Reference",
    title: "Keyboard shortcuts",
    body: () => (
      <>
        <p>
          On a Mac, use <Kbd>Cmd</Kbd> in place of <Kbd>Ctrl</Kbd>.
        </p>
        <div className="guide-table">
          <table>
            <tbody>
              {SHORTCUTS.map(([keys, what]) => (
                <tr key={what}>
                  <td>{keys}</td>
                  <td>{what}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </>
    ),
  },
  {
    id: "touch",
    section: "Reference",
    title: "Phones and tablets",
    body: () => (
      <>
        <ul>
          <li>The tools and zoom sit together at the bottom of the screen, within reach of your thumb.</li>
          <li>Pinch with two fingers to zoom.</li>
          <li>Tap to select, and drag to move.</li>
          <li>The panel opens as a sheet from the bottom. Close it to see the whole page.</li>
          <li>
            Find and replace, the panel, the theme, the guide, settings and feedback are under <strong>⋯</strong> at the
            top.
          </li>
        </ul>
      </>
    ),
  },
  {
    id: "privacy",
    section: "Reference",
    title: "Privacy and stored data",
    body: () => (
      <>
        <p>Your PDFs are opened, edited and saved on your computer. The page isn't allowed to send them anywhere.</p>
        <p>This browser keeps:</p>
        <ul>
          <li>the list of recently opened files, and copies of those up to 50 MB</li>
          <li>unsaved edits, if Save edits as you go is on</li>
          <li>your signature, if you chose to remember it</li>
          <li>your settings</li>
        </ul>
        <p>
          <strong>Clear stored data</strong> in Settings deletes all of it apart from your settings.
        </p>
        <p>
          The feedback form is the only part that talks to another site, and it can't see the page, your files or
          anything stored.
        </p>
      </>
    ),
  },
];
