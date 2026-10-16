import { one } from "../src/server/db";
import { indexIdeas, nextTopics } from "../src/server/topics";

// Usage: pnpm ideas:index [--force]   (indexes ./ideas for the pilot owner's workspace)
const email = process.env.PILOT_OWNER_EMAIL?.trim().toLowerCase();
const workspace = one<{ id: string }>(
  "SELECT w.id FROM workspaces w JOIN users u ON u.id=w.owner_id WHERE lower(u.email)=?",
  email ?? "",
);
if (!workspace)
  throw new Error(
    "Set PILOT_OWNER_EMAIL to your Clipvero account email in .env.",
  );
const { added } = await indexIdeas(workspace.id, {
  force: process.argv.includes("--force"),
  log: (line) => console.log(line),
});
console.log(`Added ${added} topics. Next up:`);
for (const idea of nextTopics(workspace.id, 10))
  console.log(`- [${idea.style}] ${idea.topic} (${idea.source ?? "manual"})`);
