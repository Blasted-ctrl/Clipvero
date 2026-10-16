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
  db.exec(readFileSync(resolve("migrations/004_topic_ideas.sql"), "utf8"));
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
/**
 * Migration 002 limited allowances to 1, 3, 5 or 8 videos in the table itself.
 * SQLite can't drop a CHECK, so the table is rebuilt once (SQLite's documented
 * procedure). The check repeats inside the write lock so concurrent starts
 * rebuild it exactly once, and foreign keys are verified before committing.
 */
const limited = () =>
  db
    .prepare(
      "SELECT sql FROM sqlite_master WHERE type='table' AND name='agent_grants'",
    )
    .get() as { sql: string } | undefined;
if (limited()?.sql.includes("run_limit IN (1,3,5,8)")) {
  db.exec("PRAGMA foreign_keys=OFF");
  try {
    transaction(() => {
      if (!limited()?.sql.includes("run_limit IN (1,3,5,8)")) return;
      db.exec(`CREATE TABLE agent_grants_new (
        id TEXT PRIMARY KEY,
        workspace_id TEXT NOT NULL REFERENCES workspaces(id),
        name TEXT NOT NULL,
        token_hash TEXT NOT NULL UNIQUE,
        run_limit INTEGER NOT NULL CHECK(run_limit BETWEEN 1 AND 500),
        credit_limit INTEGER NOT NULL CHECK(credit_limit > 0),
        runs INTEGER NOT NULL DEFAULT 0,
        spent INTEGER NOT NULL DEFAULT 0,
        policy TEXT NOT NULL,
        expires_at INTEGER NOT NULL,
        revoked_at INTEGER,
        created_at INTEGER NOT NULL
      )`);
      db.exec(
        "INSERT INTO agent_grants_new SELECT id,workspace_id,name,token_hash,run_limit,credit_limit,runs,spent,policy,expires_at,revoked_at,created_at FROM agent_grants",
      );
      db.exec("DROP TABLE agent_grants");
      db.exec("ALTER TABLE agent_grants_new RENAME TO agent_grants");
      db.exec(
        "CREATE INDEX IF NOT EXISTS agent_grants_workspace ON agent_grants(workspace_id,created_at)",
      );
      if (db.prepare("PRAGMA foreign_key_check").all().length)
        throw new Error("Rebuilding agent_grants would break a reference.");
    });
  } finally {
    db.exec("PRAGMA foreign_keys=ON");
  }
}
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
