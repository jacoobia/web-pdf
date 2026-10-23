import { compact, type El, fontHelp } from "../../lib/pdf";
import { Note, TextLink } from "../ui";

export function FontNote({ el, loaded, onUseForAll }: { el: El; loaded: boolean; onUseForAll: () => void }) {
  const help = fontHelp(el.srcFont);
  const exact = compact(el.font) === compact(el.srcFont);
  return (
    <Note ok={exact}>
      <p>
        Original font: <strong>{el.srcFont}</strong>
      </p>
      {exact ? (
        <p>Loaded, so edits match exactly.</p>
      ) : (
        <>
          <p>
            {loaded ? "You picked a different font. " : "This font isn't loaded. "}
            Changed text will be drawn in <strong>{el.font}</strong>.
          </p>
          {!loaded && (
            <p>
              <TextLink href={help.googleUrl}>Search Google Fonts</TextLink>
              {help.alternative && (
                <>
                  {" "}
                  or get <TextLink href={help.alternative.url}>{help.alternative.family}</TextLink>, a free font with
                  the same character widths
                </>
              )}
              , then load the .ttf.
            </p>
          )}
          <TextLink onClick={onUseForAll}>
            Use {el.font} for all {el.srcFont} text
          </TextLink>
        </>
      )}
    </Note>
  );
}
