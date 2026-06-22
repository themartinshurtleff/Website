// Supabase Edge Function: stripe-webhook
// Verifies Stripe webhook signatures, records idempotency, and reconciles
// Stripe subscription state into the existing TradeNet entitlement model.

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL") || "";
const SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || "";
const STRIPE_SECRET_KEY = Deno.env.get("STRIPE_SECRET_KEY") || "";
const STRIPE_WEBHOOK_SECRET = Deno.env.get("STRIPE_WEBHOOK_SECRET") || "";
const STRIPE_PRICE_MONTHLY = Deno.env.get("STRIPE_PRICE_MONTHLY") || "";
const STRIPE_PRICE_ANNUAL = Deno.env.get("STRIPE_PRICE_ANNUAL") || "";
const PROVIDER = "stripe";

const svc = createClient(SUPABASE_URL, SERVICE_ROLE_KEY, {
  auth: { persistSession: false, autoRefreshToken: false },
});

function json(body: Record<string, unknown>, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

function bytesToHex(bytes: Uint8Array): string {
  return [...bytes].map((b) => b.toString(16).padStart(2, "0")).join("");
}

function hexToBytes(hex: string): Uint8Array | null {
  if (!/^[a-f0-9]+$/i.test(hex) || hex.length % 2 !== 0) return null;
  const out = new Uint8Array(hex.length / 2);
  for (let i = 0; i < out.length; i++) {
    out[i] = parseInt(hex.slice(i * 2, i * 2 + 2), 16);
  }
  return out;
}

function constantTimeEqual(a: Uint8Array, b: Uint8Array): boolean {
  let diff = a.length ^ b.length;
  const n = Math.max(a.length, b.length);
  for (let i = 0; i < n; i++) diff |= (a[i] ?? 0) ^ (b[i] ?? 0);
  return diff === 0;
}

async function hmacHex(secret: string, payload: string): Promise<string> {
  const key = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
  return bytesToHex(new Uint8Array(await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(payload))));
}

async function verifyStripeSignature(rawBody: string, header: string): Promise<boolean> {
  if (!STRIPE_WEBHOOK_SECRET || !header) return false;

  let timestamp = "";
  const signatures: string[] = [];
  for (const part of header.split(",")) {
    const [key, value] = part.split("=");
    if (key === "t") timestamp = value || "";
    if (key === "v1" && value) signatures.push(value);
  }
  if (!timestamp || signatures.length === 0) return false;

  const age = Math.abs(Math.floor(Date.now() / 1000) - Number(timestamp));
  if (!Number.isFinite(age) || age > 300) return false;

  const expected = hexToBytes(await hmacHex(STRIPE_WEBHOOK_SECRET, `${timestamp}.${rawBody}`));
  if (!expected) return false;

  return signatures.some((sig) => {
    const provided = hexToBytes(sig);
    return provided ? constantTimeEqual(expected, provided) : false;
  });
}

async function stripeGet(path: string): Promise<any> {
  const res = await fetch(`https://api.stripe.com${path}`, {
    headers: { Authorization: `Bearer ${STRIPE_SECRET_KEY}` },
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data?.error?.message || `Stripe ${res.status}`);
  return data;
}

function fromUnix(seconds: unknown): string | null {
  const n = Number(seconds);
  if (!Number.isFinite(n) || n <= 0) return null;
  return new Date(n * 1000).toISOString();
}

function priceIdFromSubscription(subscription: any): string | null {
  return subscription?.items?.data?.[0]?.price?.id || null;
}

function tierFromSubscription(subscription: any): string | null {
  const priceId = priceIdFromSubscription(subscription);
  if (priceId && priceId === STRIPE_PRICE_MONTHLY) return "pro_monthly";
  if (priceId && priceId === STRIPE_PRICE_ANNUAL) return "pro_annual";
  return subscription?.metadata?.subscription_tier || null;
}

function activeBillingStatus(status: string): string {
  return status === "active" || status === "trialing" ? "active" : status;
}

function accessStatusForBilling(status: string): string {
  if (status === "active" || status === "trialing") return "active";
  return "past_due";
}

async function recalc(userId: string): Promise<void> {
  const { error } = await svc.rpc("recalc_entitlements", { p_user: userId });
  if (error) throw new Error(`recalc_entitlements failed: ${error.message}`);
}

async function findProfileId(opts: {
  profileId?: string | null;
  stripeCustomerId?: string | null;
  stripeSubscriptionId?: string | null;
}): Promise<string | null> {
  if (opts.profileId) {
    const { data } = await svc.from("profiles").select("id").eq("id", opts.profileId).maybeSingle();
    if (data?.id) return data.id;
  }
  if (opts.stripeSubscriptionId) {
    const { data } = await svc.from("profiles").select("id")
      .eq("stripe_subscription_id", opts.stripeSubscriptionId)
      .maybeSingle();
    if (data?.id) return data.id;
  }
  if (opts.stripeCustomerId) {
    const { data } = await svc.from("profiles").select("id")
      .eq("stripe_customer_id", opts.stripeCustomerId)
      .maybeSingle();
    if (data?.id) return data.id;
  }
  if (opts.stripeCustomerId) {
    const { data } = await svc.from("profiles").select("id")
      .eq("billing_provider", PROVIDER)
      .eq("billing_customer_id", opts.stripeCustomerId)
      .maybeSingle();
    if (data?.id) return data.id;
  }
  return null;
}

async function upsertSubscription(subscription: any, overrideProfileId?: string | null): Promise<string> {
  const subscriptionId = String(subscription?.id || "");
  const customerId = typeof subscription?.customer === "string"
    ? subscription.customer
    : subscription?.customer?.id;
  const metadataProfileId = subscription?.metadata?.profile_id || overrideProfileId || null;
  const userId = await findProfileId({
    profileId: metadataProfileId,
    stripeCustomerId: customerId,
    stripeSubscriptionId: subscriptionId,
  });

  if (!userId) return "unresolved";

  const status = String(subscription?.status || "active");
  const tier = tierFromSubscription(subscription);
  const update: Record<string, unknown> = {
    billing_provider: PROVIDER,
    billing_status: activeBillingStatus(status),
    access_status: accessStatusForBilling(status),
    access_source: PROVIDER,
    billing_customer_id: customerId,
    stripe_customer_id: customerId,
    stripe_subscription_id: subscriptionId,
  };

  if (tier) update.subscription_tier = tier;
  const start = fromUnix(subscription?.start_date);
  const end = fromUnix(subscription?.current_period_end);
  if (start) update.plan_started_at = start;
  if (end) update.plan_expires_at = end;

  const { error } = await svc.from("profiles").update(update).eq("id", userId);
  if (error) throw new Error(`subscription_update_failed: ${error.message}`);

  await recalc(userId);
  return `subscription_${status}`;
}

async function handleCheckoutCompleted(session: any): Promise<string> {
  const subscriptionId = typeof session?.subscription === "string"
    ? session.subscription
    : session?.subscription?.id;
  if (!subscriptionId) return "checkout_no_subscription";

  const subscription = await stripeGet(`/v1/subscriptions/${subscriptionId}`);
  const profileId = session?.client_reference_id || session?.metadata?.profile_id || null;
  return await upsertSubscription(subscription, profileId);
}

async function handleSubscriptionDeleted(subscription: any): Promise<string> {
  const subscriptionId = String(subscription?.id || "");
  const customerId = typeof subscription?.customer === "string"
    ? subscription.customer
    : subscription?.customer?.id;
  const userId = await findProfileId({
    profileId: subscription?.metadata?.profile_id || null,
    stripeCustomerId: customerId,
    stripeSubscriptionId: subscriptionId,
  });

  if (!userId) return "unresolved";

  const { error } = await svc.from("profiles").update({
    billing_status: "cancelled",
    access_status: "past_due",
    plan_expires_at: fromUnix(subscription?.current_period_end) || fromUnix(subscription?.ended_at) || new Date().toISOString(),
  }).eq("id", userId);
  if (error) throw new Error(`subscription_delete_failed: ${error.message}`);

  await recalc(userId);
  return "subscription_cancelled";
}

async function handleInvoicePaid(invoice: any): Promise<string> {
  const subscriptionId = typeof invoice?.subscription === "string"
    ? invoice.subscription
    : invoice?.subscription?.id;
  if (!subscriptionId) return "invoice_no_subscription";
  const subscription = await stripeGet(`/v1/subscriptions/${subscriptionId}`);
  return await upsertSubscription(subscription, subscription?.metadata?.profile_id || null);
}

async function handleInvoiceFailed(invoice: any): Promise<string> {
  const subscriptionId = typeof invoice?.subscription === "string"
    ? invoice.subscription
    : invoice?.subscription?.id;
  const customerId = typeof invoice?.customer === "string" ? invoice.customer : invoice?.customer?.id;

  const userId = await findProfileId({
    stripeCustomerId: customerId,
    stripeSubscriptionId: subscriptionId,
  });
  if (!userId) return "unresolved";

  const { error } = await svc.from("profiles")
    .update({ access_status: "past_due", billing_status: "past_due" })
    .eq("id", userId);
  if (error) throw new Error(`invoice_failed_update_failed: ${error.message}`);

  await recalc(userId);
  return "past_due";
}

async function handleChargeRefunded(charge: any): Promise<string> {
  let customerId = typeof charge?.customer === "string" ? charge.customer : charge?.customer?.id;
  if (!customerId && typeof charge?.charge === "string") {
    const fullCharge = await stripeGet(`/v1/charges/${charge.charge}`);
    customerId = typeof fullCharge?.customer === "string" ? fullCharge.customer : fullCharge?.customer?.id;
  }
  const userId = await findProfileId({ stripeCustomerId: customerId });
  if (!userId) return "unresolved";

  const { error } = await svc.from("profiles")
    .update({ access_status: "revoked", billing_status: "refunded" })
    .eq("id", userId);
  if (error) throw new Error(`refund_revoke_failed: ${error.message}`);

  await recalc(userId);

  try {
    // @ts-ignore admin API is present on the service-role client.
    await svc.auth.admin.signOut(userId, "global");
  } catch (e) {
    console.error("sign-out-everywhere failed after refund revoke:", e);
  }

  return "revoked";
}

Deno.serve(async (req) => {
  if (req.method !== "POST") return new Response("Method not allowed", { status: 405 });
  if (!STRIPE_SECRET_KEY || !STRIPE_WEBHOOK_SECRET || !SERVICE_ROLE_KEY || !SUPABASE_URL) {
    return json({ error: "server_not_configured" }, 500);
  }

  const rawBody = await req.text();
  const sig = req.headers.get("stripe-signature") || "";
  if (!(await verifyStripeSignature(rawBody, sig))) {
    return new Response("Unauthorized", { status: 401 });
  }

  let event: any;
  try {
    event = JSON.parse(rawBody);
  } catch {
    return json({ status: "bad_json" });
  }

  const eventId = String(event?.id || "");
  const type = String(event?.type || "");
  const object = event?.data?.object;

  if (eventId) {
    const { error } = await svc.from("billing_events").insert({
      provider: PROVIDER,
      provider_event_id: eventId,
      topic: type,
      payload: event,
    });

    if (error) {
      if ((error as any).code === "23505" || /duplicate key/i.test(error.message)) {
        return json({ status: "duplicate_noop" });
      }
      return new Response("DB error", { status: 500 });
    }
  }

  try {
    let status = "ignored_topic";
    switch (type) {
      case "checkout.session.completed":
        status = await handleCheckoutCompleted(object);
        break;
      case "customer.subscription.created":
      case "customer.subscription.updated":
        status = await upsertSubscription(object, object?.metadata?.profile_id || null);
        break;
      case "customer.subscription.deleted":
        status = await handleSubscriptionDeleted(object);
        break;
      case "invoice.paid":
        status = await handleInvoicePaid(object);
        break;
      case "invoice.payment_failed":
        status = await handleInvoiceFailed(object);
        break;
      case "charge.refunded":
      case "charge.dispute.created":
        status = await handleChargeRefunded(object);
        break;
      default:
        console.log(`unhandled Stripe topic: ${type}`);
    }

    return json({ status, type });
  } catch (e) {
    console.error("stripe-webhook handler error:", e);
    if (eventId) {
      await svc.from("billing_events")
        .delete()
        .eq("provider", PROVIDER)
        .eq("provider_event_id", eventId);
    }
    return new Response("Processing error", { status: 500 });
  }
});
