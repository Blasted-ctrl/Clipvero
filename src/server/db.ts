import { DatabaseSync, type SQLInputValue } from "node:sqlite";
import { mkdirSync, readFileSync } from "node:fs";
import { resolve } from "node:path";

export const dataDir = resolve(
  /* turbopackIgnore: true */ process.env.DATA_DIR || "./data",
);
mkdirSync(dataDir, { recursive: true });
mkdirSync(resolve(dataDir, "assets"), { recursive: true });
const globalDb = globalThis as unknown as { clipveroDb?: DatabaseSync };
export const db =
  globalDb.clipveroDb ?? new DatabaseSync(resolve(dataDir, "clipvero.db"));
globalDb.clipveroDb = db;
db.exec(
  "PRAGMA busy_timeout=10000; PRAGMA journal_mode=WAL; PRAGMA foreign_keys=ON;",
);
transaction(() => {
  db.exec(readFileSync(resolve("migrations/001_initial.sql"), "utf8"));
  db.exec(readFileSync(resolve("migrations/002_agent_automation.sql"), "utf8"));
  db.exec(readFileSync(resolve("migrations/003_social.sql"), "utf8"));
  // Databases created by pre-release drafts of 003 lack these lease columns.
  for (const [table, column, type] of [
    ["social_connections", "refresh_until", "INTEGER"],
    ["social_connections", "refresh_owner", "TEXT"],
    ["publications", "lease_token", "TEXT"],
  ] as const) {
    const columns = db.prepare(`PRAGMA table_info(${table})`).all() as {
      name: string;
    }[];
    if (!columns.some((c) => c.name === column))
      db.exec(`ALTER TABLE ${table} ADD COLUMN ${column} ${type}`);
  }
});
export function one<T>(sql: string, ...args: SQLInputValue[]) {
  return db.prepare(sql).get(...args) as T | undefined;
}
export function all<T>(sql: string, ...args: SQLInputValue[]) {
  return db.prepare(sql).all(...args) as T[];
}
export function run(sql: string, ...args: SQLInputValue[]) {
  return db.prepare(sql).run(...args);
}
export function transaction<T>(fn: () => T): T {
  const nested = db.isTransaction;
  const savepoint = `nested_${crypto.randomUUID().replaceAll("-", "")}`;
  db.exec(nested ? `SAVEPOINT ${savepoint}` : "BEGIN IMMEDIATE");
  try {
    const result = fn();
    db.exec(nested ? `RELEASE ${savepoint}` : "COMMIT");
    return result;
  } catch (error) {
    db.exec(nested ? `ROLLBACK TO ${savepoint}` : "ROLLBACK");
    if (nested) db.exec(`RELEASE ${savepoint}`);
    throw error;
  }
}
