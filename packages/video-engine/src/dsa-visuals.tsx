import { Easing, interpolate } from "remotion";
import type { BeatProps } from "./beats";
import type { Visual } from "./model";
import { growthValue } from "./cost-panel";
import { graphMemoryExample } from "./graph-state";
const mono = "Consolas, monospace";
const ease = (frame: number) =>
  interpolate(frame, [0, 18], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
    easing: Easing.inOut(Easing.cubic),
  });
const text = {
  fill: "#E8EFF6",
  fontFamily: mono,
  textAnchor: "middle" as const,
};
function Heading({ label }: { label: string }) {
  return (
    <text {...text} x={360} y={55} fontSize={28} fontWeight={700}>
      {label}
    </text>
  );
}
export function PointersVisual({
  v,
  previous,
  f,
  accent,
}: BeatProps & { v: Extract<Visual, { type: "pointers" }> }) {
  const before = previous?.type === "pointers" ? previous : v;
  const p = ease(f),
    cell = 630 / v.items.length,
    x = (i: number) => 45 + cell * (i + 0.5);
  const left = x(before.left) + (x(v.left) - x(before.left)) * p,
    right = x(before.right) + (x(v.right) - x(before.right)) * p;
  return (
    <svg width={720} height={600}>
      <Heading label={v.label} />
      <text {...text} x={360} y={135} fontSize={22} fill="#9DAEC2">
        SORTED PRICES · TARGET {v.target}
      </text>
      {v.items.map((value, i) => (
        <g key={i}>
          <rect
            x={x(i) - cell / 2 + 4}
            y={225}
            width={cell - 8}
            height={84}
            rx={10}
            fill={i === v.left || i === v.right ? `${accent}22` : "#111B28"}
            stroke={i === v.left || i === v.right ? accent : "#3A4B60"}
            strokeWidth={2}
          />
          <text {...text} x={x(i)} y={278} fontSize={31}>
            {value}
          </text>
          <text {...text} x={x(i)} y={335} fontSize={17} fill="#798DA6">
            {i}
          </text>
        </g>
      ))}
      {[
        { x: left, label: "LEFT" },
        { x: right, label: "RIGHT" },
      ].map((a) => (
        <g key={a.label}>
          <path
            d={`M${a.x - 9} 205 L${a.x} 219 L${a.x + 9} 205 Z`}
            fill={accent}
          />
          <text {...text} x={a.x} y={191} fontSize={19} fill={accent}>
            {a.label}
          </text>
        </g>
      ))}
      <rect
        x={160}
        y={393}
        width={400}
        height={90}
        rx={14}
        fill="#111B28"
        stroke={v.status === "found" ? accent : "#34465A"}
      />
      <text {...text} x={360} y={450} fontSize={36} fill={accent}>
        {v.items[v.left]} + {v.items[v.right]} = {v.sum}
      </text>
      <text {...text} x={360} y={536} fontSize={23}>
        {v.status === "found"
          ? "BUDGET MATCH"
          : v.status === "move-left"
            ? "TOO SMALL → LEFT MOVES"
            : v.status === "move-right"
              ? "TOO LARGE → RIGHT MOVES"
              : "CHECK THE SUM"}
      </text>
    </svg>
  );
}
export function LinkedListVisual({
  v,
  previous,
  f,
  accent,
  count,
  countProgress,
  inputSize,
}: BeatProps & { v: Extract<Visual, { type: "linked-list" }> }) {
  const point = (id: string) => {
    const i = v.nodes.findIndex((n) => n.id === id);
    return { x: 130 + (i % 3) * 230, y: 180 + Math.floor(i / 3) * 180 };
  };
  const p = ease(v.steps?.length ? f * 3 : f);
  const old = previous?.type === "linked-list" ? previous : v;
  const edgePath = (from: string, to: string) => {
    const a = point(from),
      b = point(to);
    return a.y === b.y
      ? Math.abs(b.x - a.x) > 240
        ? `M${a.x} ${a.y - 43} C${a.x} ${a.y - 135},${b.x} ${b.y - 135},${b.x} ${b.y - 48}`
        : `M${a.x + (b.x > a.x ? 72 : -72)} ${a.y} L${b.x + (b.x > a.x ? -78 : 78)} ${b.y}`
      : `M${a.x + 72} ${a.y} H${a.x + 84} V${Math.min(a.y, b.y) + 112} H${b.x} V${b.y - 47}`;
  };
  const active =
    v.walk && count !== undefined
      ? v.walk[Math.max(0, Math.min(v.walk.length - 1, count - 1))]
      : v.active;
  const walkPosition = Math.max(
    0,
    Math.min((v.walk?.length ?? 1) - 1, (countProgress ?? 1) - 1),
  );
  const beforePoint = point(v.walk?.[Math.floor(walkPosition)] ?? active);
  const afterPoint = point(v.walk?.[Math.ceil(walkPosition)] ?? active);
  const fraction = walkPosition % 1;
  const connected = new Set<string>();
  let cursor: string | null = v.head;
  while (cursor && !connected.has(cursor)) {
    connected.add(cursor);
    const node = v.nodes.find((n) => n.id === cursor);
    cursor = v.rewire?.from === cursor ? v.rewire.to : (node?.next ?? null);
  }
  return (
    <svg width={720} height={600}>
      <defs>
        <marker
          id="list-arrow"
          markerWidth={8}
          markerHeight={8}
          refX={7}
          refY={4}
          orient="auto"
        >
          <path d="M0 0 L8 4 L0 8" fill={accent} />
        </marker>
      </defs>
      <Heading label={v.label} />
      {v.nodes.map((node) => {
        const target = v.rewire?.from === node.id ? v.rewire.to : node.next;
        const oldTarget =
          old.rewire?.from === node.id
            ? old.rewire.to
            : old.nodes.find((n) => n.id === node.id)?.next;
        const changed = oldTarget !== target;
        return (
          <g key={`edge-${node.id}`}>
            {changed && oldTarget && p < 1 && (
              <path
                d={edgePath(node.id, oldTarget)}
                fill="none"
                stroke={accent}
                strokeWidth={3}
                markerEnd="url(#list-arrow)"
                opacity={1 - p}
              />
            )}
            {target && (
              <path
                d={edgePath(node.id, target)}
                fill="none"
                stroke={accent}
                strokeWidth={3}
                markerEnd="url(#list-arrow)"
                opacity={changed ? p : 1}
              />
            )}
          </g>
        );
      })}
      {v.nodes.map((node) => {
        const a = point(node.id),
          fresh = !old.nodes.some((n) => n.id === node.id);
        return (
          <g
            key={node.id}
            opacity={(fresh ? p : 1) * (connected.has(node.id) ? 1 : 0.58)}
            transform={`translate(0 ${fresh ? (1 - p) * 18 : 0})`}
          >
            <rect
              x={a.x - 72}
              y={a.y - 43}
              width={144}
              height={86}
              rx={12}
              fill={node.id === active ? `${accent}20` : "#111B28"}
              stroke={node.id === active ? accent : "#405168"}
              strokeWidth={2}
              strokeDasharray={connected.has(node.id) ? undefined : "6 5"}
            />
            <text {...text} x={a.x} y={a.y + 6} fontSize={24}>
              {node.label}
            </text>
            <text {...text} x={a.x} y={a.y + 73} fontSize={18} fill="#A0B1C5">
              {!connected.has(node.id)
                ? "DETACHED"
                : node.id === v.head
                  ? "HEAD"
                  : `NODE ${node.id}`}
            </text>
            {node.address && (
              <text {...text} x={a.x} y={a.y + 98} fontSize={16} fill="#8BA1B8">
                {node.address}
              </text>
            )}
            {node.next === null && v.rewire?.from !== node.id && (
              <text {...text} x={a.x} y={a.y + 30} fontSize={14} fill="#8EA2BA">
                next: null
              </text>
            )}
          </g>
        );
      })}
      {v.nodes.length <= 4 &&
        (() => {
          const node = v.nodes.find((node) => node.id === active)!;
          const next = v.rewire?.from === active ? v.rewire.to : node.next;
          const destination = v.nodes.find((node) => node.id === next);
          return (
            <g>
              <rect
                x={260}
                y={335}
                width={405}
                height={122}
                rx={12}
                fill="#101A26"
                stroke="#34485E"
              />
              <text
                x={282}
                y={363}
                fontFamily={mono}
                fontSize={16}
                fill="#8BA1B8"
              >
                NODE RECORD · EXAMPLE ADDRESSES
              </text>
              <text
                x={282}
                y={398}
                fontFamily={mono}
                fontSize={23}
                fill={accent}
              >
                {node.label}
                {node.address ? ` @ ${node.address}` : ""}
              </text>
              <text
                x={282}
                y={431}
                fontFamily={mono}
                fontSize={20}
                fill="#E8EFF6"
              >
                next →{" "}
                {destination
                  ? `${destination.label}${destination.address ? ` (${destination.address})` : ""}`
                  : "null"}
              </text>
            </g>
          );
        })()}
      {v.detail !== "links" && (
        <g>
          <rect
            x={64}
            y={490}
            width={592}
            height={90}
            rx={12}
            fill="#101A26"
            stroke="#34485E"
          />
          <text {...text} x={360} y={521} fontSize={19} fill={accent}>
            {v.detail === "memory"
              ? "EXAMPLE ADDRESSES · LINKS DEFINE ORDER"
              : v.detail === "scale"
                ? `${(inputSize ?? 1000000).toLocaleString("en-US")} NODES / LAST-ITEM SEARCH`
                : "SINGLY LINKED · NO PREVIOUS POINTER"}
          </text>
          <text {...text} x={360} y={555} fontSize={18}>
            {v.detail === "memory"
              ? "value + next reference / locality depends on layout"
              : v.detail === "scale"
                ? "Walk next links: up to n visits / array index: 1"
                : "Find the predecessor from HEAD before bypassing"}
          </text>
        </g>
      )}
      {v.walk && (
        <g>
          <rect
            x={beforePoint.x + (afterPoint.x - beforePoint.x) * fraction - 79}
            y={beforePoint.y + (afterPoint.y - beforePoint.y) * fraction - 50}
            width={158}
            height={100}
            rx={17}
            fill="none"
            stroke={accent}
            strokeWidth={3}
          />
          {v.detail === "links" && (
            <text {...text} x={360} y={568} fontSize={22} fill={accent}>
              {v.walk
                .slice(0, Math.max(0, count ?? 0))
                .map((id) => v.nodes.find((node) => node.id === id)?.label)
                .join(" → ")}
            </text>
          )}
        </g>
      )}
    </svg>
  );
}
export function CallStackVisual({
  v,
  f,
  previous,
  accent,
  cueFrames,
}: BeatProps & { v: Extract<Visual, { type: "call-stack" }> }) {
  const p = ease(f),
    old = previous?.type === "call-stack" ? previous : v;
  const cueAt = (index: number, fallback: number) =>
    cueFrames?.[index] ?? fallback;
  const step = v.returnStep;
  const received = !step || f >= cueAt(0, 18);
  const returned = step ? f >= cueAt(1, 60) : !v.cue || f >= 0;
  const beforeCall = Boolean(v.cue && f < 0);
  const calls = beforeCall || (step && !received) ? old.calls : v.calls;
  const expression = step
    ? `${step.multiplier} × ${received ? step.value : "?"}${returned ? ` = ${step.result}` : " = ?"}`
    : beforeCall
      ? old.expression
      : v.expression;
  const example = v.example;
  const arrangement =
    v.detail === "seating"
      ? f >= cueAt(1, 60)
        ? 2
        : f >= cueAt(0, 30)
          ? 1
          : 0
      : 0;
  const seat = (person: number, arrangementIndex: number) => {
    const size = example?.items.length ?? 0;
    if (arrangementIndex >= 1 && person < 2) return 1 - person;
    if (arrangementIndex >= 2 && size >= 4 && person >= size - 2)
      return size * 2 - 3 - person;
    return person;
  };
  if ((v.detail === "directions" || v.detail === "progress") && v.trace) {
    const trace = v.trace;
    const proofRow = (
      values: string[],
      y: number,
      label: string,
      cueIndex: number,
      repeated = false,
      reverse = false,
    ) => {
      const progress = Math.max(
        0,
        Math.min(values.length - 1, (f - cueAt(cueIndex, cueIndex * 70)) / 12),
      );
      const active = reverse
        ? values.length - 1 - Math.floor(progress)
        : Math.floor(progress);
      return (
        <g>
          <text {...text} x={360} y={y - 35} fontSize={23} fill={accent}>
            {label}
          </text>
          {values.map((value, index) => {
            const x = 70 + index * (580 / Math.max(1, values.length - 1));
            const visited = reverse ? index >= active : index <= active;
            return (
              <g key={`${index}-${value}`}>
                {index > 0 && (
                  <path
                    d={`M${x - 580 / (values.length - 1) + 54} ${y + 23} H${x - 54}`}
                    stroke={visited ? accent : "#42536A"}
                    strokeWidth={3}
                  />
                )}
                <rect
                  x={x - 51}
                  y={y - 7}
                  width={102}
                  height={64}
                  rx={12}
                  fill={index === active ? `${accent}22` : "#101A26"}
                  stroke={visited ? accent : "#42536A"}
                  strokeWidth={2}
                />
                <text
                  {...text}
                  x={x}
                  y={y + 31}
                  fontSize={value.length > 6 ? 18 : 24}
                >
                  {value}
                </text>
              </g>
            );
          })}
          <text {...text} x={360} y={y + 100} fontSize={19} fill="#AEBCCC">
            {repeated
              ? "Same input keeps adding unfinished work"
              : v.detail === "progress"
                ? "Smaller input reaches the stopping case"
                : cueIndex === 0
                  ? "Each caller waits for the next smaller call →"
                  : "← Each result completes the waiting caller"}
          </text>
        </g>
      );
    };
    return (
      <svg width={720} height={600}>
        <Heading
          label={
            v.detail === "directions"
              ? "CALLS DOWN / RESULTS BACK"
              : "STOPPING CASE + SMALLER INPUT"
          }
        />
        <text {...text} x={360} y={100} fontSize={18} fill="#96A9C0">
          EXPLANATORY TRACE · CALLS AND RESULTS
        </text>
        {proofRow(
          trace.calls,
          190,
          v.detail === "directions"
            ? "CALL DIRECTION"
            : "PROGRESS TOWARD BASE CASE",
          0,
        )}
        {proofRow(
          v.detail === "directions"
            ? [...trace.results].reverse()
            : trace.calls.map(() => trace.repeated!),
          410,
          v.detail === "directions"
            ? "RETURN DIRECTION"
            : "SAME INPUT / NO PROGRESS",
          1,
          v.detail === "progress",
          v.detail === "directions",
        )}
      </svg>
    );
  }
  return (
    <svg width={720} height={600}>
      <Heading label={v.label} />
      <text {...text} x={360} y={106} fontSize={18} fill="#96A9C0">
        CALL STACK · LAST CALL RETURNS FIRST
      </text>
      {example && (
        <g>
          {example.items.map((item, i) => {
            const a = seat(i, Math.max(0, arrangement - 1));
            const b = seat(i, arrangement);
            const motion = arrangement
              ? ease(f - cueAt(arrangement - 1, arrangement * 30))
              : 1;
            const x =
              360 +
              (a + (b - a) * motion - (example.items.length - 1) / 2) * 110;
            const arc =
              v.detail === "seating"
                ? 46 +
                  (a === b
                    ? 0
                    : Math.sin(Math.PI * motion) * (b > a ? -46 : 46))
                : 0;
            return (
              <g
                key={item}
                data-seating-person={v.detail === "seating" ? item : undefined}
                transform={`translate(0 ${arc})`}
              >
                <rect
                  x={x - 40}
                  y={137}
                  width={80}
                  height={57}
                  rx={10}
                  fill={`${accent}15`}
                  stroke="#3F5065"
                />
                <circle cx={x} cy={150} r={8} fill={accent} />
                <path
                  d={`M${x - 14} 173 Q${x} 153 ${x + 14} 173`}
                  fill={accent}
                />
                <text {...text} x={x} y={219} fontSize={18}>
                  {item}
                </text>
              </g>
            );
          })}
          {v.detail === "seating" && (
            <>
              {example.items.map((_, index) => (
                <text
                  {...text}
                  key={index}
                  x={360 + (index - (example.items.length - 1) / 2) * 110}
                  y={340}
                  fontSize={16}
                  fill="#A6B6C8"
                >
                  SEAT {index + 1}
                </text>
              ))}
              <text {...text} x={360} y={375} fontSize={20} fill={accent}>
                ARRANGEMENT EXAMPLE {arrangement + 1}
              </text>
            </>
          )}
          <title>{example.label}</title>
        </g>
      )}
      {expression && calls.length <= 4 && (
        <text
          {...text}
          x={360}
          y={v.detail === "seating" ? 420 : calls.length <= 2 ? 335 : 285}
          fontSize={30}
          fill={accent}
        >
          {expression}
        </text>
      )}
      {calls.map((call, i) => {
        const pendingReturn = Boolean(
          step && call.label === step.to && !returned,
        );
        const state = pendingReturn
          ? received
            ? "active"
            : "waiting"
          : call.state;
        const value = pendingReturn
          ? received
            ? `${step!.multiplier} × ${step!.value}`
            : "waiting"
          : call.value;
        const y = 510 - i * (v.example ? 48 : 64),
          fresh = i >= old.calls.length;
        return (
          <g
            key={call.label}
            opacity={fresh ? p : 1}
            transform={`translate(${fresh ? (1 - p) * 24 : 0} 0)`}
          >
            <rect
              x={130}
              y={y - (v.example ? 37 : 48)}
              width={460}
              height={v.example ? 43 : 56}
              rx={10}
              fill={state === "active" ? `${accent}22` : "#111B28"}
              stroke={state === "active" ? accent : "#374A60"}
              strokeWidth={2}
            />
            <text
              x={156}
              y={y - 7}
              fontFamily={mono}
              fontSize={26}
              fill={state === "returned" ? "#899CB3" : "#EEF3F9"}
            >
              {call.label}
            </text>
            <text
              x={565}
              y={y - 7}
              textAnchor="end"
              fontFamily={mono}
              fontSize={23}
              fill={accent}
            >
              {value ?? (state === "waiting" ? "waiting" : "active")}
            </text>
          </g>
        );
      })}
      {step &&
        received &&
        !returned &&
        (() => {
          const transfer = ease(f - cueAt(0, 18));
          const destination =
            510 - (v.calls.length - 1) * (v.example ? 48 : 64);
          return (
            <g data-return-transfer>
              <path
                d={`M630 ${destination - 65} V${destination - 12}`}
                stroke={accent}
                strokeWidth={2}
              />
              <circle
                cx={630}
                cy={destination - 65 + transfer * 53}
                r={23}
                fill="#192535"
                stroke={accent}
                strokeWidth={2}
              />
              <text
                {...text}
                x={630}
                y={destination - 58 + transfer * 53}
                fontSize={23}
                fill={accent}
              >
                {step.value}
              </text>
              <text {...text} x={360} y={560} fontSize={22} fill="#B3C0D0">
                {step.from} → {step.to}: received {step.value}
              </text>
            </g>
          );
        })()}
      {v.result && returned && (
        <text {...text} x={360} y={560} fontSize={31} fill={accent}>
          RETURN {v.result}
        </text>
      )}
    </svg>
  );
}

const positions = [
  [360, 150],
  [205, 280],
  [515, 280],
  [100, 410],
  [290, 410],
  [455, 410],
  [630, 410],
];
export function GraphVisual({
  v,
  previous,
  f,
  accent,
  cueFrames,
}: BeatProps & { v: Extract<Visual, { type: "graph" }> }) {
  const point = (id: string) =>
    positions[v.nodes.findIndex((n) => n.id === id)] ?? positions[0];
  const old = previous?.type === "graph" ? previous : v;
  const path =
    v.path && v.visited.includes(v.path.at(-1)!) ? v.path : undefined;
  const memory = graphMemoryExample(v);
  const proofPhase = (cueFrames ?? []).filter((cue) => f >= cue).length;
  const memoryGroup = proofPhase >= 2 ? memory.stack : memory.queue;
  const a = point(old.active),
    b = point(v.active),
    p = ease(f);
  return (
    <svg width={720} height={600}>
      <Heading label={v.label} />
      <text {...text} x={360} y={94} fontSize={18} fill="#9DAFC6">
        {v.detail === "growth"
          ? `${v.nodes.length} VERTICES + ${v.edges.length} EDGES · ADJACENCY LISTS`
          : v.detail === "visited"
            ? "MARK ON DISCOVERY · SKIP SEEN ROOMS"
            : v.mode === "bfs"
              ? "BREADTH FIRST · QUEUE"
              : "DEPTH FIRST · STACK"}
      </text>
      {v.edges.map((e, i) => {
        const a = point(e.from),
          b = point(e.to);
        const route = path?.some(
          (id, index, path) =>
            index > 0 &&
            ((path[index - 1] === e.from && id === e.to) ||
              (path[index - 1] === e.to && id === e.from)),
        );
        return (
          <line
            key={i}
            x1={a[0]}
            y1={a[1]}
            x2={b[0]}
            y2={b[1]}
            stroke={
              route || (!path && v.visited.includes(e.to)) ? accent : "#3A4D65"
            }
            strokeWidth={
              route || (v.detail === "growth" && proofPhase >= 2) ? 7 : 3
            }
            opacity={v.detail === "growth" && proofPhase === 1 ? 0.3 : 1}
          />
        );
      })}
      {v.nodes.map((node) => {
        const a = point(node.id);
        return (
          <g key={node.id}>
            <circle
              cx={a[0]}
              cy={a[1]}
              r={33}
              fill={
                (
                  v.detail === "memory"
                    ? memoryGroup.includes(node.id)
                    : v.visited.includes(node.id)
                )
                  ? `${accent}30`
                  : "#111B28"
              }
              stroke={
                v.visited.includes(node.id) || v.frontier.includes(node.id)
                  ? accent
                  : "#4A607A"
              }
              strokeDasharray={
                !v.visited.includes(node.id) && v.frontier.includes(node.id)
                  ? "5 4"
                  : undefined
              }
              strokeWidth={2}
              opacity={
                v.detail === "memory" && !memoryGroup.includes(node.id)
                  ? 0.4
                  : 1
              }
            />
            <text
              {...text}
              x={a[0]}
              y={a[1] + (node.label.length > 3 ? 1 : 9)}
              fontSize={27}
            >
              {node.label.length > 3 ? node.id : node.label}
            </text>
            {node.label.length > 3 && (
              <g>
                <rect
                  x={a[0] - 36}
                  y={a[1] + 37}
                  width={72}
                  height={27}
                  rx={5}
                  fill={accent}
                />
                <text
                  {...text}
                  x={a[0]}
                  y={a[1] + 57}
                  fontSize={18}
                  fill="#081116"
                >
                  {node.label.replace(node.id, "").trim()}
                </text>
              </g>
            )}
          </g>
        );
      })}
      <circle
        cx={a[0] + (b[0] - a[0]) * p}
        cy={a[1] + (b[1] - a[1]) * p}
        r={41}
        fill="none"
        stroke={accent}
        strokeWidth={3}
      />
      <rect
        x={45}
        y={489}
        width={630}
        height={83}
        rx={12}
        fill="#111B28"
        stroke="#33475F"
      />
      <text x={65} y={519} fontFamily={mono} fontSize={17} fill="#91A7C2">
        {v.detail === "path" && path
          ? "SAVED PARENT LINKS / FEWEST EQUAL-COST DOORS"
          : v.detail === "growth"
            ? "FULL TRAVERSAL / GROWTH MODEL, NOT VISITS"
            : v.detail === "memory"
              ? "ILLUSTRATED FRONTIERS / WORST-CASE SPACE O(V)"
              : v.detail === "visited"
                ? `${v.active} ALREADY SEEN / SKIP RE-ENTRY`
                : v.mode === "bfs"
                  ? "QUEUE · NEXT AT LEFT"
                  : "CALL STACK · TOP AT RIGHT"}
      </text>
      <text x={65} y={552} fontFamily={mono} fontSize={25} fill={accent}>
        {v.detail === "path" && path
          ? `${path.join(" → ")} / ${path.length - 1} doors`
          : v.detail === "growth"
            ? `${v.nodes.length} + ${v.edges.length} = ${v.nodes.length + v.edges.length} / O(V + E)`
            : v.detail === "memory"
              ? `${proofPhase >= 2 ? "DFS STACK" : "BFS QUEUE"} [${memoryGroup.join(" ")}] / ${memoryGroup.length} rooms`
              : v.detail === "visited"
                ? [...new Set([...v.visited, ...v.frontier])].join("   ")
                : v.frontier.length
                  ? v.frontier.join("   ")
                  : "empty"}
      </text>
    </svg>
  );
}
export function GrowthVisual({
  v,
  accent,
}: BeatProps & { v: Extract<Visual, { type: "complexity" }> }) {
  const kinds = ["O(1)", "O(log n)", "O(n)", "O(n log n)", "O(n²)"] as const;
  const maximum = v.n * v.n;
  const xpos = (n: number) => 85 + ((n - 1) / (v.n - 1)) * 562.5;
  const ypos = (work: number) => 480 - (work / maximum) * 320;
  return (
    <svg width={720} height={600}>
      <Heading label={v.label} />
      <text {...text} x={360} y={103} fontSize={18} fill="#9AACC3">
        SAME INPUT · MODEL OPERATIONS · LINEAR AXES
      </text>
      {[0, 1, 2, 3, 4].map((part) => {
        const y = (maximum * part) / 4;
        return (
          <g key={y}>
            <line x1={85} y1={ypos(y)} x2={650} y2={ypos(y)} stroke="#23354A" />
            <text
              x={68}
              y={ypos(y) + 6}
              textAnchor="end"
              fontFamily={mono}
              fontSize={17}
              fill="#879DB9"
            >
              {y >= 1e6
                ? `${(y / 1e6).toLocaleString("en-US")}m`
                : y.toLocaleString("en-US")}
            </text>
          </g>
        );
      })}
      {kinds.map((kind) => (
        <polyline
          key={kind}
          points={Array.from({ length: 61 }, (_, i) => {
            const n = 1 + (i / 60) * (v.n - 1);
            return `${xpos(n)},${ypos(growthValue(kind, n))}`;
          }).join(" ")}
          fill="none"
          stroke={kind === v.focus ? accent : "#50627B"}
          strokeWidth={kind === v.focus ? 5 : 2}
          opacity={kind === v.focus ? 1 : 0.45}
        />
      ))}
      {[
        ...new Set([
          1,
          Math.round(v.n / 4),
          Math.round(v.n / 2),
          Math.round((v.n * 3) / 4),
          v.n,
        ]),
      ]
        .filter((n) => n >= 1)
        .map((n) => (
          <text
            key={n}
            {...text}
            x={xpos(n)}
            y={514}
            fontSize={18}
            fill="#A5B6CA"
          >
            {n}
          </text>
        ))}
      <text {...text} x={360} y={555} fontSize={24} fill={accent}>
        {v.focus} · n grows →
      </text>
    </svg>
  );
}
