import { existsSync, lstatSync, readFileSync, realpathSync } from "node:fs";
import { resolve } from "node:path";

export function urlVerification(filename: string, head = false) {
  if (!/^[a-zA-Z0-9_-]{1,180}\.txt$/.test(filename)) return null;
  const root = resolve(".local-services/tiktok-verification"),
    path = resolve(root, filename);
  if (!existsSync(root) || realpathSync(root) !== root || !existsSync(path))
    return null;
  const info = lstatSync(path);
  if (!info.isFile() || info.isSymbolicLink() || info.size > 4096) return null;
  return new Response(head ? null : readFileSync(path, "utf8"), {
    headers: {
      "Content-Type": "text/plain; charset=utf-8",
      "Cache-Control": "no-store",
      "X-Content-Type-Options": "nosniff",
    },
  });
}
