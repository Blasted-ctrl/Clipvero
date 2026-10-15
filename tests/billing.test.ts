import { test, after } from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import Stripe from "stripe";
process.env.DATA_DIR = mkdtempSync(join(tmpdir(), "clipvero-billing-test-"));
process.env.STRIPE_WEBHOOK_SECRET = "whsec_test_only_fixture";
process.env.STRIPE_PRICE_CREATOR = "price_creator_fixture";
const { db, one, run } = await import("../src/server/db");
const { register } = await import("../src/server/auth");
const { handleWebhook } = await import("../src/server/billing");
const user = register(
  "billing@example.test",
  "Billing Test",
  "a private fixture password",
);
const workspace = one<{ id: string }>(
  "SELECT id FROM workspaces WHERE owner_id=?",
  user,
)!.id;
run(
  "UPDATE workspaces SET stripe_customer_id='cus_fixture' WHERE id=?",
  workspace,
);
let currentStatus = "active";
const stripe = new Stripe("sk_test_fixture_not_a_real_key", {
  httpClient: Stripe.createFetchHttpClient(async () =>
    Response.json({
      id: "sub_fixture",
      object: "subscription",
      customer: "cus_fixture",
      status: currentStatus,
      items: { data: [{ price: { id: "price_creator_fixture" } }] },
    }),
  ),
});
function event(id: string, type = "invoice.paid", invoice = "in_fixture") {
  const raw = JSON.stringify({
    id,
    object: "event",
    type,
    data: {
      object: type.startsWith("invoice.")
        ? {
            id: invoice,
            parent: { subscription_details: { subscription: "sub_fixture" } },
            billing_reason: "subscription_cycle",
          }
        : { id: "sub_fixture", status: "active" },
    },
  });
  return {
    raw,
    signature: stripe.webhooks.generateTestHeaderString({
      payload: raw,
      secret: process.env.STRIPE_WEBHOOK_SECRET!,
    }),
  };
}
after(() => {
  db.close();
  rmSync(process.env.DATA_DIR!, { recursive: true, force: true });
});
test("signed invoice replays grant one allowance even with different event IDs", async () => {
  const paid = event("evt_paid_fixture");
  await handleWebhook(paid.raw, paid.signature, stripe);
  await handleWebhook(paid.raw, paid.signature, stripe);
  const duplicateInvoice = event("evt_other_id_same_invoice");
  await handleWebhook(duplicateInvoice.raw, duplicateInvoice.signature, stripe);
  assert.equal(
    one<{ credits: number }>(
      "SELECT credits FROM workspaces WHERE id=?",
      workspace,
    )!.credits,
    520,
  );
  assert.equal(
    one<{ count: number }>(
      "SELECT COUNT(*) AS count FROM credit_ledger WHERE operation='grant'",
    )!.count,
    1,
  );
});
test("forged signatures cannot grant credits and stale events reconcile current subscription state", async () => {
  const forged = event("evt_forged");
  await assert.rejects(
    () => handleWebhook(forged.raw, "invalid", stripe),
    /signature is invalid/,
  );
  currentStatus = "past_due";
  const stale = event("evt_old_active_state", "customer.subscription.updated");
  await handleWebhook(stale.raw, stale.signature, stripe);
  assert.equal(
    one<{ subscription_status: string }>(
      "SELECT subscription_status FROM workspaces WHERE id=?",
      workspace,
    )!.subscription_status,
    "past_due",
  );
  assert.equal(
    one<{ credits: number }>(
      "SELECT credits FROM workspaces WHERE id=?",
      workspace,
    )!.credits,
    520,
  );
});
