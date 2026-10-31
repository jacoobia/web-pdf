import { isValidElement, type ReactNode, useEffect, useId, useRef, useState } from "react";
import { cx } from "../lib/cx";
import { TOPICS, type Topic } from "./guideTopics";
import { Button, Dialog, Muted, Select, TextInput, TextLink } from "./ui";
import "./Guide.css";

const textOf = (n: ReactNode): string =>
  typeof n === "string" || typeof n === "number"
    ? `${n}`
    : Array.isArray(n)
      ? n.map(textOf).join(" ")
      : isValidElement(n)
        ? textOf((n.props as { children?: ReactNode }).children)
        : "";

const titleOf = (id: string) => TOPICS.find((t) => t.id === id)!.title;
const SEARCH = new Map(TOPICS.map((t) => [t, `${t.section} ${t.title} ${textOf(t.body(titleOf))}`.toLowerCase()]));
const matches = (t: Topic, filter: string) =>
  filter
    .toLowerCase()
    .split(/\s+/)
    .every((word) => SEARCH.get(t)!.includes(word));

const sections = (topics: Topic[]) =>
  [...new Set(topics.map((t) => t.section))].map((label) => ({
    label,
    topics: topics.filter((t) => t.section === label),
  }));

const media = (t: Topic) => `${import.meta.env.BASE_URL}guide/${t.id}`;

export function Guide({ topic, onClose }: { topic: string; onClose: () => void }) {
  const [id, setId] = useState(topic);
  const [filter, setFilter] = useState("");
  const article = useRef<HTMLElement>(null);
  const filterRef = useRef<HTMLInputElement>(null);
  useEffect(() => {
    filterRef.current?.focus();
    const onKey = (e: KeyboardEvent) => {
      if (!(e.ctrlKey || e.metaKey) || e.key.toLowerCase() !== "k") return;
      e.preventDefault();
      filterRef.current?.select();
    };
    addEventListener("keydown", onKey, true);
    return () => removeEventListener("keydown", onKey, true);
  }, []);
  const titleId = useId();
  const at = Math.max(
    0,
    TOPICS.findIndex((t) => t.id === id),
  );
  const [prev, here, next] = [TOPICS[at - 1], TOPICS[at], TOPICS[at + 1]];
  const hits = TOPICS.filter((t) => matches(t, filter.trim()));
  const found = sections(hits);
  const best = hits.find((t) => t.title.toLowerCase().includes(filter.trim().toLowerCase())) ?? hits[0];
  const show = (to: string) => {
    setId(to);
    article.current?.scrollTo(0, 0);
  };
  const go = (to: string) => <TextLink onClick={() => show(to)}>{titleOf(to).toLowerCase()}</TextLink>;
  return (
    <Dialog
      title="Guide"
      wide
      onClose={onClose}
      bodyClass="guide-body"
      footer={
        <>
          {prev && (
            <Button variant="ghost" className="guide-prev" onClick={() => show(prev.id)}>
              Previous
            </Button>
          )}
          {next && <Button onClick={() => show(next.id)}>Next: {next.title}</Button>}
        </>
      }
    >
      <div className="guide-side">
        <TextInput
          ref={filterRef}
          className="guide-filter"
          aria-label="Filter topics"
          placeholder="/ Filter topics (Ctrl+K)"
          value={filter}
          onChange={(e) => setFilter(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && best && show(best.id)}
        />
        <nav className="guide-nav" aria-label="Guide topics">
          {!found.length && <Muted>No topics match.</Muted>}
          {found.map((s) => (
            <div key={s.label}>
              <h3>{s.label}</h3>
              <ul>
                {s.topics.map((t) => (
                  <li key={t.id}>
                    <button
                      type="button"
                      className={cx(t.id === here.id && "on")}
                      aria-current={t.id === here.id ? "page" : undefined}
                      onClick={() => show(t.id)}
                    >
                      {t.title}
                    </button>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </nav>
        <Select
          className="guide-pick"
          aria-label="Guide topic"
          value={here.id}
          onChange={(e) => show(e.target.value)}
          placeholder={found.some((s) => s.topics.includes(here)) ? undefined : "Choose a topic"}
          groups={found.map((s) => ({ label: s.label, options: s.topics.map((t) => [t.id, t.title] as const) }))}
        />
      </div>
      <article ref={article} className="guide-article" aria-labelledby={titleId}>
        <p className="guide-section">{here.section}</p>
        <h3 id={titleId}>{here.title}</h3>
        {here.body(go)}
        {here.shot && (
          <picture key={here.id} className="guide-media">
            {here.moving && <source media="(prefers-reduced-motion: reduce)" srcSet={`${media(here)}-still.webp`} />}
            <img src={`${media(here)}.webp`} alt={here.shot} />
          </picture>
        )}
      </article>
    </Dialog>
  );
}
