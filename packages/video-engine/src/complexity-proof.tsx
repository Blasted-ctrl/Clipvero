import { Easing, interpolate } from "remotion";
import type { BeatProps } from "./beats";
import { growthValue } from "./cost-panel";
import { complexitySchema, type Visual } from "./model";

type ComplexityVisual = Extract<Visual, { type: "complexity" }>;
const mono = "Consolas, monospace";
const ink = "#E8EFF6";
const muted = "#A5B3C3";
const line = "#304052";
const limit = 32;
const clamp = (value: number, low: number, high: number) =>
  Math.max(low, Math.min(high, value));
const ease = (frame: number, start = 0, length = 18) =>
  interpolate(frame, [start, start + length], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
    easing: Easing.inOut(Easing.cubic),
  });
const number = (value: number) => Math.round(value).toLocaleString("en-US");
const text = {
  fill: ink,
  fontFamily: mono,
  textAnchor: "middle" as const,
};

function OrderCards({
  n,
  f,
  accent,
  detail,
  work,
}: {
  n: number;
  f: number;
  accent: string;
  detail: "orders" | "read" | "pass";
  work: number;
}) {
  const shown = Math.min(limit, n);
  const columns = n <= 8 ? 4 : 8;
  const stride = 584 / columns;
  const cardWidth = stride - 8;
  const rowCount = Math.ceil(shown / columns);
  const yStart =
    n <= 8
      ? 196
      : detail === "orders"
        ? 198 + (4 - rowCount) * 20
        : 196 + (4 - rowCount) * 16;
  const selected = Math.min(3, shown - 1);
  const done = Math.round(Math.min(work, n));
  const fixedFactor = detail === "pass" && work > n;
  const cardTop = (i: number) =>
    yStart +
    Math.floor(i / columns) * (n <= 8 ? 72 : detail === "orders" ? 44 : 62);
  return (
    <>
      <text {...text} x={360} y={157} fontSize={19} fill={muted}>
        {detail === "orders"
          ? "SNACK ORDERS · FIRST INPUT"
          : detail === "read"
            ? `KNOWN INDEX: ${selected}`
            : fixedFactor
              ? "FIXED WORK PER ORDER"
              : "ONE PASS · VISIT EACH ORDER"}
      </text>
      {Array.from({ length: shown }, (_, i) => {
        const isRead = detail === "read" && i === selected;
        const visited = detail === "pass" && i < done;
        const active = isRead || visited;
        const enter = detail === "orders" ? ease(f, i * 2, 12) : 1;
        const x = 72 + (i % columns) * stride;
        return (
          <g
            key={i}
            data-order={i}
            data-visited={visited || undefined}
            opacity={enter}
            transform={`translate(0 ${(1 - enter) * 9})`}
          >
            <rect
              x={x}
              y={cardTop(i)}
              width={cardWidth}
              height={n <= 8 ? 56 : detail === "orders" ? 38 : 45}
              rx={8}
              fill={active ? `${accent}26` : "#15202C"}
              stroke={active ? accent : line}
              strokeWidth={isRead ? 3 : 1.5}
            />
            <text
              {...text}
              x={x + cardWidth / 2}
              y={cardTop(i) + (n <= 8 ? 38 : 29)}
              fontSize={n <= 8 ? 30 : 22}
            >
              {String(i + 1).padStart(2, "0")}
            </text>
          </g>
        );
      })}
      {detail === "orders" ? (
        <>
          <text {...text} x={360} y={389} fontSize={18} fill={muted}>
            HOW DOES WORK GROW?
          </text>
          {[8, 16, 32].map((size, i) => (
            <g key={size} opacity={ease(f, 14 + i * 10)}>
              <rect
                x={112 + i * 170}
                y={407}
                width={145}
                height={82}
                rx={12}
                fill={size === n ? `${accent}17` : "#111C27"}
                stroke={size === n ? accent : line}
              />
              <text
                {...text}
                x={184 + i * 170}
                y={440}
                fontSize={17}
                fill={muted}
              >
                INPUT SIZE
              </text>
              <text {...text} x={184 + i * 170} y={472} fontSize={28}>
                {size}
              </text>
            </g>
          ))}
        </>
      ) : detail === "read" ? (
        <>
          <path
            d={`M${72 + (selected % columns) * stride + cardWidth / 2 - 7} ${cardTop(selected) - 18} l7 11 l7 -11 Z`}
            fill={accent}
          />
          <text {...text} x={360} y={446} fontSize={31} fill={accent}>
            1 indexed access
          </text>
          <text {...text} x={360} y={482} fontSize={18} fill={muted}>
            NO SCAN THROUGH EARLIER ORDERS
          </text>
        </>
      ) : (
        <>
          <rect x={88} y={449} width={544} height={8} rx={4} fill={line} />
          <rect
            x={88}
            y={449}
            width={544 * clamp(work / n, 0, 1)}
            height={8}
            rx={4}
            fill={accent}
          />
          <text {...text} x={360} y={500} fontSize={24} fill={accent}>
            {fixedFactor
              ? Number.isInteger(work / n)
                ? `${number(n)} orders × ${number(work / n)} units = ${number(work)}`
                : `${number(work)} units across ${number(n)} orders`
              : `${number(Math.min(work, n))} of ${number(n)} orders visited`}
          </text>
        </>
      )}
    </>
  );
}

function PairGrid({
  n,
  work,
  accent,
}: {
  n: number;
  work: number;
  accent: string;
}) {
  const shown = Math.min(limit, n);
  const side = 10;
  const x = 80;
  const y = 180;
  const counted = Math.round(work);
  return (
    <>
      <text {...text} x={240} y={151} fontSize={18} fill={muted}>
        EVERY ORDER × EVERY ORDER
      </text>
      {Array.from({ length: limit * limit }, (_, i) => {
        const row = Math.floor(i / limit);
        const column = i % limit;
        const ring = Math.max(row, column);
        // Square rings retain the old n×n block when the next size is revealed.
        const visit = ring * ring + (row === ring ? ring + column : row);
        const exists = row < shown && column < shown;
        const done = exists && visit < counted;
        const fraction = exists ? clamp(work - visit, 0, 1) : 0;
        return (
          <rect
            key={i}
            data-pair={exists ? `${row},${column}` : undefined}
            data-counted={done || undefined}
            x={x + column * side}
            y={y + row * side}
            width={8.3}
            height={8.3}
            rx={1}
            fill={fraction > 0 ? accent : "#283441"}
            opacity={
              fraction > 0 ? 0.32 + 0.68 * fraction : exists ? 0.6 : 0.14
            }
          />
        );
      })}
      <rect
        x={x - 3}
        y={y - 3}
        width={shown * side + 4}
        height={shown * side + 4}
        fill="none"
        stroke={accent}
        strokeWidth={1.5}
      />
      <text {...text} x={540} y={220} fontSize={20} fill={muted}>
        {number(n)} × {number(n)}
      </text>
      <text {...text} x={540} y={270} fontSize={40} fill={accent}>
        {number(work)}
      </text>
      <text {...text} x={540} y={304} fontSize={17} fill={muted}>
        PAIRS COUNTED
      </text>
      <path d="M454 332 H630" stroke={line} />
      <text {...text} x={540} y={368} fontSize={18}>
        16² = 256
      </text>
      <text {...text} x={540} y={407} fontSize={18}>
        32² = 1,024
      </text>
      <text {...text} x={540} y={451} fontSize={22} fill={accent}>
        2× INPUT → 4× PAIRS
      </text>
      <text {...text} x={240} y={526} fontSize={16} fill={muted}>
        FIXED 32 × 32 WINDOW · SELF-PAIRS INCLUDED
      </text>
    </>
  );
}

function SortLevels({
  n,
  work,
  accent,
}: {
  n: number;
  work: number;
  accent: string;
}) {
  const shown = Math.min(limit, n);
  const levels = Math.ceil(Math.log2(shown));
  const width = 544 / shown;
  return (
    <>
      <text {...text} x={360} y={155} fontSize={19} fill={muted}>
        MERGE LEVELS · GROWTH MODEL
      </text>
      {Array.from({ length: levels }, (_, level) => (
        <g key={level}>
          <text
            {...text}
            x={61}
            y={216 + level * 58}
            fontSize={17}
            fill={muted}
          >
            {level + 1}
          </text>
          {Array.from({ length: shown }, (_, i) => {
            const active = level * n + i < work;
            return (
              <rect
                key={i}
                x={88 + i * width + 1}
                y={191 + level * 58}
                width={width - 2}
                height={33}
                rx={3}
                fill={active ? `${accent}55` : "#182432"}
                stroke={active ? accent : line}
              />
            );
          })}
          {Array.from(
            { length: Math.ceil(shown / 2 ** (level + 1)) },
            (_, group) => (
              <path
                key={group}
                d={`M${88 + group * 2 ** (level + 1) * width + 2} ${232 + level * 58} H${88 + Math.min(shown, (group + 1) * 2 ** (level + 1)) * width - 2}`}
                stroke={accent}
                strokeWidth={2}
              />
            ),
          )}
        </g>
      ))}
      <text {...text} x={360} y={513} fontSize={24} fill={accent}>
        {number(n)} × log₂({number(n)}) ≈ {number(growthValue("O(n log n)", n))}{" "}
        units
      </text>
    </>
  );
}

function GrowthGraph({ v, accent }: { v: ComplexityVisual; accent: string }) {
  const n = Math.min(limit, v.n);
  const maxWork = limit * limit;
  const px = (input: number) => 98 + ((input - 1) / (limit - 1)) * 334;
  const py = (work: number) => 432 - (work / maxWork) * 244;
  const value = growthValue(v.focus, n);
  return (
    <>
      <text {...text} x={263} y={156} fontSize={17} fill={muted}>
        COMMON AXES · MODEL WORK
      </text>
      {[0, 256, 512, 1024].map((tick) => (
        <g key={tick}>
          <path d={`M98 ${py(tick)} H432`} stroke={line} strokeWidth={1} />
          <text
            {...text}
            x={85}
            y={py(tick) + 5}
            fontSize={14}
            textAnchor="end"
            fill={muted}
          >
            {number(tick)}
          </text>
        </g>
      ))}
      {complexitySchema.options.map((kind) => (
        <polyline
          key={kind}
          data-growth={kind}
          points={Array.from({ length: 94 }, (_, i) => {
            const input = 1 + (i * (limit - 1)) / 93;
            return `${px(input)},${py(growthValue(kind, input))}`;
          }).join(" ")}
          fill="none"
          stroke={kind === v.focus ? accent : "#586778"}
          opacity={kind === v.focus ? 1 : 0.48}
          strokeWidth={kind === v.focus ? 3.5 : 1.5}
        />
      ))}
      {[1, 8, 16, 24, 32].map((tick) => (
        <text
          {...text}
          key={tick}
          x={px(tick)}
          y={455}
          fontSize={16}
          fill={muted}
        >
          {tick}
        </text>
      ))}
      <path
        d={`M${px(n)} ${py(value)} V432`}
        stroke={accent}
        strokeDasharray="4 5"
      />
      <circle
        data-active-point
        cx={px(n)}
        cy={py(value)}
        r={6}
        fill={accent}
        stroke={ink}
        strokeWidth={1.5}
      />
      <rect
        x={144}
        y={474}
        width={245}
        height={41}
        rx={8}
        fill={`${accent}16`}
        stroke={accent}
      />
      <text {...text} x={266} y={501} fontSize={20} fill={accent}>
        (n={number(n)}, work{Number.isInteger(value) ? "=" : "≈"}
        {Number.isInteger(value) ? number(value) : value.toFixed(1)})
      </text>
      <text {...text} x={548} y={156} fontSize={17} fill={muted}>
        AT n = {number(n)}
      </text>
      {complexitySchema.options.map((kind, i) => {
        const work = growthValue(kind, n);
        const active = kind === v.focus;
        return (
          <g key={kind}>
            <text
              {...text}
              x={475}
              y={207 + i * 60}
              fontSize={16}
              textAnchor="start"
              fill={active ? accent : muted}
            >
              {kind}
            </text>
            <text
              {...text}
              x={636}
              y={207 + i * 60}
              fontSize={17}
              textAnchor="end"
              fill={active ? accent : ink}
            >
              {Number.isInteger(work) ? number(work) : work.toFixed(1)}
            </text>
            <rect
              x={475}
              y={219 + i * 60}
              width={161}
              height={9}
              rx={3}
              fill="#25313E"
            />
            <rect
              x={475}
              y={219 + i * 60}
              width={Math.max(1.5, (work / maxWork) * 161)}
              height={9}
              rx={3}
              fill={active ? accent : "#778697"}
            />
          </g>
        );
      })}
    </>
  );
}

/** Exact repeated ceiling-halves, with a bounded display for large inputs. */
export function halvingSteps(n: number): number[] {
  const result = [n];
  while (result[result.length - 1] > 1)
    result.push(Math.ceil(result[result.length - 1] / 2));
  return result;
}

function HalvingProof({
  n,
  work,
  accent,
}: {
  n: number;
  work: number;
  accent: string;
}) {
  const steps = halvingSteps(n);
  const visible =
    steps.length <= 5
      ? steps.map((value, index) => ({ value, index }))
      : [
          ...steps.slice(0, 4).map((value, index) => ({ value, index })),
          { value: 1, index: steps.length - 1 },
        ];
  const completed = clamp(work, 0, steps.length - 1);
  return (
    <>
      <text {...text} x={360} y={153} fontSize={20} fill={muted}>
        KEEP HALF THE CANDIDATES
      </text>
      {visible.map(({ value, index }, row) => {
        const ready = index === 0 ? 1 : clamp(completed - index + 1, 0, 1);
        const shown = Math.min(32, value);
        const width = 376 / Math.min(32, n);
        const y = 182 + row * 59;
        return (
          <g
            key={index}
            data-halving-count={value}
            data-halving-step={index}
            opacity={0.22 + 0.78 * ready}
          >
            <text {...text} x={75} y={y + 26} fontSize={18} fill={muted}>
              {index}
            </text>
            {Array.from({ length: shown }, (_, i) => (
              <rect
                key={i}
                x={108 + i * width}
                y={y}
                width={Math.max(3, width - 4)}
                height={34}
                rx={4}
                fill={`${accent}35`}
                stroke={accent}
              />
            ))}
            <text
              {...text}
              x={609}
              y={y + 26}
              fontSize={value >= 100000 ? 21 : 28}
              fill={accent}
            >
              {number(value)}
            </text>
            {row > 0 && (
              <text {...text} x={294} y={y - 7} fontSize={16} fill={muted}>
                {index > visible[row - 1].index + 1
                  ? "⋮ repeated halving"
                  : "↓ keep half"}
              </text>
            )}
          </g>
        );
      })}
      <text {...text} x={360} y={510} fontSize={24} fill={accent}>
        {number(completed)} / {steps.length - 1} reductions to one
      </text>
    </>
  );
}

function SearchCases({
  n,
  work,
  accent,
}: {
  n: number;
  work: number;
  accent: string;
}) {
  const shown = Math.min(32, n);
  const visited = Math.round(clamp(work, 0, n));
  return (
    <>
      <text {...text} x={360} y={154} fontSize={20} fill={muted}>
        SAME LINEAR SEARCH · DIFFERENT TARGET
      </text>
      {[false, true].map((worst) => {
        const x = worst ? 382 : 66;
        const target = worst ? n - 1 : 0;
        const checks = worst ? visited : 1;
        return (
          <g key={String(worst)} data-search-case={worst ? "worst" : "best"}>
            <text {...text} x={x + 136} y={197} fontSize={21} fill={accent}>
              {worst ? "TARGET LAST" : "TARGET FIRST"}
            </text>
            {Array.from({ length: shown }, (_, slot) => {
              const index = n > 32 && slot === 31 ? n - 1 : slot;
              const active = index < checks;
              const found = active && index === target;
              return (
                <g
                  key={slot}
                  data-search-index={index}
                  data-checked={active || undefined}
                  data-target={index === target || undefined}
                >
                  <rect
                    x={x + (slot % 8) * 34}
                    y={221 + Math.floor(slot / 8) * 35}
                    width={30}
                    height={28}
                    rx={5}
                    fill={
                      found ? `${accent}60` : active ? `${accent}22` : "#15202C"
                    }
                    stroke={found ? ink : active ? accent : line}
                    strokeWidth={found ? 2 : 1}
                  />
                  <text
                    {...text}
                    x={x + (slot % 8) * 34 + 15}
                    y={240 + Math.floor(slot / 8) * 35}
                    fontSize={index >= 999 ? 10 : 12}
                  >
                    {n > 32 && slot === 31 ? "n" : index + 1}
                  </text>
                </g>
              );
            })}
            <text {...text} x={x + 136} y={399} fontSize={37} fill={accent}>
              {number(checks)}
            </text>
            <text {...text} x={x + 136} y={431} fontSize={19} fill={muted}>
              {worst ? `of ${number(n)} checks · O(n)` : "check · O(1)"}
            </text>
          </g>
        );
      })}
      <path d="M360 181 V446" stroke={line} />
      <text {...text} x={360} y={488} fontSize={21}>
        AVERAGE: WHICH INPUTS, HOW OFTEN?
      </text>
      <text {...text} x={360} y={517} fontSize={17} fill={muted}>
        An input distribution is needed before averaging.
      </text>
    </>
  );
}

function MeasurementProof({ f, accent }: { f: number; accent: string }) {
  const labels = ["SAME INPUT", "RUN FUNCTION", "REPEAT"];
  return (
    <>
      <text {...text} x={360} y={156} fontSize={21} fill={muted}>
        MEASURE THE IMPLEMENTATION
      </text>
      {labels.map((label, index) => (
        <g key={label} opacity={0.35 + 0.65 * ease(f, index * 12, 18)}>
          <rect
            x={60 + index * 210}
            y={202}
            width={180}
            height={106}
            rx={12}
            fill={`${accent}14`}
            stroke={accent}
          />
          <text
            {...text}
            x={150 + index * 210}
            y={240}
            fontSize={18}
            fill={muted}
          >
            {String(index + 1).padStart(2, "0")}
          </text>
          <text {...text} x={150 + index * 210} y={278} fontSize={19}>
            {label}
          </text>
          {index < 2 && (
            <path
              d={`M${246 + index * 210} 254 H${264 + index * 210} m-6 -5 l6 5 l-6 5`}
              fill="none"
              stroke={accent}
              strokeWidth={2}
            />
          )}
        </g>
      ))}
      <text {...text} x={360} y={365} fontSize={28} fill={accent}>
        elapsed = end − start
      </text>
      <text {...text} x={360} y={405} fontSize={19} fill={muted}>
        Record samples, then compare the same workload.
      </text>
      <path d="M86 433 H634" stroke={line} />
      <text {...text} x={360} y={470} fontSize={18}>
        CPU · INPUT SHAPE · RUNTIME · IMPLEMENTATION
      </text>
      <text {...text} x={360} y={507} fontSize={18} fill={muted}>
        A growth model does not supply measured timings.
      </text>
    </>
  );
}

export function ComplexityProof({
  v,
  f,
  accent,
  count,
  countProgress,
}: BeatProps & { v: ComplexityVisual }) {
  const work = Math.max(0, countProgress ?? count ?? growthValue(v.focus, v.n));
  const detail = v.detail;
  return (
    <svg
      width={720}
      height={600}
      viewBox="0 0 720 600"
      data-complexity-detail={detail}
    >
      <text {...text} x={360} y={49} fontSize={29} fontWeight={700}>
        {v.label}
      </text>
      <text {...text} x={360} y={87} fontSize={18} fill={accent}>
        {v.focus} · n = {number(v.n)}
      </text>
      <rect
        x={32}
        y={112}
        width={656}
        height={426}
        rx={18}
        fill="#0D151F"
        stroke={line}
        strokeWidth={1.5}
      />
      {detail === "orders" || detail === "read" || detail === "pass" ? (
        <OrderCards n={v.n} f={f} accent={accent} detail={detail} work={work} />
      ) : detail === "pairs" ? (
        <PairGrid n={v.n} work={work} accent={accent} />
      ) : detail === "sort" ? (
        <SortLevels n={v.n} work={work} accent={accent} />
      ) : detail === "halving" ? (
        <HalvingProof n={v.n} work={work} accent={accent} />
      ) : detail === "cases" ? (
        <SearchCases n={v.n} work={work} accent={accent} />
      ) : detail === "measure" ? (
        <MeasurementProof f={f} accent={accent} />
      ) : (
        <GrowthGraph v={v} accent={accent} />
      )}
      <text {...text} x={360} y={574} fontSize={17} fill={muted}>
        {detail === "measure"
          ? "TIMING HARNESS · NO MEASURED TIMINGS SHOWN"
          : detail === "halving"
            ? "REDUCTIONS TO ONE · NOT BINARY-SEARCH COMPARISONS"
            : detail === "cases" && v.n > limit
              ? "31 EARLY POSITIONS + FINAL POSITION SHOWN"
              : detail === "cases"
                ? "ONE ALGORITHM · BEST AND WORST SUCCESSFUL SEARCH"
                : v.n > limit
                  ? `ILLUSTRATIVE WINDOW: FIRST ${limit} OF ${number(v.n)} INPUTS`
                  : detail === "sort"
                    ? "MODEL UNITS · NOT AN EXACT COMPARISON COUNT"
                    : detail === "pairs"
                      ? "ONE CELL = ONE ORDERED PAIR"
                      : detail === "growth"
                        ? "FIXED DOMAIN: 1–32 INPUTS · 0–1,024 WORK UNITS"
                        : "SAME ORDERS · DIFFERENT AMOUNTS OF WORK"}
      </text>
    </svg>
  );
}
