CREATE TABLE IF NOT EXISTS agent_grants (
  id TEXT PRIMARY KEY,
  workspace_id TEXT NOT NULL REFERENCES workspaces(id),
  name TEXT NOT NULL,
  token_hash TEXT NOT NULL UNIQUE,
  run_limit INTEGER NOT NULL CHECK(run_limit IN (1,3,5,8)),
  credit_limit INTEGER NOT NULL CHECK(credit_limit > 0),
  runs INTEGER NOT NULL DEFAULT 0,
  spent INTEGER NOT NULL DEFAULT 0,
  policy TEXT NOT NULL,
  expires_at INTEGER NOT NULL,
  revoked_at INTEGER,
  created_at INTEGER NOT NULL
);
CREATE INDEX IF NOT EXISTS agent_grants_workspace ON agent_grants(workspace_id,created_at);
CREATE TABLE IF NOT EXISTS agent_batches (
  id TEXT PRIMARY KEY,
  workspace_id TEXT NOT NULL REFERENCES workspaces(id),
  grant_id TEXT NOT NULL REFERENCES agent_grants(id),
  request_id TEXT NOT NULL,
  request_hash TEXT NOT NULL,
  created_at INTEGER NOT NULL,
  UNIQUE(grant_id,request_id)
);
CREATE TABLE IF NOT EXISTS agent_batch_items (
  batch_id TEXT NOT NULL REFERENCES agent_batches(id),
  position INTEGER NOT NULL,
  job_id TEXT NOT NULL UNIQUE REFERENCES jobs(id),
  PRIMARY KEY(batch_id,position)
);
INSERT OR IGNORE INTO schema_migrations VALUES (2, unixepoch() * 1000);
