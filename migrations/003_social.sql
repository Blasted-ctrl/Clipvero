CREATE TABLE IF NOT EXISTS social_connections (
  id TEXT PRIMARY KEY,
  workspace_id TEXT NOT NULL REFERENCES workspaces(id),
  provider TEXT NOT NULL CHECK(provider IN ('instagram','tiktok')),
  account_id TEXT NOT NULL,
  name TEXT NOT NULL,
  credentials TEXT NOT NULL,
  expires_at INTEGER NOT NULL,
  disconnected_at INTEGER,
  created_at INTEGER NOT NULL,
  refresh_until INTEGER,
  refresh_owner TEXT
);
CREATE INDEX IF NOT EXISTS social_connections_workspace ON social_connections(workspace_id,created_at);
CREATE TABLE IF NOT EXISTS social_oauth_states (
  state_hash TEXT PRIMARY KEY,
  workspace_id TEXT NOT NULL REFERENCES workspaces(id),
  user_id TEXT NOT NULL REFERENCES users(id),
  provider TEXT NOT NULL,
  expires_at INTEGER NOT NULL
);
CREATE TABLE IF NOT EXISTS publications (
  id TEXT PRIMARY KEY,
  workspace_id TEXT NOT NULL REFERENCES workspaces(id),
  grant_id TEXT NOT NULL REFERENCES agent_grants(id),
  job_id TEXT NOT NULL REFERENCES jobs(id),
  connection_id TEXT NOT NULL REFERENCES social_connections(id),
  project_id TEXT NOT NULL REFERENCES projects(id),
  revision INTEGER NOT NULL,
  asset_id TEXT NOT NULL REFERENCES assets(id),
  caption TEXT NOT NULL,
  post_info TEXT,
  state TEXT NOT NULL,
  scheduled_at INTEGER NOT NULL,
  submitted_at INTEGER,
  deadline INTEGER NOT NULL,
  provider_id TEXT,
  post_id TEXT,
  post_url TEXT,
  error TEXT,
  lease_until INTEGER,
  lease_token TEXT,
  next_poll INTEGER NOT NULL DEFAULT 0,
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL,
  UNIQUE(job_id,connection_id)
);
CREATE INDEX IF NOT EXISTS publications_due ON publications(state,next_poll,scheduled_at);
CREATE TABLE IF NOT EXISTS agent_batch_dispatch (
  job_id TEXT PRIMARY KEY REFERENCES jobs(id)
);
INSERT OR IGNORE INTO schema_migrations VALUES (3, unixepoch() * 1000);
