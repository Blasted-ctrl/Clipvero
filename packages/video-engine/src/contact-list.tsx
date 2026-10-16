import { Easing, interpolate } from "remotion";
import type { BeatProps } from "./beats";
import type { Visual } from "./model";

/** A fixed contact book: cue-driven checks move through the same visible rows. */
export function ContactList({
  v,
  f,
  accent,
  continuing,
  count,
}: BeatProps & { v: Extract<Visual, { type: "array" }> }) {
  const target = v.target ?? 0;
  const checks =
    v.mode === "scan"
      ? Math.max(
          0,
          Math.min(
            target + 1,
            Math.round(count ?? Math.max(0, Math.floor((f - 12) / 24) + 1)),
          ),
        )
      : 0;
  const found = checks > target;
  const gap = 8;
  const height = Math.min(
    68,
    (368 - gap * (v.items.length - 1)) / v.items.length,
  );
  return (
    <svg
      width={720}
      height={600}
      style={{ fontFamily: "Consolas, monospace" }}
      data-contact-list
    >
      <rect
        x={38}
        y={12}
        width={644}
        height={570}
        rx={22}
        fill="#0E1825"
        stroke="#35475C"
      />
      <text x={70} y={51} fontSize={21} fill="#A8BCD3">
        YOUR CONTACTS
      </text>
      <text x={650} y={51} textAnchor="end" fontSize={17} fill="#A8BCD3">
        {v.items.length} saved
      </text>
      <rect
        x={62}
        y={75}
        width={596}
        height={65}
        rx={12}
        fill="#162334"
        stroke={accent}
      />
      <circle
        cx={92}
        cy={104}
        r={10}
        fill="none"
        stroke={accent}
        strokeWidth={3}
      />
      <path d="M100 112 l8 8" stroke={accent} strokeWidth={3} />
      <text x={128} y={118} fontSize={31} fill="#F0F5FB">
        {v.items[target]}
      </text>
      <text x={631} y={116} textAnchor="end" fontSize={19} fill={accent}>
        {found ? "FOUND" : "FIND CONTACT"}
      </text>
      {v.items.map((name, index) => {
        const y = 166 + index * (height + gap);
        const entry = continuing
          ? 1
          : interpolate(f, [index * 2 - 6, index * 2 + 6], [0, 1], {
              extrapolateLeft: "clamp",
              extrapolateRight: "clamp",
              easing: Easing.out(Easing.cubic),
            });
        const active = checks === index + 1;
        const visited = index < checks - 1;
        const match = found && index === target;
        return (
          <g
            key={name}
            opacity={entry}
            transform={`translate(0 ${(1 - entry) * 16})`}
            data-checked={index < checks}
          >
            <rect
              x={62}
              y={y}
              width={596}
              height={height}
              rx={10}
              fill={match ? `${accent}26` : active ? "#1A2B40" : "#121F2F"}
              stroke={active || match ? accent : "#283D53"}
              strokeWidth={active ? 2 : 1}
            />
            <circle
              cx={101}
              cy={y + height / 2}
              r={Math.min(21, height * 0.33)}
              fill={match ? accent : "#263C52"}
            />
            <text
              x={101}
              y={y + height / 2 + 7}
              textAnchor="middle"
              fontSize={Math.min(23, height * 0.5)}
              fill={match ? "#07111B" : "#D9E8F6"}
            >
              {name.slice(0, 1)}
            </text>
            <text
              x={142}
              y={y + height / 2 + 9}
              fontSize={Math.min(29, height * 0.47)}
              fill={visited ? "#91A4BA" : "#F0F5FB"}
            >
              {name}
            </text>
            <text
              x={627}
              y={y + height / 2 + 8}
              textAnchor="end"
              fontSize={Math.min(24, height * 0.43)}
              fill={match ? accent : "#91A4BA"}
            >
              {v.values?.[index] ?? "saved"}
            </text>
          </g>
        );
      })}
      <text
        x={360}
        y={560}
        textAnchor="middle"
        fontSize={18}
        fill={found ? accent : "#A8BCD3"}
      >
        {found
          ? `${checks} checks / ${v.items[target]}'s number returned`
          : v.mode === "scan"
            ? `${checks} names checked / find the matching key`
            : `${v.items.length} fictional contacts. One number to find.`}
      </text>
    </svg>
  );
}
