import Stripe from "stripe";
import { all, one, run, transaction } from "./db";
import { AppError, requireValue } from "./errors";
import { appUrl, type Identity } from "./auth";
import { plans } from "../lib/model";

export function stripeClient() {
  if (!process.env.STRIPE_SECRET_KEY)
    throw new AppError(
      503,
      "Billing is not configured. Set the Stripe secret, webhook signing secret, and monthly price IDs on the server.",
    );
  return new Stripe(process.env.STRIPE_SECRET_KEY);
}
function priceId(plan: string) {
  const price = process.env[`STRIPE_PRICE_${plan.toUpperCase()}`];
  if (!price || !(plan in plans))
    throw new AppError(503, "This subscription price is not configured yet.");
  return price;
}
export async function checkout(me: Identity, plan: string) {
  const stripe = stripeClient(),
    price = priceId(plan);
  const workspace = requireValue(
    one<{
      stripe_customer_id: string | null;
      stripe_subscription_id: string | null;
    }>(
      "SELECT stripe_customer_id,stripe_subscription_id FROM workspaces WHERE id=?",
      me.workspaceId,
    ),
  );
  if (workspace.stripe_subscription_id)
    throw new AppError(
      409,
      "Manage your existing subscription in the billing portal.",
    );
  let customer = workspace.stripe_customer_id;
  if (!customer) {
    const created = await stripe.customers.create(
      {
        email: me.email,
        name: me.name,
        metadata: { workspaceId: me.workspaceId },
      },
      { idempotencyKey: `workspace-customer:${me.workspaceId}` },
    );
    customer = created.id;
    run(
      "UPDATE workspaces SET stripe_customer_id=? WHERE id=?",
      customer,
      me.workspaceId,
    );
  }
  const session = await stripe.checkout.sessions.create({
    customer,
    mode: "subscription",
    line_items: [{ price, quantity: 1 }],
    client_reference_id: me.workspaceId,
    subscription_data: { metadata: { workspaceId: me.workspaceId } },
    success_url: `${appUrl()}/billing?checkout=returned`,
    cancel_url: `${appUrl()}/billing`,
  });
  return { url: session.url };
}
export async function portal(me: Identity) {
  const stripe = stripeClient();
  const customer = one<{ stripe_customer_id: string | null }>(
    "SELECT stripe_customer_id FROM workspaces WHERE id=?",
    me.workspaceId,
  )?.stripe_customer_id;
  if (!customer)
    throw new AppError(
      409,
      "Start a subscription before opening the billing portal.",
    );
  return stripe.billingPortal.sessions.create({
    customer,
    return_url: `${appUrl()}/billing`,
  });
}
export async function handleWebhook(
  raw: string,
  signature: string,
  stripe: Stripe = stripeClient(),
) {
  if (!process.env.STRIPE_WEBHOOK_SECRET)
    throw new AppError(503, "Stripe webhooks are not configured.");
  let event: Stripe.Event;
  try {
    event = stripe.webhooks.constructEvent(
      raw,
      signature,
      process.env.STRIPE_WEBHOOK_SECRET,
    );
  } catch {
    throw new AppError(400, "Webhook signature is invalid.");
  }
  if (one("SELECT id FROM webhook_events WHERE id=?", event.id)) return;
  const object = event.data.object as unknown as {
    id: string;
    customer?: string;
    subscription?: string;
    parent?: { subscription_details?: { subscription?: string } };
    billing_reason?: string;
  };
  const subId = event.type.startsWith("customer.subscription.")
    ? object.id
    : object.subscription || object.parent?.subscription_details?.subscription;
  if (
    !subId ||
    ![
      "invoice.paid",
      "invoice.payment_failed",
      "customer.subscription.updated",
      "customer.subscription.created",
      "customer.subscription.deleted",
    ].includes(event.type)
  )
    return;
  const subscription = await stripe.subscriptions.retrieve(subId);
  const customer =
    typeof subscription.customer === "string"
      ? subscription.customer
      : subscription.customer.id;
  const workspace = one<{ id: string }>(
    "SELECT id FROM workspaces WHERE stripe_customer_id=?",
    customer,
  );
  if (!workspace)
    throw new AppError(
      409,
      "Subscription customer is not linked to a workspace. Reconcile customer metadata before replaying this webhook.",
    );
  const price = subscription.items.data[0]?.price.id;
  const plan = Object.keys(plans).find(
    (p) => process.env[`STRIPE_PRICE_${p.toUpperCase()}`] === price,
  ) as keyof typeof plans | undefined;
  if (!plan)
    throw new AppError(400, "Subscription contains an unrecognized price.");
  transaction(() => {
    if (one("SELECT id FROM webhook_events WHERE id=?", event.id)) return;
    run(
      "UPDATE workspaces SET plan=?,subscription_status=?,stripe_subscription_id=? WHERE id=?",
      plan,
      subscription.status,
      ["canceled", "incomplete_expired"].includes(subscription.status)
        ? null
        : subscription.id,
      workspace.id,
    );
    if (
      event.type === "invoice.paid" &&
      ["subscription_create", "subscription_cycle"].includes(
        object.billing_reason || "",
      )
    ) {
      const key = `invoice:${object.id}`;
      if (!one("SELECT id FROM credit_ledger WHERE idempotency_key=?", key)) {
        run(
          "UPDATE workspaces SET credits=credits+? WHERE id=?",
          plans[plan].credits,
          workspace.id,
        );
        run(
          "INSERT INTO credit_ledger VALUES (?,?,NULL,'grant',?,?,?,?)",
          crypto.randomUUID(),
          workspace.id,
          plans[plan].credits,
          `Paid ${plan} monthly allowance`,
          key,
          Date.now(),
        );
      }
    }
    run(
      "INSERT INTO webhook_events VALUES (?,?,?)",
      event.id,
      event.type,
      Date.now(),
    );
  });
}
export function billingHistory(workspace: string) {
  return all(
    "SELECT operation,amount,detail,created_at AS createdAt FROM credit_ledger WHERE workspace_id=? ORDER BY created_at DESC LIMIT 100",
    workspace,
  );
}
