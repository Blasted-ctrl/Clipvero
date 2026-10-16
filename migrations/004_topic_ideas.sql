CREATE TABLE IF NOT EXISTS idea_sources (
  id TEXT PRIMARY KEY,
  workspace_id TEXT NOT NULL REFERENCES workspaces(id),
  kind TEXT NOT NULL CHECK(kind IN ('pdf','text','github','web')),
  location TEXT NOT NULL,
  title TEXT NOT NULL,
  indexed_at INTEGER NOT NULL,
  UNIQUE(workspace_id, location)
);
CREATE TABLE IF NOT EXISTS topic_ideas (
  id TEXT PRIMARY KEY,
  workspace_id TEXT NOT NULL REFERENCES workspaces(id),
  source_id TEXT REFERENCES idea_sources(id),
  chapter TEXT,
  topic TEXT NOT NULL,
  angle TEXT NOT NULL DEFAULT '',
  style TEXT NOT NULL DEFAULT 'explainer' CHECK(style IN ('explainer','conversation')),
  status TEXT NOT NULL DEFAULT 'new' CHECK(status IN ('new','used','skipped')),
  job_id TEXT,
  created_at INTEGER NOT NULL,
  used_at INTEGER
);
CREATE INDEX IF NOT EXISTS topic_ideas_queue ON topic_ideas(workspace_id, status, created_at);
INSERT OR IGNORE INTO schema_migrations VALUES (4, unixepoch() * 1000);
