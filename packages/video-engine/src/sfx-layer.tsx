import { Audio, Sequence } from "remotion";
import type { MediaMap } from "./composition";
import type { Timeline } from "./model";
import { planCues, sfxId } from "./sfx";

/** Plays each planned cue as a short audio clip; a missing sound file is skipped. */
export function SfxLayer({
  timeline,
  media,
}: {
  timeline: Timeline;
  media: MediaMap;
}) {
  return (
    <>
      {planCues(timeline).map((cue, i) => {
        const file = media[sfxId(cue.sound)];
        return file ? (
          <Sequence
            key={`${i}-${cue.frame}`}
            from={cue.frame}
            durationInFrames={36}
          >
            <Audio src={file.src} volume={cue.volume} />
          </Sequence>
        ) : null;
      })}
    </>
  );
}
