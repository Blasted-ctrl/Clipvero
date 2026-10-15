import "./setup-env";
import { readFileSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";
import { parseEnv } from "node:util";
import { z } from "zod";
import { DatabaseSync } from "node:sqlite";

const path = resolve(".env");
let content = readFileSync(path, "utf8");
const values = parseEnv(content);
const required = ["NGROK_AUTHTOKEN", "NGROK_DOMAIN", "PILOT_OWNER_EMAIL"];
for (const key of [...required, "APP_URL"]) {
  if (
    (
      content.match(
        new RegExp(`^[ \\t]*(?:export[ \\t]+)?${key}[ \\t]*=`, "gm"),
      ) ?? []
    ).length > 1
  )
    throw new Error(`Remove duplicate ${key} entries before pilot setup.`);
}
const absent = required.filter((key) => values[key] === undefined);
if (absent.length)
  content += `\n# Personal HTTPS run. Keep the tunnel token private.\n${absent.map((key) => `${key}=`).join("\n")}\n`;
const missing = required.filter((key) => !values[key]?.trim());
if (!missing.length) {
  const host = values.NGROK_DOMAIN!.trim();
  if (
    !/^(?=.{1,253}$)[a-zA-Z0-9](?:[a-zA-Z0-9.-]*[a-zA-Z0-9])$/.test(host) ||
    !host.includes(".")
  )
    throw new Error(
      "NGROK_DOMAIN must be the assigned hostname, without https://, a path or a port.",
    );
  const owner = z.email().safeParse(values.PILOT_OWNER_EMAIL!.trim());
  if (!owner.success)
    throw new Error(
      "PILOT_OWNER_EMAIL must be your existing Clipvero account email.",
    );
  const db = new DatabaseSync(
    resolve(values.DATA_DIR || "data", "clipvero.db"),
    { readOnly: true },
  );
  try {
    if (
      !db
        .prepare("SELECT id FROM users WHERE lower(email)=?")
        .get(owner.data.toLowerCase())
    )
      throw new Error(
        "Create your Clipvero account locally before enabling the private tunnel.",
      );
  } finally {
    db.close();
  }
  const line = /^[ \t]*(?:export[ \t]+)?APP_URL[ \t]*=.*$/m;
  content = line.test(content)
    ? content.replace(line, () => `APP_URL=https://${host.toLowerCase()}`)
    : `${content}\nAPP_URL=https://${host.toLowerCase()}\n`;
}
writeFileSync(path, content, { mode: 0o600 });
console.log(
  missing.length
    ? `Fill ${missing.join(", ")} in .env, then rerun pnpm pilot:setup.`
    : "Private tunnel settings are ready. Run pnpm pilot.",
);
