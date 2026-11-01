import { isValidElement, type ReactNode, useEffect, useId, useRef, useState, useSyncExternalStore } from "react";
import { cx } from "../lib/cx";
import { TOPICS, type Topic } from "./guideTopics";
import { Button, Dialog, Icon, Muted, TextInput, TextLink } from "./ui";
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
const TEXT = new Map(TOPICS.map((t) => [t, textOf(t.body(titleOf)).replace(/\s+/g, " ").trim()]));
const SEARCH = new Map(TOPICS.map((t) => [t, `${t.section} ${t.title} ${TEXT.get(t)}`.toLowerCase()]));
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

const PHONE = "(max-width: 760px)";
const onResize = (f: () => void) => {
  const q = matchMedia(PHONE);
  q.addEventListener("change", f);
  return () => q.removeEventListener("change", f);
};
const usePhone = () => useSyncExternalStore(onResize, () => matchMedia(PHONE).matches);

/** The sentence around the first searched word, with the word itself marked. */
function Snippet({ topic, query }: { topic: Topic; query: string }) {
  const text = TEXT.get(topic)!;
  const word = query.toLowerCase().split(/\s+/)[0];
  const at = text.toLowerCase().indexOf(word);
  if (at < 0) return <p className="guide-snippet">{text.length > 110 ? `${text.slice(0, 110)}…` : text}</p>;
  const from = at > 40 ? text.indexOf(" ", at - 40) + 1 : 0;
  const to = Math.min(text.length, at + word.length + 70);
  return (
    <p className="guide-snippet">
      {from > 0 && "…"}
      {text.slice(from, at)}
      <mark>{text.slice(at, at + word.length)}</mark>
      {text.slice(at + word.length, to)}
      {to < text.length && "…"}
    </p>
  );
}

export function Guide({ topic, onClose }: { topic: string; onClose: () => void }) {
  const phone = usePhone();
  const [id, setId] = useState(topic);
  // Phones open on the topic list unless something asked for a particular topic.
  const [reading, setReading] = useState(topic !== "open");
  const [filter, setFilter] = useState("");
  const article = useRef<HTMLElement>(null);
  const filterRef = useRef<HTMLInputElement>(null);
  useEffect(() => {
    if (!matchMedia(PHONE).matches) filterRef.current?.focus();
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
  const query = filter.trim();
  const hits = TOPICS.filter((t) => matches(t, query));
  const titled = hits.filter((t) => t.title.toLowerCase().includes(query.toLowerCase()));
  const ranked = [...titled, ...hits.filter((t) => !titled.includes(t))];
  const found = sections(hits);
  const show = (to: string) => {
    setId(to);
    setReading(true);
    article.current?.scrollTo(0, 0);
  };
  const go = (to: string) => <TextLink onClick={() => show(to)}>{titleOf(to).toLowerCase()}</TextLink>;
  const search = (
    <TextInput
      ref={filterRef}
      className="guide-filter"
      aria-label="Filter topics"
      placeholder={phone ? "Search the guide" : "/ Filter topics (Ctrl+K)"}
      value={filter}
      onChange={(e) => setFilter(e.target.value)}
      onKeyDown={(e) => e.key === "Enter" && ranked[0] && show(ranked[0].id)}
    />
  );
  const page = (
    <article ref={article} className="guide-article" aria-labelledby={titleId}>
      {phone && (
        <button type="button" className="guide-back" onClick={() => setReading(false)}>
          <Icon name="chevron" size={16} />
          Guide
        </button>
      )}
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
  );

  if (phone)
    return (
      <Dialog
        title="Guide"
        wide
        onClose={onClose}
        bodyClass="guide-body"
        footer={
          reading && (
            <>
              {prev && (
                <Button variant="ghost" className="guide-step" onClick={() => show(prev.id)}>
                  <small>Previous</small>
                  {prev.title}
                </Button>
              )}
              {next && (
                <Button className="guide-step next" onClick={() => show(next.id)}>
                  <small>Next</small>
                  {next.title}
                </Button>
              )}
            </>
          )
        }
      >
        {reading ? (
          page
        ) : (
          <div className="guide-home">
            {search}
            {!query ? (
              <nav className="guide-groups" aria-label="Guide topics">
                {sections(TOPICS).map((s) => (
                  <div key={s.label}>
                    <h3>{s.label}</h3>
                    <ul>
                      {s.topics.map((t) => (
                        <li key={t.id}>
                          <button type="button" onClick={() => show(t.id)}>
                            {t.title}
                            <Icon name="chevron" size={16} />
                          </button>
                        </li>
                      ))}
                    </ul>
                  </div>
                ))}
              </nav>
            ) : (
              <ul className="guide-results" aria-label="Search results">
                {!ranked.length && <Muted>No topics match.</Muted>}
                {ranked.map((t) => (
                  <li key={t.id}>
                    <button type="button" onClick={() => show(t.id)}>
                      <span className="guide-result-head">
                        {t.title}
                        <span>{t.section}</span>
                      </span>
                      <Snippet topic={t} query={query} />
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </div>
        )}
      </Dialog>
    );

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
        {search}
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
      </div>
      {page}
    </Dialog>
  );
}
