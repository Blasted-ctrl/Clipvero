import { Composition, registerRoot } from "remotion";
import { VideoComposition } from "./composition";
import { dimensions, duration, scriptTimeline } from "../lib/model";
const fallback = scriptTimeline("Clipvero", "9:16", 2);
function Root() {
  return (
    <Composition
      id="Clipvero"
      component={VideoComposition}
      durationInFrames={60}
      fps={30}
      width={720}
      height={1280}
      defaultProps={{ timeline: fallback, media: {} }}
      calculateMetadata={({ props }) => ({
        ...dimensions(props.timeline.aspect),
        durationInFrames: duration(props.timeline),
      })}
    />
  );
}
registerRoot(Root);
