import { Easing, interpolate } from "remotion";
import type { Visual } from "./model";

const mono = "Consolas, 'Cascadia Code', monospace";
const ink = "#E7EEF6";
const muted = "#9BAEC2";
const panel = "#101A26";
const progress = (frame: number, from = 0, to = 24) =>
  interpolate(frame, [from, to], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
    easing: Easing.inOut(Easing.cubic),
  });

/** Numeric comparisons for a bounded, sorted example; never a generated program. */
export function binaryTrace(items: string[], target: number) {
  const values = items.map(Number);
  if (
    !Number.isFinite(target) ||
    items.some((item) => !item.trim()) ||
    values.some(
      (value, i) => !Number.isFinite(value) || (i > 0 && value < values[i - 1]),
    )
  )
    return [];
  const trace: {
    value: number;
    mid: number;
    lo: number;
    hi: number;
    relation: string;
  }[] = [];
  let lo = 0,
    hi = values.length - 1;
  while (lo <= hi) {
    const mid = Math.floor((lo + hi) / 2),
      value = values[mid];
    trace.push({
      value,
      mid,
      lo,
      hi,
      relation: value === target ? "=" : value < target ? "<" : ">",
    });
    if (value === target) break;
    if (value < target) lo = mid + 1;
    else hi = mid - 1;
  }
  return trace;
}

/** Small proofs beneath the persistent array. No independent animation clock. */
export function ArrayDetails({
  visual,
  frame,
  accent,
  inputSize = 1000000,
  count,
  countProgress,
}: {
  visual: Extract<Visual, { type: "array" }>;
  frame: number;
  accent: string;
  inputSize?: number;
  count?: number;
  countProgress?: number;
}) {
  const detail = visual.detail ?? "search";
  if (detail === "search") return null;
  const n = visual.items.length;
  const modelN = Math.max(1, Math.round(inputSize));
  const checks = Math.floor(Math.log2(modelN)) + 1;
  const integer = (value: number) => value.toLocaleString("en-US");
  const title = (label: string) => (
    <text x={360} y={28} textAnchor="middle" fontSize={20} fill={muted}>
      {label}
    </text>
  );
  const footer = (label: string) => (
    <text x={360} y={225} textAnchor="middle" fontSize={18} fill={muted}>
      {label}
    </text>
  );
  let proof;
  if (detail === "halving") {
    let lo = 0,
      hi = n - 1;
    const target = visual.target ?? n - 1;
    for (let i = 0; i < (visual.step ?? 0) && lo <= hi; i++) {
      const mid = Math.floor((lo + hi) / 2);
      if (mid === target) break;
      if (mid < target) lo = mid + 1;
      else hi = mid - 1;
    }
    const remaining = Math.max(0, hi - lo + 1);
    const cell = 560 / n;
    proof = (
      <>
        {title("ONLY THE REMAINING RANGE CAN MATCH")}
        <text x={194} y={87} textAnchor="middle" fontSize={42} fill={accent}>
          {remaining}
        </text>
        <text x={194} y={117} textAnchor="middle" fontSize={19} fill={ink}>
          candidates remain
        </text>
        <text x={526} y={87} textAnchor="middle" fontSize={42} fill={muted}>
          {n - remaining}
        </text>
        <text x={526} y={117} textAnchor="middle" fontSize={19} fill={muted}>
          ruled out
        </text>
        {visual.items.map((_, i) => (
          <rect
            key={i}
            x={80 + i * cell}
            y={150}
            width={cell - 5}
            height={32}
            rx={5}
            fill={i >= lo && i <= hi ? accent : "#283747"}
            opacity={i >= lo && i <= hi ? 1 : 0.5}
          />
        ))}
        {footer(`inclusive range [${lo}, ${hi}] / ${n} original entries`)}
      </>
    );
  } else if (detail === "scale") {
    proof = (
      <>
        {title(`${integer(modelN)} ENTRIES / WORST-CASE BOUNDS`)}
        {[
          { x: 45, label: "BINARY SEARCH", count: checks, active: true },
          { x: 375, label: "LINEAR SEARCH", count: modelN, active: false },
        ].map((item) => (
          <g key={item.label}>
            <rect
              x={item.x}
              y={52}
              width={300}
              height={131}
              rx={12}
              fill={panel}
              stroke={item.active ? accent : "#33475B"}
            />
            <text
              x={item.x + 150}
              y={83}
              textAnchor="middle"
              fontSize={18}
              fill={muted}
            >
              {item.label}
            </text>
            <text
              x={item.x + 150}
              y={134}
              textAnchor="middle"
              fontSize={item.count > 99999 ? 35 : 43}
              fill={item.active ? accent : ink}
            >
              {integer(item.count)}
            </text>
            <text
              x={item.x + 150}
              y={163}
              textAnchor="middle"
              fontSize={17}
              fill={muted}
            >
              worst-case bound
            </text>
          </g>
        ))}
        {footer("Fixed bounds above / live model counter below")}
      </>
    );
  } else if (detail === "doubling") {
    const extra = progress(frame, 8, 30);
    proof = (
      <>
        {title("TWICE THE SORTED DATA / ONE EXTRA CHECK")}
        <rect
          x={55}
          y={58}
          width={245}
          height={125}
          rx={12}
          fill={panel}
          stroke="#33475B"
        />
        <rect
          x={420}
          y={58}
          width={245}
          height={125}
          rx={12}
          fill={panel}
          stroke={accent}
        />
        <text x={177} y={94} textAnchor="middle" fontSize={25} fill={ink}>
          {integer(modelN)}
        </text>
        <text x={177} y={143} textAnchor="middle" fontSize={31} fill={accent}>
          {checks} checks
        </text>
        <text x={543} y={94} textAnchor="middle" fontSize={25} fill={ink}>
          {integer(modelN * 2)}
        </text>
        <text x={543} y={143} textAnchor="middle" fontSize={31} fill={accent}>
          {checks + 1} checks
        </text>
        <path
          d="M320 118 H397 M387 108 L399 118 L387 128"
          fill="none"
          stroke={accent}
          strokeWidth={3}
        />
        <text
          x={360}
          y={86}
          textAnchor="middle"
          fontSize={22}
          fill={accent}
          opacity={extra}
        >
          ×2
        </text>
        {footer("Worst-case binary-search iterations, not elapsed time")}
      </>
    );
  } else if (detail === "sorted") {
    const values = visual.items.slice(0, 5);
    const scrambled = [values.at(-1)!, ...values.slice(0, -1)];
    const cell = 350 / values.length;
    const preparing = visual.costRow !== undefined;
    const moves = Math.max(
      0,
      Math.min(values.length - 1, count ?? values.length - 1),
    );
    const movement = Math.max(
      0,
      Math.min(values.length - 1, countProgress ?? moves),
    );
    proof = (
      <>
        {title(
          preparing
            ? "SORT FIRST / FOUR ADJACENT SWAPS"
            : "SORTED INPUT MAKES THE DIRECTION SAFE",
        )}
        {[
          { y: 68, label: "UNSORTED", items: scrambled },
          {
            y: 139,
            label: preparing && moves < 4 ? "SORTING" : "SORTED",
            items: preparing ? scrambled : values,
          },
        ].map((line) => (
          <g key={line.label}>
            <text x={65} y={line.y + 25} fontSize={18} fill={muted}>
              {line.label}
            </text>
            {line.items.map((value, i) => {
              const slot =
                preparing && line.y === 139
                  ? i === 0
                    ? movement
                    : i - Math.max(0, Math.min(1, movement - (i - 1)))
                  : i;
              const swap =
                i === 0
                  ? movement % 1
                  : Math.max(0, Math.min(1, movement - (i - 1)));
              const offset =
                preparing && line.y === 139
                  ? Math.sin(swap * Math.PI) * (i === 0 ? -24 : 24)
                  : 0;
              return (
                <g
                  key={value}
                  data-sort-value={value}
                  data-sort-slot={slot}
                  transform={`translate(0 ${offset})`}
                >
                  <rect
                    x={235 + slot * cell}
                    y={line.y}
                    width={cell - 8}
                    height={43}
                    rx={6}
                    fill={panel}
                    stroke={line.y === 139 ? accent : "#354A61"}
                  />
                  <text
                    x={235 + slot * cell + (cell - 8) / 2}
                    y={line.y + 29}
                    textAnchor="middle"
                    fontSize={21}
                    fill={ink}
                  >
                    {value}
                  </text>
                </g>
              );
            })}
          </g>
        ))}
        {footer(
          preparing
            ? `Five-entry subset / ${moves} adjacent swaps / insertion example`
            : "Illustrative subset / sorting adds preparation work",
        )}
      </>
    );
  } else if (detail === "access") {
    const walk = Math.max(
      0,
      Math.min(4, count ?? Math.floor(progress(frame, 12, 90) * 5)),
    );
    const position = Math.max(0, Math.min(4, countProgress ?? walk));
    proof = (
      <>
        {title("MIDDLE ACCESS HAS A COST TOO")}
        <text x={65} y={77} fontSize={18} fill={muted}>
          ARRAY
        </text>
        <text x={65} y={163} fontSize={18} fill={muted}>
          LINKED
        </text>
        {[0, 1, 2, 3, 4].map((index) => (
          <g key={index}>
            <rect
              x={240 + index * 78}
              y={47}
              width={58}
              height={44}
              rx={6}
              fill={index === 4 ? `${accent}25` : panel}
              stroke={index === 4 ? accent : "#354A61"}
            />
            <text
              x={269 + index * 78}
              y={76}
              textAnchor="middle"
              fontSize={20}
              fill={ink}
            >
              {index}
            </text>
            <rect
              x={240 + index * 78}
              y={133}
              width={58}
              height={44}
              rx={6}
              fill={index === walk ? `${accent}25` : panel}
              stroke={index <= walk ? accent : "#354A61"}
            />
            <text
              x={269 + index * 78}
              y={162}
              textAnchor="middle"
              fontSize={20}
              fill={ink}
            >
              {index}
            </text>
            {index < 4 && (
              <path
                d={`M${302 + index * 78} 155 H${315 + index * 78} M${310 + index * 78} 150 L${316 + index * 78} 155 L${310 + index * 78} 160`}
                fill="none"
                stroke={index < walk ? accent : "#354A61"}
                strokeWidth={2}
              />
            )}
          </g>
        ))}
        <circle
          data-access-walk={walk}
          cx={269 + position * 78}
          cy={190}
          r={5}
          fill={accent}
        />
        <text x={396} y={116} textAnchor="middle" fontSize={16} fill={accent}>
          known index: direct address
        </text>
        {footer(`Index 4 / ${walk} of four links from the head`)}
      </>
    );
  } else if (detail === "bounds") {
    const insertion = visual.emptyAt ?? 0;
    const lastCheck = binaryTrace(visual.items, visual.searchFor!).at(-1)!;
    const last = lastCheck.mid;
    const moveLower = lastCheck.relation === "<";
    const boundFrom = moveLower ? lastCheck.lo : lastCheck.hi;
    const boundTo = moveLower ? insertion : insertion - 1;
    const fixed = moveLower ? insertion - 1 : insertion;
    const cell = 560 / n;
    const center = (i: number) =>
      Math.max(40, Math.min(680, 80 + (i + 0.5) * cell));
    const move = progress(frame, 12, 40);
    const boundX =
      center(boundFrom) + (center(boundTo) - center(boundFrom)) * move;
    proof = (
      <>
        {title("WHY THE SEARCH RANGE BECOMES EMPTY")}
        {visual.items.map((item, i) => (
          <g key={i} opacity={i === last || i === insertion ? 1 : 0.35}>
            <rect
              x={80 + i * cell + 2}
              y={86}
              width={cell - 7}
              height={44}
              rx={6}
              fill={panel}
              stroke={i === last ? accent : "#354A61"}
            />
            <text
              x={center(i) - 1.5}
              y={115}
              textAnchor="middle"
              fontSize={21}
              fill={ink}
            >
              {item}
            </text>
          </g>
        ))}
        <text
          x={center(fixed)}
          y={161}
          textAnchor="middle"
          fontSize={19}
          fill={muted}
        >
          {moveLower ? "HI" : "LO"} {fixed}
        </text>
        <path d={`M${center(fixed)} 135 v9`} stroke={muted} strokeWidth={2} />
        <text x={boundX} y={60} textAnchor="middle" fontSize={20} fill={accent}>
          {moveLower ? "LO" : "HI"}{" "}
          {move < 1 ? `${boundFrom} → ${boundTo}` : boundTo}
        </text>
        <path
          d={`M${boundX} 67 v13 m-5 -5 l5 5 l5 -5`}
          fill="none"
          stroke={accent}
          strokeWidth={2}
        />
        <text x={360} y={196} textAnchor="middle" fontSize={23} fill={ink}>
          {lastCheck.value} {lastCheck.relation} {visual.searchFor} :{" "}
          {moveLower ? "lo = mid + 1" : "hi = mid - 1"} = {boundTo}
        </text>
        {footer("Lower: mid + 1 / upper: mid - 1 / exclude the middle")}
      </>
    );
  } else {
    const insertion = visual.emptyAt ?? 0;
    const target = visual.searchFor;
    const trace = target === undefined ? [] : binaryTrace(visual.items, target);
    const found = trace.at(-1)?.relation === "=";
    const gap = 25;
    const card =
      (600 - Math.max(0, trace.length - 1) * gap) / Math.max(1, trace.length);
    proof = (
      <>
        {title(
          trace.length
            ? `${trace.length}-CHECK TRACE SUMMARY / TARGET ${target}`
            : "THE SEARCH RANGE IS EMPTY",
        )}
        {trace.map((entry, i) => {
          const x = 60 + i * (card + gap);
          return (
            <g key={entry.mid}>
              <rect
                x={x}
                y={53}
                width={card}
                height={111}
                rx={10}
                fill={panel}
                stroke={entry.relation === "=" ? accent : "#354A61"}
              />
              <text
                x={x + card / 2}
                y={76}
                textAnchor="middle"
                fontSize={16}
                fill={muted}
              >
                CHECK {i + 1}
              </text>
              <text
                x={x + card / 2}
                y={115}
                textAnchor="middle"
                fontSize={34}
                fill={entry.relation === "=" ? accent : ink}
              >
                {entry.value}
              </text>
              <text
                x={x + card / 2}
                y={145}
                textAnchor="middle"
                fontSize={20}
                fill={muted}
              >
                {entry.value} {entry.relation} {target}
              </text>
              {i < trace.length - 1 && (
                <path
                  d={`M${x + card + 4} 108 h15 m-5 -5 l5 5 l-5 5`}
                  fill="none"
                  stroke={accent}
                  strokeWidth={2}
                />
              )}
            </g>
          );
        })}
        <text x={360} y={202} textAnchor="middle" fontSize={25} fill={accent}>
          {found
            ? `FOUND ${target} / INDEX ${trace.at(-1)?.mid}`
            : `lo ${insertion} > hi ${insertion - 1} / no match`}
        </text>
        {footer(
          found
            ? `${trace.length} checks / ${n} sorted entries`
            : "Empty inclusive range / return -1",
        )}
      </>
    );
  }
  return (
    <svg
      data-array-detail={detail}
      width={720}
      height={250}
      viewBox="0 0 720 250"
      style={{
        position: "absolute",
        left: 0,
        top: 320,
        overflow: "visible",
        fontFamily: mono,
      }}
    >
      <path d="M45 3 H675" stroke="#293C51" />
      {proof}
    </svg>
  );
}
