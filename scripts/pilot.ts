import { spawn, spawnSync, type ChildProcess } from "node:child_process";
import { createRequire } from "node:module";
import { existsSync, mkdirSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";
import { createServer } from "node:net";
import { setTimeout } from "node:timers/promises";
import { DatabaseSync } from "node:sqlite";
import { z } from "zod";

const require = createRequire(import.meta.url);
const children: ChildProcess[] = [];
let stopping = false;
function stop() {
  if (stopping) return;
  stopping = true;
  for (const child of children.toReversed()) {
    if (child.exitCode !== null || !child.pid) continue;
    if (process.platform === "win32")
      spawnSync("taskkill", ["/PID", String(child.pid), "/T", "/F"], {
        stdio: "ignore",
        windowsHide: true,
      });
    else child.kill("SIGTERM");
  }
}
function launch(command: string, args: string[], tunnel = false) {
  const child = spawn(command, args, {
    env: process.env,
    stdio: tunnel ? ["ignore", "pipe", "pipe"] : "inherit",
    windowsHide: true,
  });
  children.push(child);
  if (tunnel) {
    const codes = new Set<string>();
    const report = (chunk: Buffer) => {
      for (const code of chunk.toString().match(/ERR_NGROK_\d+/g) ?? [])
        if (!codes.has(code)) {
          codes.add(code);
          console.error(
            `ngrok reported ${code}. Check your token, assigned domain and account limits.`,
          );
        }
    };
    child.stdout?.on("data", report);
    child.stderr?.on("data", report);
  }
  child.on("error", () => {
    console.error(
      `Could not start ${tunnel ? "ngrok" : "a Clipvero process"}. Check its installation.`,
    );
    process.exitCode = 1;
    stop();
  });
  child.on("exit", (code) => {
    if (!stopping) {
      console.error(
        `${tunnel ? "Tunnel" : "Clipvero process"} stopped (${code ?? "signal"}).`,
      );
      process.exitCode = 1;
      stop();
    }
  });
  return child;
}
async function freePort() {
  await new Promise<void>((resolveResult, reject) => {
    const server = createServer();
    server.once("error", () =>
      reject(
        new Error(
          "Port 3000 is in use. Stop the local studio before running pnpm pilot.",
        ),
      ),
    );
    server.listen(3000, "127.0.0.1", () => server.close(() => resolveResult()));
  });
}
async function waitFor(url: string, external = false) {
  for (let i = 0; i < 60 && !stopping; i++) {
    try {
      const response = await fetch(url, {
        redirect: "error",
        signal: AbortSignal.timeout(3000),
        headers: { Accept: "application/json" },
      });
      if (
        response.ok &&
        (!external ||
          (response.headers.get("content-type")?.includes("application/json") &&
            Object.hasOwn(await response.json(), "user")))
      )
        return;
    } catch {}
    await setTimeout(1000);
  }
  throw new Error(
    external
      ? "The public tunnel did not reach Clipvero. Check the assigned hostname and ngrok account."
      : "The local website did not become ready.",
  );
}
async function main() {
  const domain = process.env.NGROK_DOMAIN?.trim();
  if (
    !domain ||
    !process.env.NGROK_AUTHTOKEN?.trim() ||
    !z.email().safeParse(process.env.PILOT_OWNER_EMAIL?.trim()).success
  )
    throw new Error(
      "Fill NGROK_DOMAIN, NGROK_AUTHTOKEN and PILOT_OWNER_EMAIL in .env, then run pnpm pilot:setup.",
    );
  const origin = new URL(process.env.APP_URL || "");
  if (
    origin.protocol !== "https:" ||
    origin.hostname !== domain.toLowerCase() ||
    origin.origin !== process.env.APP_URL ||
    origin.port
  )
    throw new Error(
      "Run pnpm pilot:setup to set APP_URL to the exact HTTPS ngrok origin.",
    );
  if (
    (process.env.CLIPVERO_BACKEND || "legacy") !== "legacy" ||
    !process.env.SESSION_SECRET ||
    process.env.SESSION_SECRET.length < 32
  )
    throw new Error(
      "The personal run needs CLIPVERO_BACKEND=legacy and a stable SESSION_SECRET. Run pnpm setup:env first.",
    );
  const db = new DatabaseSync(
    resolve(process.env.DATA_DIR || "data", "clipvero.db"),
    { readOnly: true },
  );
  try {
    if (
      !db
        .prepare("SELECT id FROM users WHERE lower(email)=?")
        .get(process.env.PILOT_OWNER_EMAIL!.trim().toLowerCase())
    )
      throw new Error(
        "Create your Clipvero account locally first. The tunnel requires an existing owner account.",
      );
  } finally {
    db.close();
  }
  await freePort();
  const ngrok =
    process.env.NGROK_BIN ||
    (process.platform === "win32" && existsSync(".tools/ngrok/ngrok.exe")
      ? resolve(".tools/ngrok/ngrok.exe")
      : "ngrok");
  const installed = spawnSync(ngrok, ["version"], {
    stdio: "ignore",
    windowsHide: true,
  });
  if (installed.status !== 0)
    throw new Error(
      "Install ngrok from https://ngrok.com/download, or set NGROK_BIN to its executable path.",
    );
  mkdirSync(".local-services", { recursive: true });
  mkdirSync(".local-services/tiktok-verification", { recursive: true });
  const config = resolve(".local-services/ngrok-pilot.yml");
  writeFileSync(
    config,
    "version: 3\nagent:\n  web_addr: false\n  console_ui: false\n  remote_management: false\n",
    { mode: 0o600 },
  );
  const checked = spawnSync(ngrok, ["config", "check", "--config", config], {
    stdio: "ignore",
    windowsHide: true,
  });
  if (checked.status !== 0)
    throw new Error(
      "The installed ngrok agent could not read the generated v3 configuration.",
    );
  console.log("Building Clipvero for your private run…");
  const build = spawn(
    process.execPath,
    [require.resolve("next/dist/bin/next"), "build"],
    { stdio: "inherit", windowsHide: true },
  );
  children.push(build);
  const buildCode = await new Promise<number | null>(
    (resolveResult, reject) => {
      build.on("exit", resolveResult);
      build.on("error", reject);
    },
  );
  if (buildCode !== 0 || stopping)
    throw new Error("The build did not finish. No public tunnel was opened.");
  launch(process.execPath, [
    require.resolve("next/dist/bin/next"),
    "start",
    "--hostname",
    "127.0.0.1",
    "--port",
    "3000",
  ]);
  await waitFor("http://127.0.0.1:3000/api/auth/session");
  if (stopping) return;
  launch(process.execPath, [
    "--import",
    import.meta.resolve("tsx"),
    resolve("src/worker/main.ts"),
  ]);
  launch(process.execPath, [
    "--import",
    import.meta.resolve("tsx"),
    resolve("scripts/publisher.ts"),
  ]);
  launch(
    ngrok,
    [
      "http",
      "http://127.0.0.1:3000",
      "--url",
      origin.origin,
      "--config",
      config,
      "--inspect=false",
      "--log",
      "stdout",
      "--log-format",
      "json",
      "--log-level",
      "warn",
    ],
    true,
  );
  await waitFor(`${origin.origin}/api/auth/session`, true);
  console.log(`Clipvero is ready at ${origin.origin}/automation`);
  console.log(
    `Instagram redirect: ${origin.origin}/api/social/callback/instagram`,
  );
  console.log(`TikTok redirect: ${origin.origin}/api/social/callback/tiktok`);
  console.log(`TikTok media URL prefix: ${origin.origin}/api/social/media/`);
  console.log(
    "Keep this process and your computer awake. Ctrl+C stops the tunnel and its workers. Public registration is closed.",
  );
}
process.on("SIGINT", stop);
process.on("SIGTERM", stop);
process.on("exit", stop);
main().catch((error) => {
  console.error(
    error instanceof Error ? error.message : "The private run could not start.",
  );
  process.exitCode = 1;
  stop();
});
