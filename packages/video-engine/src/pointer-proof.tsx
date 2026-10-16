import { Easing, interpolate } from "remotion";
import type { BeatProps } from "./beats";
import type { Visual } from "./model";

type Pointers = Extract<Visual, { type: "pointers" }>;
const ink = "#E8EFF6";
const muted = "#9BAFC4";
const panel = "#111B28";
const mono = "Consolas, 'Cascadia Code', monospace";
const center = { textAnchor: "middle" as const, fill: ink };
const ease = (frame: number) =>
  interpolate(frame, [0, 18], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
    easing: Easing.inOut(Easing.cubic),
  });

/** A bounded, deterministic trace for the validated sorted numeric example. */
export function pointerTrace(items: string[], target: number) {
  const result: { left: number; right: number; sum: number }[] = [];
  let left = 0;
  let right = items.length - 1;
  while (left < right) {
    const sum = Number(items[left]) + Number(items[right]);
    result.push({ left, right, sum });
    if (sum === target) break;
    if (sum < target) left++;
    else right--;
  }
  return result;
}

/** Persistent menu with one small proof per teaching beat. Motion uses caption-relative f. */
export function PointersVisual({
  v,
  previous,
  f,
  accent,
  count,
  inputSize,
}: BeatProps & { v: Pointers }) {
  const compatible =
    previous?.type === "pointers" &&
    previous.target === v.target &&
    previous.items.join("|") === v.items.join("|");
  const before = compatible ? previous : v;
  const p = ease(f);
  const shifted = before.left !== v.left || before.right !== v.right;
  const shown = shifted && p < 1 ? before : v;
  const cell = 630 / v.items.length;
  const x = (i: number) => 45 + cell * (i + 0.5);
  const leftX = x(before.left) + (x(v.left) - x(before.left)) * p;
  const rightX = x(before.right) + (x(v.right) - x(before.right)) * p;
  const detail =
    v.detail === "elimination" && !shifted && v.sum === v.target
      ? "pair"
      : (v.detail ?? "pair");
  const setup = detail === "setup";
  const combinations = detail === "combinations";
  const absent = v.status === "absent";
  const introductory = setup || combinations;
  const trace = pointerTrace(v.items, v.target);
  const shownIndex = trace.findIndex(
    (step) => step.left === shown.left && step.right === shown.right,
  );
  const checked = count === undefined || count > shownIndex;
  const found = shown.status === "found" && checked && detail === "pair";
  const input = Math.max(2, Math.round(inputSize ?? v.items.length));
  const number = (value: number) => value.toLocaleString("en-US");
  const title = (value: string) => (
    <text {...center} x={360} y={421} fontSize={20} fill={muted}>
      {value}
    </text>
  );
  let proof;

  if (setup) {
    proof = (
      <>
        {title("CHOOSE TWO DIFFERENT ITEMS")}
        <text {...center} x={360} y={494} fontSize={48} fill={accent}>
          ? + ? = {v.target}
        </text>
        <text {...center} x={360} y={549} fontSize={23}>
          One exact total. Which two positions?
        </text>
      </>
    );
  } else if (combinations) {
    const pairs = v.items.flatMap((a, left) =>
      v.items
        .slice(left + 1)
        .map((b, offset) => ({ a, b, left, right: left + offset + 1 })),
    );
    proof = (
      <>
        {title(`${pairs.length} DISTINCT PAIRS / NO REUSED POSITION`)}
        {pairs.slice(0, 15).map((pair, index) => {
          const cx = 45 + ((index % 5) + 0.5) * 126;
          const y = 438 + Math.floor(index / 5) * 42;
          return (
            <g
              key={`${pair.left}-${pair.right}`}
              data-choice={`${pair.left},${pair.right}`}
              opacity={0.18 + 0.82 * ease(f - index * 3)}
            >
              <rect
                x={cx - 59}
                y={y}
                width={118}
                height={35}
                rx={6}
                fill={panel}
                stroke="#3B4E62"
              />
              <text {...center} x={cx} y={y + 25} fontSize={22}>
                {pair.a} + {pair.b}
              </text>
            </g>
          );
        })}
        {pairs.length > 15 && (
          <text {...center} x={360} y={588} fontSize={18} fill={muted}>
            15 of {pairs.length} choices shown
          </text>
        )}
      </>
    );
  } else if (absent) {
    const columns = Math.min(4, trace.length);
    const width = 630 / columns;
    proof = (
      <>
        {title(`${trace.length} FAILED CHECKS / RETURN NONE`)}
        {trace.map((step, index) => {
          const cx = 45 + ((index % columns) + 0.5) * width;
          const y = 440 + Math.floor(index / columns) * 64;
          return (
            <g
              key={`${step.left}-${step.right}`}
              data-failed-pair={`${step.left},${step.right}`}
            >
              <rect
                x={cx - width / 2 + 3}
                y={y}
                width={width - 6}
                height={55}
                rx={7}
                fill={panel}
                stroke="#3B4E62"
              />
              <text {...center} x={cx} y={y + 21} fontSize={16} fill={muted}>
                {v.items[step.left]} + {v.items[step.right]}
              </text>
              <text {...center} x={cx} y={y + 44} fontSize={24} fill={accent}>
                {step.sum} {step.sum > v.target ? ">" : "<"} {v.target}
              </text>
            </g>
          );
        })}
      </>
    );
  } else if (detail === "elimination") {
    const rejected = shifted ? before : v;
    const discardRight = rejected.sum > v.target;
    const fixed = discardRight ? rejected.right : rejected.left;
    const partners = discardRight
      ? Array.from(
          { length: Math.min(3, rejected.right - rejected.left) },
          (_, i) => rejected.left + i,
        )
      : Array.from(
          { length: Math.min(3, rejected.right - rejected.left) },
          (_, i) => rejected.right - i,
        ).reverse();
    proof = (
      <>
        {title(
          discardRight
            ? "EVEN THE CHEAPEST PARTNER IS TOO MUCH"
            : "SMALLER PARTNERS CANNOT REACH THE TARGET",
        )}
        {partners.map((partner, i) => {
          const a = discardRight ? partner : fixed;
          const b = discardRight ? fixed : partner;
          const sum = Number(v.items[a]) + Number(v.items[b]);
          const cx = 360 + (i - (partners.length - 1) / 2) * 210;
          return (
            <g key={partner}>
              <rect
                x={cx - 96}
                y={444}
                width={192}
                height={61}
                rx={9}
                fill={panel}
                stroke="#3B4E62"
              />
              <text {...center} x={cx} y={481} fontSize={23}>
                {v.items[a]} + {v.items[b]} = {sum}
              </text>
            </g>
          );
        })}
        <text {...center} x={360} y={548} fontSize={23} fill={accent}>
          {discardRight ? "Every sum > " : "Every sum < "}
          {v.target} / discard {v.items[fixed]}
        </text>
      </>
    );
  } else if (detail === "movement") {
    const leftMoves = v.left;
    const rightMoves = v.items.length - 1 - v.right;
    proof = (
      <>
        {title("ONE FAILED CHECK / ONE INWARD MOVE")}
        <text {...center} x={202} y={470} fontSize={25} fill={accent}>
          LEFT: 0 → {v.left}
        </text>
        <text {...center} x={514} y={470} fontSize={25} fill={accent}>
          RIGHT: {v.items.length - 1} → {v.right}
        </text>
        <text {...center} x={360} y={515} fontSize={23}>
          {leftMoves + rightMoves} moves in the shown example / no backtracking
        </text>
        <text {...center} x={360} y={555} fontSize={20} fill={muted}>
          {input === v.items.length
            ? `At most ${input - 1} checks / two indices / constant extra space`
            : `n = ${number(input)} model: at most ${number(input - 1)} checks / two indices`}
        </text>
      </>
    );
  } else if (detail === "scale") {
    proof = (
      <>
        {title(`${number(input)} SORTED PRICES / WORST-CASE BOUNDS`)}
        {[
          {
            x: 45,
            label: "POINTER CHECKS",
            formula: "n − 1",
            value: input - 1,
          },
          {
            x: 375,
            label: "ALL UNIQUE PAIRS",
            formula: "n(n − 1) / 2",
            value: (input * (input - 1)) / 2,
          },
        ].map((card) => (
          <g key={card.label}>
            <rect
              x={card.x}
              y={437}
              width={300}
              height={130}
              rx={11}
              fill={panel}
              stroke={card.x === 45 ? accent : "#3B4E62"}
            />
            <text
              {...center}
              x={card.x + 150}
              y={466}
              fontSize={18}
              fill={muted}
            >
              {card.label}
            </text>
            <text
              {...center}
              x={card.x + 150}
              y={508}
              fontSize={number(card.value).length > 11 ? 28 : 33}
              fill={accent}
            >
              {number(card.value)}
            </text>
            <text
              {...center}
              x={card.x + 150}
              y={545}
              fontSize={22}
              fill={muted}
            >
              {card.formula}
            </text>
          </g>
        ))}
      </>
    );
  } else if (detail === "sorting") {
    const shuffled = [v.items.at(-1)!, ...v.items.slice(0, -1)];
    const smallCell = 460 / v.items.length;
    proof = (
      <>
        {title("SORT FIRST / THEN POINTER DIRECTIONS ARE SAFE")}
        {[
          { label: "INPUT", y: 443, items: shuffled },
          { label: "SORTED", y: 498, items: v.items },
        ].map((line) => (
          <g key={line.label}>
            <text x={45} y={line.y + 25} fontSize={19} fill={muted}>
              {line.label}
            </text>
            {line.items.map((value, i) => (
              <g key={i}>
                <rect
                  x={190 + i * smallCell}
                  y={line.y}
                  width={smallCell - 7}
                  height={37}
                  rx={5}
                  fill={panel}
                  stroke={line.label === "SORTED" ? accent : "#3B4E62"}
                />
                <text
                  {...center}
                  x={190 + (i + 0.5) * smallCell - 3.5}
                  y={line.y + 25}
                  fontSize={20}
                >
                  {value}
                </text>
              </g>
            ))}
          </g>
        ))}
        <text {...center} x={360} y={567} fontSize={18} fill={muted}>
          Efficient comparison sort: O(n log n) + O(n) scan
        </text>
      </>
    );
  } else if (count === 0) {
    const pairs = (v.items.length * (v.items.length - 1)) / 2;
    proof = (
      <>
        {title("TWO DIFFERENT ITEMS / ONE EXACT TOTAL")}
        <text {...center} x={360} y={478} fontSize={32} fill={accent}>
          {v.items.length} prices / {pairs} unique pairs
        </text>
        <text {...center} x={360} y={533} fontSize={23}>
          Start at the two ends of the sorted menu
        </text>
      </>
    );
  } else {
    const complete = Math.min(trace.length, count ?? shownIndex + 1);
    const columns = Math.min(4, trace.length);
    const width = 630 / columns;
    proof = (
      <>
        {title(
          found ? "MATCH FOUND / COMPLETED CHECKS" : "COMPLETED PAIR CHECKS",
        )}
        {trace.map((step, i) => {
          const cx = 45 + ((i % columns) + 0.5) * width;
          const cy = 440 + Math.floor(i / columns) * 66;
          return (
            <g
              key={`${step.left}-${step.right}`}
              opacity={i < complete ? 1 : 0.18}
            >
              <rect
                x={cx - width / 2 + 3}
                y={cy}
                width={width - 6}
                height={54}
                rx={7}
                fill={panel}
                stroke={
                  step.sum === v.target && i < complete ? accent : "#3B4E62"
                }
              />
              <text {...center} x={cx} y={cy + 20} fontSize={15} fill={muted}>
                CHECK {i + 1}
              </text>
              <text {...center} x={cx} y={cy + 42} fontSize={19}>
                {i < complete
                  ? `${v.items[step.left]} + ${v.items[step.right]} = ${step.sum}`
                  : "pending"}
              </text>
            </g>
          );
        })}
        {trace.length <= 4 && (
          <text {...center} x={360} y={548} fontSize={23} fill={accent}>
            {found
              ? `Return indices ${v.left} and ${v.right} / total ${v.target}`
              : `Completed: ${complete} / move only when safe`}
          </text>
        )}
      </>
    );
  }

  return (
    <svg
      width={720}
      height={600}
      viewBox="0 0 720 600"
      style={{ fontFamily: mono }}
    >
      <text {...center} x={360} y={55} fontSize={28} fontWeight={700}>
        {v.label}
      </text>
      <text {...center} x={360} y={103} fontSize={20} fill={muted}>
        {absent
          ? "EXHAUSTED SEARCH / NO DISTINCT PAIR LEFT"
          : introductory
            ? "TWO DISTINCT ITEMS / ONE EXACT TARGET"
            : detail === "pair" || detail === "elimination"
              ? "TWO DISTINCT ITEMS / SORTED BY PRICE"
              : `SHOWN EXAMPLE / ${v.items.length} SORTED PRICES`}
      </text>
      {v.items.map((value, i) => {
        const selected =
          !introductory && !absent && (i === shown.left || i === shown.right);
        const excluded =
          absent || (!introductory && (i < shown.left || i > shown.right));
        const entrance = setup ? 0.18 + 0.82 * ease(f - i * 3) : 1;
        return (
          <g
            key={i}
            opacity={(excluded ? 0.42 : 1) * entrance}
            transform={setup ? `translate(0 ${(1 - entrance) * 9})` : undefined}
          >
            <rect
              x={x(i) - cell / 2 + 4}
              y={173}
              width={cell - 8}
              height={77}
              rx={10}
              fill={selected ? `${accent}20` : panel}
              stroke={selected ? accent : "#3A4B60"}
              strokeWidth={2}
            />
            <text {...center} x={x(i)} y={222} fontSize={32}>
              {value}
            </text>
            <text {...center} x={x(i)} y={275} fontSize={17} fill={muted}>
              {i}
            </text>
          </g>
        );
      })}
      {!introductory &&
        (absent
          ? [{ x: leftX, label: "L = R" }]
          : [
              { x: leftX, label: "LEFT" },
              { x: rightX, label: "RIGHT" },
            ]
        ).map((marker) => (
          <g key={marker.label}>
            <text {...center} x={marker.x} y={140} fontSize={19} fill={accent}>
              {marker.label}
            </text>
            <path
              d={`M${marker.x - 8} 150 L${marker.x} 164 L${marker.x + 8} 150 Z`}
              fill={accent}
            />
          </g>
        ))}
      {setup ? (
        <>
          <text {...center} x={360} y={315} fontSize={20} fill={muted}>
            TARGET TOTAL
          </text>
          <text {...center} x={360} y={380} fontSize={70} fill={accent}>
            {v.target}
          </text>
        </>
      ) : combinations ? (
        <>
          <text {...center} x={360} y={322} fontSize={21} fill={muted}>
            COUNT EACH PAIR ONCE
          </text>
          <text {...center} x={360} y={367} fontSize={35} fill={accent}>
            {v.items.length} × {v.items.length - 1} ÷ 2 ={" "}
            {(v.items.length * (v.items.length - 1)) / 2}
          </text>
        </>
      ) : (
        <>
          <rect
            x={138}
            y={299}
            width={444}
            height={75}
            rx={12}
            fill={panel}
            stroke={found ? accent : "#34465A"}
          />
          <text {...center} x={360} y={329} fontSize={16} fill={muted}>
            {absent
              ? "NO DISTINCT PAIR LEFT"
              : detail !== "pair"
                ? "WORKED PAIR"
                : found
                  ? "EXACT MATCH"
                  : checked
                    ? "CHECKED PAIR"
                    : "CURRENT CANDIDATE"}
          </text>
          <text
            {...center}
            x={360}
            y={361}
            fontSize={found ? 39 : 30}
            fill={accent}
            data-pair-equation={!absent || undefined}
          >
            {absent
              ? `L = R = ${v.left}`
              : `${shown.items[shown.left]} + ${shown.items[shown.right]} = ${shown.sum}`}
          </text>
        </>
      )}
      <path d="M45 393 H675" stroke="#293C51" />
      {proof}
    </svg>
  );
}
