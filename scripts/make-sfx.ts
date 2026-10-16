import { mkdirSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { binary, execute } from "../src/server/media";

// Usage: pnpm sfx:make
// Synthesises Clipvero's original sound-effect pack into public/sfx. Every sound is
// generated from maths (oscillators and filtered noise), so the pack is ours: no
// licences, no downloads, and the same result every run.
const RATE = 44100;
const out = resolve("public/sfx");
mkdirSync(out, { recursive: true });

let seed = 20261016;
/** Deterministic noise in [-1, 1]. */
const noise = () => {
  seed = (seed * 1664525 + 1013904223) >>> 0;
  return (seed / 2 ** 32) * 2 - 1;
};
const make = (seconds: number, fill: (t: number, i: number) => number) => {
  const samples = new Float32Array(Math.round(seconds * RATE));
  for (let i = 0; i < samples.length; i++) samples[i] = fill(i / RATE, i);
  return samples;
};
/** One-pole lowpass whose cutoff may change over time. */
const sweepFilter = (cutoff: (t: number) => number) => {
  let y = 0;
  return (x: number, t: number) => {
    y += (1 - Math.exp((-2 * Math.PI * cutoff(t)) / RATE)) * (x - y);
    return y;
  };
};
const highpass = (hz: number) => {
  let low = 0;
  return (x: number) => {
    low += (1 - Math.exp((-2 * Math.PI * hz) / RATE)) * (x - low);
    return x - low;
  };
};
const tone = (hz: number, t: number) => Math.sin(2 * Math.PI * hz * t);

/** Windy sweep for scene changes: noise whose brightness rises and falls. */
function whoosh(seconds: number, peakHz: number) {
  const filter = sweepFilter(
    (t) => 250 + peakHz * Math.sin((Math.PI * t) / seconds) ** 2,
  );
  const rumble = highpass(140);
  return make(
    seconds,
    (t) =>
      rumble(filter(noise(), t)) *
      Math.sin((Math.PI * t) / seconds) ** 1.4 *
      2.2,
  );
}

const sounds: Record<string, Float32Array> = {
  // Transitions between scenes and visuals.
  whoosh: whoosh(0.55, 5500),
  swish: whoosh(0.24, 8500),
  // Something new appears.
  pop: (() => {
    let phase = 0;
    return make(0.14, (t) => {
      phase += (2 * Math.PI * (180 + 520 * Math.exp(-t * 40))) / RATE;
      return Math.sin(phase) * Math.exp(-t * 26) * (t < 0.002 ? t / 0.002 : 1);
    });
  })(),
  // A value or highlight stepped forward.
  tick: make(
    0.06,
    (t) =>
      (tone(2400, t) * Math.exp(-t * 110) +
        noise() * Math.exp(-t * 320) * 0.35) *
      0.9,
  ),
  // A short bright blip for small updates.
  blip: make(0.1, (t) => {
    const hz = 880 + 440 * (t / 0.1);
    const envelope = Math.min(1, t / 0.008) * Math.min(1, (0.1 - t) / 0.03);
    return Math.tanh(tone(hz, t) * 2.2) * envelope * 0.55;
  }),
  // Success: a match was found, a step landed.
  ding: make(0.9, (t) => {
    const envelope = Math.min(1, t / 0.003) * Math.exp(-t * 5.2);
    return (
      (tone(1318.5, t) + 0.5 * tone(1975.5, t) + 0.22 * tone(2637, t)) *
      envelope *
      0.55
    );
  }),
  chime: make(0.95, (t) => {
    let sum = 0;
    [1046.5, 1318.5, 1568].forEach((hz, k) => {
      const dt = t - k * 0.09;
      if (dt >= 0)
        sum +=
          (tone(hz, dt) + 0.35 * tone(hz * 2, dt)) *
          Math.min(1, dt / 0.003) *
          Math.exp(-dt * 6);
    });
    return sum * 0.4;
  }),
  // Impact for emphasis.
  thud: (() => {
    const body = sweepFilter(() => 260);
    return make(
      0.4,
      (t) =>
        tone(45 + 80 * Math.exp(-t * 18), t) * Math.exp(-t * 9) +
        body(noise(), t) * Math.exp(-t * 40) * 0.5,
    );
  })(),
  // Warning or an error state.
  buzz: make(0.3, (t) => {
    const envelope = Math.min(1, t / 0.01) * Math.min(1, (0.3 - t) / 0.05);
    return Math.tanh((tone(150, t) + tone(157, t)) * 2.5) * envelope * 0.4;
  }),
  // Rising lead-in for an opening or a big reveal.
  riser: (() => {
    const filter = sweepFilter((t) => 200 * Math.exp(Math.log(35) * (t / 1)));
    return make(
      1,
      (t) =>
        (filter(noise(), t) * 1.6 + 0.25 * tone(200 + 1000 * t * t, t)) *
        t ** 2,
    );
  })(),
  // Magic or highlight: a spray of short high notes.
  sparkle: (() => {
    const notes = Array.from({ length: 12 }, () => ({
      at: Math.abs(noise()) * 0.33,
      hz: 2500 + Math.abs(noise()) * 4000,
    }));
    return make(0.65, (t) => {
      let sum = 0;
      for (const n of notes) {
        const dt = t - n.at;
        if (dt >= 0)
          sum += tone(n.hz, dt) * Math.exp(-dt * 18) * Math.min(1, dt / 0.002);
      }
      return sum * 0.22;
    });
  })(),
};

function wav(samples: Float32Array) {
  // Normalise to a consistent loudness and avoid clicks at the end.
  const peak = samples.reduce((max, v) => Math.max(max, Math.abs(v)), 0.0001);
  const fade = Math.round(0.006 * RATE);
  const data = Buffer.alloc(samples.length * 2);
  samples.forEach((v, i) => {
    const tail = Math.min(1, (samples.length - i) / fade);
    data.writeInt16LE(Math.round((v / peak) * 0.85 * tail * 32767), i * 2);
  });
  const header = Buffer.alloc(44);
  header.write("RIFF", 0);
  header.writeUInt32LE(36 + data.length, 4);
  header.write("WAVEfmt ", 8);
  header.writeUInt32LE(16, 16);
  header.writeUInt16LE(1, 20);
  header.writeUInt16LE(1, 22);
  header.writeUInt32LE(RATE, 24);
  header.writeUInt32LE(RATE * 2, 28);
  header.writeUInt16LE(2, 32);
  header.writeUInt16LE(16, 34);
  header.write("data", 36);
  header.writeUInt32LE(data.length, 40);
  return Buffer.concat([header, data]);
}

for (const [name, samples] of Object.entries(sounds)) {
  const raw = join(tmpdir(), `clipvero-sfx-${name}.wav`);
  writeFileSync(raw, wav(samples));
  await execute(binary("ffmpeg"), [
    "-v",
    "error",
    "-y",
    "-i",
    raw,
    "-ac",
    "1",
    "-b:a",
    "128k",
    join(out, `${name}.mp3`),
  ]);
  rmSync(raw, { force: true });
  console.log(`${name.padEnd(8)} ${(samples.length / RATE).toFixed(2)}s`);
}
console.log(`Wrote ${Object.keys(sounds).length} sounds to ${out}`);
