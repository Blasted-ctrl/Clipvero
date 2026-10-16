import { Easing, interpolate } from "remotion";
import type { BeatProps } from "./beats";
import { HashDetail } from "./hash-details";
import { routePath, routeTrail } from "./route-trail";
import type { Visual } from "./model";

type MapVisual = Extract<Visual, { type: "hashmap" }>;
const mono = "Consolas, monospace";
const smooth = (f: number, a: number, b: number) =>
  interpolate(f, [a, b], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
    easing: Easing.inOut(Easing.cubic),
  });
function keysIn(v: MapVisual, bucket: number) {
  const keys = [
    ...new Set([
      ...v.entries.filter((e) => e.bucket === bucket).map((e) => e.key),
      ...(v.bucket === bucket ? [v.key] : []),
    ]),
  ];
  return v.bucket === bucket && v.chainOrder.length
    ? [...v.chainOrder, ...keys.filter((key) => !v.chainOrder.includes(key))]
    : keys;
}

export function HashmapDiagram({
  v,
  f,
  d,
  accent,
  previous,
  continuing,
  count,
  inputSize,
}: BeatProps & { v: MapVisual }) {
  const old = previous?.type === "hashmap" ? previous : v;
  const move =
    v.action === "hold" ? 1 : smooth(f, 4, Math.min(36, Math.max(8, d * 0.35)));
  const targetX = 95 + v.bucket * 106;
  const queryPoint = () => {
    if (move < 0.15) return [210, 181 + 15 * (move / 0.15)];
    if (move < 0.4) {
      const part = (move - 0.15) / 0.25;
      return [210 + 150 * part * part, 196 + 16 * part - 8 * part * part];
    }
    if (move < 0.55) return [360, 204 + 66 * ((move - 0.4) / 0.15)];
    if (move < 0.9) {
      const part = (move - 0.55) / 0.35;
      return [
        360 + (targetX - 360) * part * part,
        270 + 64 * part - 19 * part * part,
      ];
    }
    return [targetX, 315 + 27 * ((move - 0.9) / 0.1)];
  };
  const [queryX, queryY] = queryPoint();
  const activeKeys = keysIn(v, v.bucket);
  const targetIndex = activeKeys.indexOf(v.key);
  const checks =
    count ??
    (v.action === "lookup"
      ? Math.max(0, Math.min(targetIndex + 1, Math.floor((f - 36) / 14) + 1))
      : targetIndex + 1);
  const match =
    v.detail === "update" || v.action !== "lookup" || checks > targetIndex;
  const displayedValue = v.detail === "update" && f < 24 ? old.value : v.value;
  const buildEntries = [
    ...new Map(
      [...v.entries, { key: v.key, bucket: v.bucket }].map((entry) => [
        entry.key,
        entry,
      ]),
    ).values(),
  ];
  const stored = Math.max(
    0,
    Math.min(
      buildEntries.length,
      count ?? Math.floor(smooth(f, 0, 60) * buildEntries.length),
    ),
  );
  const detailPanel = ["long-keys", "build", "message"].includes(v.detail);
  const normalOpacity = detailPanel
    ? 0
    : v.detail === "probing"
      ? 1 - smooth(f, 0, 24)
      : 1;
  const descriptions: Record<MapVisual["detail"], string> = {
    route: "KEY → HASH → BUCKET",
    chain: "CHAIN · COMPARE FULL KEYS",
    probing: "CHAINING AND OPEN ADDRESSING ARE DIFFERENT DESIGNS",
    scale: `${(inputSize ?? 5).toLocaleString("en-US")} KEYS · SMALL TABLE SHOWN`,
    "long-keys": "HASHING READS THE KEY, TOO",
    "worst-case": "FIVE KEYS SHOWN · ONE COLLISION CHAIN",
    build: "AVERAGE INSERTION WORK · LINEAR STORAGE",
    update: "SAME KEY · REPLACE ITS VALUE",
    message: "RETURNED CONTACT · UNSENT MESSAGE",
  };
  const heading =
    v.detail === "build"
      ? "BUILD THE CONTACT TABLE"
      : v.detail === "long-keys"
        ? "LONGER KEY, MORE TO READ"
        : v.detail === "probing"
          ? "TWO COLLISION DESIGNS"
          : v.detail === "message"
            ? "NUMBER ACQUIRED"
            : `${v.action === "insert" ? "SAVE" : v.detail === "update" ? "UPDATE" : "FIND"} ${v.key.toUpperCase()}`;
  return (
    <svg width={720} height={600} style={{ fontFamily: mono }}>
      <text
        x={360}
        y={40}
        textAnchor="middle"
        fill="#E8EFF7"
        fontSize={27}
        fontWeight={700}
      >
        {heading}
      </text>
      <text x={360} y={77} textAnchor="middle" fill="#A8BCD3" fontSize={17}>
        {descriptions[v.detail]}
      </text>
      <g opacity={normalOpacity}>
        <path
          d={routePath(targetX)}
          fill="none"
          stroke="#35485E"
          strokeWidth={3}
        />
        {move > 0 && (
          <path
            d={routePath(targetX)}
            fill="none"
            stroke={accent}
            strokeWidth={4}
            strokeLinecap="round"
            strokeLinejoin="round"
            opacity={0.85}
            style={{ filter: `drop-shadow(0 0 6px ${accent})` }}
            {...routeTrail(move, targetX)}
          />
        )}
        <rect
          x={70}
          y={110}
          width={580}
          height={71}
          rx={12}
          fill="#142234"
          stroke="#485F79"
        />
        <path d="M350 122 V169" stroke="#405670" />
        <text x={210} y={131} textAnchor="middle" fill="#90A8C4" fontSize={14}>
          KEY
        </text>
        <text x={210} y={163} textAnchor="middle" fill="#EEF3F9" fontSize={29}>
          {v.key}
        </text>
        <text x={500} y={131} textAnchor="middle" fill="#90A8C4" fontSize={14}>
          {v.detail === "update" && f >= 24
            ? "UPDATED VALUE"
            : v.action === "lookup"
              ? "RETURNED VALUE"
              : "VALUE"}
        </text>
        <text
          x={500}
          y={163}
          textAnchor="middle"
          fill={accent}
          fontSize={Math.min(
            28,
            290 / Math.max(1, (displayedValue ?? "").length),
          )}
        >
          {match ? displayedValue : "checking…"}
        </text>
        <rect
          x={250}
          y={211}
          width={220}
          height={58}
          rx={10}
          fill="#0D1825"
          stroke={accent}
          strokeWidth={2}
        />
        <text x={360} y={248} textAnchor="middle" fill="#EDF3F9" fontSize={27}>
          hash() → {v.bucket}
        </text>
        {v.action !== "hold" && move < 1 && (
          <circle cx={queryX} cy={queryY} r={8} fill={accent} />
        )}
        {v.action === "lookup" && move === 1 && checks === 0 && (
          <circle cx={targetX} cy={342} r={7} fill={accent} />
        )}
      </g>
      <HashDetail
        v={v}
        frame={f}
        accent={accent}
        stored={stored}
        entries={buildEntries}
        count={count}
      />
      {Array.from({ length: 6 }, (_, bucket) => {
        const x = 48 + bucket * 106;
        const keys = keysIn(v, bucket);
        const before = keysIn(old, bucket);
        const active = bucket === v.bucket;
        const rowHeight = Math.min(32, 160 / Math.max(1, keys.length));
        return (
          <g
            key={bucket}
            opacity={
              continuing
                ? 1
                : 0.45 + 0.55 * smooth(f, bucket * 2, bucket * 2 + 12)
            }
          >
            <rect
              x={x}
              y={352}
              width={94}
              height={201}
              rx={11}
              fill={active ? `${accent}0B` : "#0F1925"}
              stroke={active ? accent : "#364A62"}
              strokeWidth={active ? 2 : 1}
            />
            {keys.map((key, i) => {
              const oldIndex = before.indexOf(key);
              const y =
                365 +
                (oldIndex >= 0
                  ? oldIndex + (i - oldIndex) * smooth(f, 0, 18)
                  : i) *
                  rowHeight;
              const selected =
                v.detail === "build"
                  ? buildEntries[stored - 1]?.key === key
                  : active &&
                    (v.action === "lookup"
                      ? i === Math.max(0, checks - 1) && checks > 0
                      : key === v.key);
              const inserted =
                v.detail !== "build" ||
                buildEntries.findIndex((entry) => entry.key === key) < stored;
              const visible =
                oldIndex < 0 && v.action === "insert" ? smooth(f, 28, 40) : 1;
              return (
                <g key={key} opacity={visible}>
                  <rect
                    x={x + 5}
                    y={y}
                    width={84}
                    height={rowHeight - 3}
                    rx={5}
                    fill={
                      !inserted
                        ? "transparent"
                        : selected
                          ? `${accent}36`
                          : "#25374B"
                    }
                    stroke={
                      selected ? accent : !inserted ? "#3C4E64" : "transparent"
                    }
                    strokeDasharray={inserted ? undefined : "3 4"}
                  />
                  {inserted && (
                    <text
                      x={x + 47}
                      y={y + rowHeight * 0.68}
                      textAnchor="middle"
                      fontSize={Math.min(
                        20,
                        rowHeight * 0.65,
                        120 / key.length,
                      )}
                      fill={selected ? "#FFFFFF" : "#B9C9DA"}
                    >
                      {key}
                    </text>
                  )}
                </g>
              );
            })}
            {active && match && !detailPanel && v.detail !== "probing" && (
              <text
                x={x + 47}
                y={538}
                textAnchor="middle"
                fontSize={15}
                fill={accent}
              >
                {v.action === "insert"
                  ? "STORED"
                  : v.detail === "update"
                    ? f >= 24
                      ? "UPDATED"
                      : "READY"
                    : "MATCH"}
              </text>
            )}
            <text
              x={x + 47}
              y={579}
              textAnchor="middle"
              fill={active ? accent : "#90A4BD"}
              fontSize={18}
            >
              {bucket}
            </text>
          </g>
        );
      })}
    </svg>
  );
}
