import { Easing, interpolate } from "remotion";
import type { Visual } from "./model";

type MapVisual = Extract<Visual, { type: "hashmap" }>;
const text = { fill: "#E8EFF7", textAnchor: "middle" as const };
const fade = (frame: number, end = 24) =>
  interpolate(frame, [0, end], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
    easing: Easing.inOut(Easing.cubic),
  });

export function HashDetail({
  v,
  frame,
  accent,
  stored,
  entries,
  count,
}: {
  v: MapVisual;
  frame: number;
  accent: string;
  stored: number;
  entries: { key: string; bucket: number }[];
  count?: number;
}) {
  if (v.detail === "probing") {
    const other =
      v.entries.find(
        (entry) => entry.bucket === v.bucket && entry.key !== v.key,
      )?.key ?? "occupied";
    const progress = fade(frame, 36);
    return (
      <g opacity={fade(frame)}>
        <rect
          x={46}
          y={106}
          width={628}
          height={220}
          rx={14}
          fill="#0C1825"
          stroke="#3A506A"
        />
        <text {...text} x={360} y={135} fontSize={19} fill={accent}>
          ALTERNATIVE: OPEN ADDRESSING
        </text>
        <text {...text} x={360} y={161} fontSize={16} fill="#A8BCD3">
          ONE ENTRY PER SLOT · ILLUSTRATIVE PLACEMENT
        </text>
        {[0, 1, 2].map((offset) => (
          <g key={offset}>
            <rect
              x={144 + offset * 146}
              y={203}
              width={132}
              height={62}
              rx={8}
              fill={offset === 1 && progress === 1 ? `${accent}24` : "#152232"}
              stroke={offset < 2 ? accent : "#394B60"}
              strokeWidth={offset < 2 ? 2 : 1}
            />
            <text
              {...text}
              x={210 + offset * 146}
              y={244}
              fontSize={23}
              opacity={offset === 1 ? progress : 1}
            >
              {offset === 0 ? other : offset === 1 ? v.key : "empty"}
            </text>
            <text
              {...text}
              x={210 + offset * 146}
              y={290}
              fontSize={17}
              fill="#A8BCD3"
            >
              slot {(v.bucket + offset) % 6}
            </text>
          </g>
        ))}
        <path
          d="M210 195 Q283 169 356 195"
          fill="none"
          stroke={accent}
          strokeWidth={2}
        />
        <circle
          cx={210 + 146 * progress}
          cy={195 - 52 * progress * (1 - progress)}
          r={5}
          fill={accent}
        />
        <text {...text} x={360} y={346} fontSize={15} fill="#A8BCD3">
          ORIGINAL CHAINED TABLE BELOW
        </text>
      </g>
    );
  }
  if (v.detail === "long-keys") {
    const key = v.longKey ?? v.key;
    const characters = Array.from(key);
    const columns = Math.min(16, characters.length);
    const read = Math.max(
      0,
      Math.min(
        characters.length,
        count ?? Math.floor(fade(frame, 60) * characters.length),
      ),
    );
    const rowHeight = characters.length > 32 ? 31 : 39;
    return (
      <g>
        <rect
          x={46}
          y={106}
          width={628}
          height={220}
          rx={14}
          fill="#0C1825"
          stroke="#3A506A"
        />
        <text {...text} x={360} y={137} fontSize={18} fill="#A8BCD3">
          SEPARATE EXAMPLE KEY · READ ITS CHARACTERS
        </text>
        {characters.map((character, i) => {
          const x = 360 - (columns * 34) / 2 + (i % columns) * 34;
          const y = 156 + Math.floor(i / columns) * rowHeight;
          const checked = i < read;
          return (
            <g key={i} data-character={i} data-read={checked}>
              <rect
                x={x}
                y={y}
                width={30}
                height={28}
                rx={3}
                fill={checked ? `${accent}35` : "#152232"}
                stroke={i === read ? accent : "#354A61"}
              />
              <text
                {...text}
                x={x + 15}
                y={y + 21}
                fontSize={20}
                fill={checked ? "#FFFFFF" : "#A8BCD3"}
              >
                {character}
              </text>
            </g>
          );
        })}
        <text {...text} x={360} y={288} fontSize={25} fill={accent}>
          {read} / {characters.length} characters read
        </text>
        <text {...text} x={360} y={314} fontSize={15} fill="#A8BCD3">
          KEY LENGTH IS ANOTHER INPUT TO THE WORK
        </text>
      </g>
    );
  }
  if (v.detail === "build") {
    const width = 576 / entries.length;
    return (
      <g>
        <text {...text} x={360} y={135} fontSize={19} fill="#A8BCD3">
          SMALL BUILD EXAMPLE · ONE SLOT PER ENTRY
        </text>
        <text {...text} x={360} y={185} fontSize={34} fill={accent}>
          {stored} / {entries.length} entries stored
        </text>
        {entries.map((entry, i) => (
          <g key={entry.key}>
            <rect
              x={72 + i * width + 3}
              y={216}
              width={width - 6}
              height={58}
              rx={8}
              fill={i < stored ? `${accent}24` : "#101A27"}
              stroke={i < stored ? accent : "#40526A"}
              strokeDasharray={i < stored ? undefined : "4 4"}
            />
            <text
              {...text}
              x={72 + (i + 0.5) * width}
              y={251}
              fontSize={Math.min(23, 130 / entry.key.length)}
              fill={i < stored ? "#FFFFFF" : "#8295AB"}
            >
              {i < stored ? entry.key : "empty"}
            </text>
          </g>
        ))}
        <text {...text} x={360} y={312} fontSize={20} fill="#A8BCD3">
          {stored} keys + {stored} values · memory grows with n
        </text>
      </g>
    );
  }
  if (v.detail === "message") {
    const messageLines = (v.message ?? "").match(/.{1,20}/gu) ?? [""];
    const multiline = messageLines.length > 1;
    return (
      <g>
        <rect
          x={128}
          y={106}
          width={464}
          height={218}
          rx={20}
          fill="#122133"
          stroke={accent}
          strokeWidth={1.5}
        />
        <text {...text} x={360} y={139} fontSize={15} fill="#A8BCD3">
          RETURNED CONTACT
        </text>
        <text {...text} x={360} y={176} fontSize={28}>
          {v.key}
        </text>
        <text {...text} x={360} y={216} fontSize={34} fill={accent}>
          {v.value}
        </text>
        <g opacity={fade(frame, 12)}>
          <rect
            x={multiline ? 180 : 248}
            y={multiline ? 231 : 237}
            width={multiline ? 360 : 224}
            height={multiline ? 60 : 45}
            rx={13}
            fill={`${accent}25`}
            stroke={accent}
          />
          {messageLines.map((message, i) => (
            <text
              {...text}
              key={i}
              x={360}
              y={multiline ? 255 + i * 24 : 267}
              fontSize={multiline ? 22 : 27}
            >
              {message}
            </text>
          ))}
          <text {...text} x={360} y={308} fontSize={14} fill="#A8BCD3">
            DRAFT · NOT SENT
          </text>
        </g>
      </g>
    );
  }
  return null;
}
