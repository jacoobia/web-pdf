import { useEffect, useRef, useState } from "react";
import type { Editor } from "../lib/editor";
import { Button, Checkbox, Icon, IconButton, Muted, TextInput } from "./ui";
import "./FindBar.css";

export function FindBar({ editor }: { editor: Editor }) {
  const [query, setQuery] = useState("");
  const [replacement, setReplacement] = useState("");
  const [matchCase, setMatchCase] = useState(false);
  const [current, setCurrent] = useState(0);
  const input = useRef<HTMLInputElement>(null);
  const matches = editor.find(query, matchCase);
  const at = matches.length ? Math.min(current, matches.length - 1) : -1;
  useEffect(() => input.current?.select(), []);

  const go = (i: number) => {
    if (!matches.length) return;
    const next = (i + matches.length) % matches.length;
    setCurrent(next);
    editor.showMatch(matches[next]);
  };
  const replaceOne = () => {
    if (at < 0) return;
    editor.replaceIn([matches[at]], query.length, replacement);
  };
  const replaceAll = () => {
    const changed = editor.replaceIn(matches, query.length, replacement);
    editor.setReport({
      ok: true,
      lines: [`Replaced ${matches.length} in ${changed} text ${changed === 1 ? "item" : "items"}.`],
    });
  };
  const close = () => editor.setFindOpen(false);

  return (
    <search
      className="find-bar"
      aria-label="Find and replace"
      onKeyDown={(e) => {
        if (e.key === "Escape") e.stopPropagation(), close();
        if (e.key === "Enter" && e.target === input.current) e.preventDefault(), go(e.shiftKey ? at - 1 : at + 1);
      }}
    >
      <div className="find-row">
        <Icon name="search" />
        <TextInput
          ref={input}
          value={query}
          placeholder="Find"
          aria-label="Find"
          onChange={(e) => (setQuery(e.target.value), setCurrent(0))}
        />
        <Muted inline>{query ? (matches.length ? `${at + 1} of ${matches.length}` : "No matches") : ""}</Muted>
        <IconButton
          icon="chevronUp"
          label="Previous match"
          shortcut="Shift+Enter"
          disabled={!matches.length}
          onClick={() => go(at - 1)}
        />
        <IconButton
          icon="chevron"
          label="Next match"
          shortcut="Enter"
          disabled={!matches.length}
          onClick={() => go(at + 1)}
        />
        <IconButton icon="close" label="Close find" shortcut="Esc" onClick={close} />
      </div>
      <div className="find-row">
        <TextInput
          value={replacement}
          placeholder="Replace with"
          aria-label="Replace with"
          onChange={(e) => setReplacement(e.target.value)}
        />
        <Button size="small" disabled={at < 0} onClick={replaceOne}>
          Replace
        </Button>
        <Button size="small" disabled={!matches.length} onClick={replaceAll}>
          Replace all
        </Button>
      </div>
      <Checkbox
        label="Match case"
        checked={matchCase}
        onChange={(e) => (setMatchCase(e.target.checked), setCurrent(0))}
      />
    </search>
  );
}
