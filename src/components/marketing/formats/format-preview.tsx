import type { FormatPreview as PreviewKind } from "../data/formats";

/** Small looping CSS compositions that show how each format looks. Decorative only. */
export function FormatPreview({ kind }: { kind: PreviewKind }) {
  return (
    <div
      aria-hidden="true"
      className="relative h-44 overflow-hidden rounded-xl border border-white/[0.06] bg-(--bg)"
    >
      {previews[kind]}
    </div>
  );
}

const caption = (text: string) => (
  <span className="absolute inset-x-3 bottom-3 rounded-md bg-black/55 px-2 py-1 text-center text-[0.8125rem] font-bold text-white">
    {text}
  </span>
);

const previews: Record<PreviewKind, React.ReactNode> = {
  characters: (
    <div className="absolute inset-0 bg-[radial-gradient(90%_70%_at_50%_0%,#2e1065,transparent)]">
      <span className="absolute inset-x-0 bottom-0 h-7 border-t border-white/10 bg-[#1b0f3d]" />
      <div className="absolute bottom-4 left-[20%] flex flex-col items-center mk-float">
        <span className="size-10 rounded-xl bg-linear-to-b from-[#ede9fe] to-[#a78bfa]" />
        <span className="mt-1 h-8 w-8 rounded-lg bg-(--accent)" />
      </div>
      <div className="absolute bottom-4 right-[20%] flex flex-col items-center mk-float [animation-delay:-3s]">
        <span className="size-10 rounded-xl bg-linear-to-b from-[#cffafe] to-[#22d3ee]" />
        <span className="mt-1 h-8 w-8 rounded-lg bg-[#0891b2]" />
      </div>
      <div className="mk-seq absolute inset-x-4 top-3 flex flex-col gap-1.5 text-[0.75rem] font-medium">
        <span className="w-fit rounded-xl rounded-bl-sm bg-(--accent) px-2.5 py-1 text-white">
          I invented Wi-Fi.
        </span>
        <span className="ml-auto w-fit rounded-xl rounded-br-sm bg-[#0e7490] px-2.5 py-1 text-white">
          You invented buffering.
        </span>
      </div>
    </div>
  ),
  story: (
    <div className="absolute inset-0 bg-linear-to-b from-[#1e1b4b] via-[#6d28d9] to-[#f59e0b]">
      <span className="absolute left-[18%] top-[30%] h-24 w-5 bg-[repeating-linear-gradient(#fff_0_10px,#dc2626_10px_20px)] [clip-path:polygon(20%_0,80%_0,100%_100%,0_100%)]" />
      <span className="absolute bottom-0 h-14 w-full bg-[#1e1b4b]" />
      <span className="absolute right-[22%] top-[34%] size-12 rounded-full bg-[#fde68a] shadow-[0_0_30px_#fde68a]" />
      {caption("It was dated fifty years from now.")}
    </div>
  ),
  gameplay: (
    <div className="absolute inset-0 bg-linear-to-b from-[#38bdf8] to-[#a5f3fc]">
      <span className="absolute inset-x-3 top-3 rounded-lg bg-white px-2.5 py-1.5 text-[0.6875rem] font-semibold text-[#0f172a]">
        Everyone told me to skip the jump…
      </span>
      <span className="mk-ground absolute bottom-0 h-8 w-[200%] border-t-[6px] border-[#16a34a] bg-[repeating-linear-gradient(90deg,#92400e_0_24px,#78350f_24px_48px)]" />
      <span className="mk-hop absolute bottom-8 left-[30%] size-7 rounded-md border-[3px] border-[#2e1065] bg-(--accent)" />
      <span className="mk-block absolute bottom-8 size-6 border-[3px] border-[#7c2d12] bg-[#f59e0b]" />
    </div>
  ),
  explainer: (
    <div className="absolute inset-0 grid place-items-center bg-[radial-gradient(80%_70%_at_50%_40%,#0c2a4a,#06121f)]">
      <div className="relative size-28">
        <span className="absolute inset-0 rounded-full border border-dashed border-white/15" />
        <span className="absolute inset-6 rounded-full bg-[radial-gradient(circle_at_35%_30%,#4ade80_0_18%,transparent_19%),radial-gradient(circle_at_40%_40%,#3b82f6,#1e3a8a)] shadow-[0_0_30px_#3b82f680]" />
        <span className="mk-orbit absolute inset-0">
          <span className="absolute -top-2 left-1/2 size-4 -translate-x-1/2 rounded-full bg-[#e5e7eb]" />
        </span>
      </div>
      {caption("Its gravity pulls on the oceans.")}
    </div>
  ),
  forum: (
    <div className="absolute inset-0 bg-[#111827] p-3">
      <div className="rounded-lg bg-white p-3 text-[#0f172a]">
        <div className="flex items-center gap-2 text-[0.6875rem] font-semibold text-[#64748b]">
          <span className="size-4 rounded-full bg-[#f97316]" />
          Story time · posted 4h ago
        </div>
        <p className="mt-1.5 text-[0.8125rem] font-bold leading-snug">
          I accidentally became my town&apos;s weather forecaster
        </p>
        <div className="mt-2 space-y-1">
          <span className="block h-1.5 w-full rounded bg-[#e2e8f0]" />
          <span className="block h-1.5 w-4/5 rounded bg-[#e2e8f0]" />
        </div>
      </div>
      {caption("It started with one lucky guess.")}
    </div>
  ),
  chat: (
    <div className="absolute inset-0 bg-[#0b0b10] px-4 py-3">
      <div className="mk-seq flex flex-col gap-1.5 text-[0.75rem]">
        <span className="w-fit rounded-2xl rounded-bl-sm bg-[#27272a] px-3 py-1.5 text-white">
          Fern: the window is open
        </span>
        <span className="ml-auto w-fit rounded-2xl rounded-br-sm bg-(--accent) px-3 py-1.5 text-white">
          Cactus: finally. we move at dawn
        </span>
        <span className="w-fit rounded-2xl rounded-bl-sm bg-[#27272a] px-3 py-1.5 text-white">
          Ivy: I can&apos;t walk
        </span>
        <span className="mk-type-dots ml-auto w-fit rounded-2xl bg-(--accent) px-3 py-2 text-white">
          <i />
          <i />
          <i />
        </span>
      </div>
    </div>
  ),
  product: (
    <div className="absolute inset-0 grid place-items-center bg-[radial-gradient(100%_80%_at_50%_30%,#fde7d2,#c2410c)]">
      <div className="mk-float relative h-24 w-16">
        <span className="absolute -left-1 top-0 h-4 w-[72px] rounded-md bg-[#1f2937]" />
        <span className="absolute left-0 top-3.5 h-20 w-16 bg-linear-to-r from-[#0f766e] via-[#14b8a6] to-[#0f766e] [clip-path:polygon(0_0,100%_0,88%_100%,12%_100%)]" />
        <span className="absolute left-1.5 top-10 flex h-5 w-[52px] items-center justify-center bg-white text-[0.5625rem] font-black tracking-widest text-[#0f766e]">
          LOOP
        </span>
      </div>
      <span className="absolute inset-x-3 bottom-3 text-center text-[0.875rem] font-extrabold text-[#1c0f06]">
        Leak-proof. Actually.
      </span>
    </div>
  ),
  clips: (
    <div className="absolute inset-0 flex flex-col justify-center gap-3 bg-[#111115] px-4">
      <div className="flex justify-between text-[0.625rem] font-semibold tracking-widest text-(--muted)">
        <span>EP 48 · 01:12:40</span>
        <span className="text-(--accent-hover)">3 EXCERPTS</span>
      </div>
      <div className="flex h-14 items-center gap-[3px]">
        {Array.from({ length: 40 }, (_, i) => {
          const h = 20 + ((i * 37) % 70);
          const hot =
            (i >= 8 && i <= 13) || (i >= 22 && i <= 26) || (i >= 32 && i <= 35);
          return (
            <span
              key={i}
              className={
                hot
                  ? "mk-eq-bar w-full rounded-sm bg-(--accent-hover)"
                  : "w-full rounded-sm bg-white/15"
              }
              style={{ height: `${h}%`, animationDelay: `${-(i % 7) * 0.13}s` }}
            />
          );
        })}
      </div>
      <div className="flex gap-1.5 text-[0.625rem] font-semibold">
        <span className="rounded bg-(--accent)/25 px-1.5 py-0.5 text-[#ddd6fe]">
          08:14–08:52
        </span>
        <span className="rounded bg-(--accent)/25 px-1.5 py-0.5 text-[#ddd6fe]">
          31:02–31:40
        </span>
        <span className="rounded bg-(--accent)/25 px-1.5 py-0.5 text-[#ddd6fe]">
          57:21–57:55
        </span>
      </div>
    </div>
  ),
};
