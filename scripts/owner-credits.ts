import { one, run, transaction } from "../src/server/db";

// Usage: pnpm owner:credits [amount]   (default 1,000,000)
// Adds credits to the private pilot owner's workspace. It is recorded in the
// ledger as an 'adjustment' like any other movement, so history stays auditable.
const email = process.env.PILOT_OWNER_EMAIL?.trim().toLowerCase();
const amount = Number(process.argv[2] ?? 1_000_000);
if (!Number.isInteger(amount) || amount < 1 || amount > 10_000_000)
  throw new Error("Choose a whole number of credits from 1 to 10,000,000.");
const workspace = one<{ id: string; credits: number }>(
  "SELECT w.id,w.credits FROM workspaces w JOIN users u ON u.id=w.owner_id WHERE lower(u.email)=?",
  email ?? "",
);
if (!workspace)
  throw new Error(
    "Set PILOT_OWNER_EMAIL to your Clipvero account email in .env.",
  );
transaction(() => {
  run(
    "UPDATE workspaces SET credits=credits+? WHERE id=?",
    amount,
    workspace.id,
  );
  run(
    "INSERT INTO credit_ledger VALUES (?,?,NULL,'adjustment',?,?,?,?)",
    crypto.randomUUID(),
    workspace.id,
    amount,
    "Owner top-up",
    `owner-top-up:${crypto.randomUUID()}`,
    Date.now(),
  );
});
const after = one<{ credits: number }>(
  "SELECT credits FROM workspaces WHERE id=?",
  workspace.id,
)!;
console.log(
  `Added ${amount.toLocaleString()} credits. Balance: ${after.credits.toLocaleString()}.`,
);
