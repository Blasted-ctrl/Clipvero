import { randomBytes } from "node:crypto";
import { chmodSync, existsSync, readFileSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";
import { parseEnv } from "node:util";

const path = resolve(".env");
const existing = existsSync(path);
let content = readFileSync(existing ? path : resolve(".env.example"), "utf8");
const values = parseEnv(content);
const generated: string[] = [];

for (const key of ["SESSION_SECRET", "POSTGRES_PASSWORD", "DATABASE_URL"]) {
  const matches = content.match(
    new RegExp(`^[ \\t]*(?:export[ \\t]+)?${key}[ \\t]*=`, "gm"),
  );
  if (matches && matches.length > 1)
    throw new Error(`Remove duplicate ${key} entries from .env before setup.`);
  if (/[\r\n]/.test(values[key] || ""))
    throw new Error(`${key} must be on one line in .env.`);
}

function set(key: string, value: string) {
  const line = new RegExp(`^[ \\t]*(?:export[ \\t]+)?${key}[ \\t]*=.*$`, "m");
  if (line.test(content))
    content = content.replace(line, () => `${key}=${value}`);
  else content += `${content.endsWith("\n") ? "" : "\n"}${key}=${value}\n`;
  values[key] = value;
}

for (const key of ["SESSION_SECRET", "POSTGRES_PASSWORD"]) {
  if (values[key]?.trim()) continue;
  set(key, randomBytes(32).toString("hex"));
  generated.push(key);
}

const password = values.POSTGRES_PASSWORD;
if (!password) throw new Error("POSTGRES_PASSWORD could not be initialized.");
if (
  !values.DATABASE_URL?.trim() ||
  values.DATABASE_URL ===
    "postgresql+psycopg://clipvero:replace-me@127.0.0.1:55432/clipvero"
)
  set(
    "DATABASE_URL",
    `postgresql+psycopg://clipvero:${encodeURIComponent(password)}@127.0.0.1:55432/clipvero`,
  );

writeFileSync(path, content, { mode: 0o600, flag: existing ? "w" : "wx" });
if (process.platform !== "win32") chmodSync(path, 0o600);
console.log(existing ? "Updated .env." : "Created .env.");
console.log(
  generated.length
    ? `Generated ${generated.join(" and ")}. Existing settings were preserved.`
    : "Existing secrets and settings were preserved.",
);
console.log("See README.md for OpenAI, Stripe, storage and hosting setup.");
