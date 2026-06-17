// Supabase Edge Function: shopify-webhook
// ----------------------------------------------------------------------------
// Hardened per features/auth-access/agent-tasks-2026-06-15 §1.4 / §0.5.8 and
// implementation-plan-2026-06-15 §"Shopify -> Supabase self-running sync".
//
// Security properties:
//   * Constant-time HMAC over the RAW body BEFORE any JSON.parse. Bad HMAC ->
//     401 with zero DB writes.
//   * Idempotent on X-Shopify-Webhook-Id (billing_events unique). Replays no-op.
//   * Product allowlist ONLY -- no "default to pro" fallback. Unknown -> 200, no
//     grant.
//   * Grants bind by note_attributes.profile_id (the authoritative key). An
//     email-only order becomes a pending_entitlements row; it NEVER auto-grants
//     to an existing populated profile (email-takeover defense).
//   * Every profile mutation is followed by recalc_entitlements() (the single
//     authoritative writer). The webhook never writes access_tier/terminal_access
//     /entitlements directly.
//   * Hard revoke (refund/chargeback) -> access_status='revoked' + recalc (which
//     pushes the deny-set row) + auth.admin.signOut(user, 'global').
//
// Subscribe these topics to this function URL (Martin, Shopify Admin):
//   orders/paid, subscription_contracts/update,
//   subscription_billing_attempts/failure, refunds/create, customers/update
//
// Secrets (supabase secrets set ...):
//   SHOPIFY_WEBHOOK_SECRET, SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY
// ----------------------------------------------------------------------------

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const SHOPIFY_SECRET = Deno.env.get("SHOPIFY_WEBHOOK_SECRET") || "";
const SUPABASE_URL = Deno.env.get("SUPABASE_URL") || "";
const SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || "";

// Product allowlist. Both Shopify products map to the SAME 'pro' access tier
// (beta collapse); the only difference is the billing period -> plan_expires_at.
// subscription_tier stays granular (pro_monthly / pro_annual) for reporting.
// selling_plan_id is a secondary check slotted in once it exists (pending
// Shopify Payments approval) -- product_id is the primary key today.
const PRODUCT_ALLOWLIST: Record<string, { subscription_tier: string; period: "month" | "year" }> = {
  "9349798396162": { subscription_tier: "pro_monthly", period: "month" },
  "9349799018754": { subscription_tier: "pro_annual", period: "year" },
};

const PROVIDER = "shopify";

const svc = createClient(SUPABASE_URL, SERVICE_ROLE_KEY, {
  auth: { persistSession: false, autoRefreshToken: false },
});

// ----------------------------------------------------------------------------
// Crypto helpers
// ----------------------------------------------------------------------------
function constantTimeEqual(a: Uint8Array, b: Uint8Array): boolean {
  // Fold any length difference into the accumulator and iterate the full span
  // so there is no content-dependent early return. (Both sides are a 32-byte
  // HMAC in practice, so lengths match anyway.)
  let diff = a.length ^ b.length;
  const n = Math.max(a.length, b.length);
  for (let i = 0; i < n; i++) diff |= (a[i] ?? 0) ^ (b[i] ?? 0);
  return diff === 0;
}

function b64ToBytes(b64: string): Uint8Array | null {
  try {
    const bin = atob(b64);
    const out = new Uint8Array(bin.length);
    for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
    return out;
  } catch {
    return null;
  }
}

async function verifyHmac(rawBody: Uint8Array, hmacHeader: string): Promise<boolean> {
  if (!SHOPIFY_SECRET || !hmacHeader) return false;
  const key = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(SHOPIFY_SECRET),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
  const sig = new Uint8Array(await crypto.subtle.sign("HMAC", key, rawBody));
  const provided = b64ToBytes(hmacHeader);
  if (!provided) return false;
  return constantTimeEqual(sig, provided);
}

// ----------------------------------------------------------------------------
// Small helpers
// ----------------------------------------------------------------------------
function ok(body: Record<string, unknown>): Response {
  return new Response(JSON.stringify(body), {
    status: 200,
    headers: { "Content-Type": "application/json" },
  });
}

function noteAttr(order: any, name: string): string | null {
  const arr = order?.note_attributes;
  if (!Array.isArray(arr)) return null;
  const hit = arr.find((n: any) => n?.name === name);
  return hit?.value ? String(hit.value) : null;
}

// The /cart/add checkout puts profile_id as a line-item property (_profile_id).
function lineItemProp(order: any, name: string): string | null {
  const items = Array.isArray(order?.line_items) ? order.line_items : [];
  for (const it of items) {
    const props = Array.isArray(it?.properties) ? it.properties : [];
    const hit = props.find((p: any) => p?.name === name);
    if (hit?.value) return String(hit.value);
  }
  return null;
}

// profile_id can arrive as a note attribute (old format) or a line-item
// property (current /cart/add format, hidden via the leading underscore).
function resolveProfileId(order: any): string | null {
  return noteAttr(order, "profile_id")
    || lineItemProp(order, "_profile_id")
    || lineItemProp(order, "profile_id");
}

function addPeriod(from: Date, period: "month" | "year"): string {
  const d = new Date(from);
  if (period === "month") d.setUTCMonth(d.getUTCMonth() + 1);
  else d.setUTCFullYear(d.getUTCFullYear() + 1);
  return d.toISOString();
}

// Inspect line items against the allowlist. Returns the matched plan or null.
function matchPlan(order: any): { subscription_tier: string; period: "month" | "year" } | null {
  const items = Array.isArray(order?.line_items) ? order.line_items : [];
  for (const it of items) {
    const pid = it?.product_id != null ? String(it.product_id) : "";
    if (pid && PRODUCT_ALLOWLIST[pid]) return PRODUCT_ALLOWLIST[pid];
  }
  return null;
}

async function recalc(userId: string): Promise<void> {
  const { error } = await svc.rpc("recalc_entitlements", { p_user: userId });
  if (error) throw new Error(`recalc_entitlements failed: ${error.message}`);
}

// Resolve an existing profile by the strongest available key. Email is NOT used
// here -- email-only resolution is the pending path (correction #7).
async function findProfileId(opts: {
  profileId?: string | null;
  shopifyCustomerId?: string | null;
  shopifySubscriptionId?: string | null;
  shopifyOrderId?: string | null;
}): Promise<string | null> {
  if (opts.profileId) {
    const { data } = await svc.from("profiles").select("id").eq("id", opts.profileId).maybeSingle();
    if (data?.id) return data.id;
  }
  if (opts.shopifySubscriptionId) {
    const { data } = await svc.from("profiles").select("id")
      .eq("shopify_subscription_id", opts.shopifySubscriptionId).maybeSingle();
    if (data?.id) return data.id;
  }
  if (opts.shopifyOrderId) {
    const { data } = await svc.from("profiles").select("id")
      .eq("shopify_order_id", opts.shopifyOrderId).maybeSingle();
    if (data?.id) return data.id;
  }
  if (opts.shopifyCustomerId) {
    const { data } = await svc.from("profiles").select("id")
      .eq("shopify_customer_id", opts.shopifyCustomerId).maybeSingle();
    if (data?.id) return data.id;
  }
  return null;
}

// ----------------------------------------------------------------------------
// Topic handlers. Each returns a short status string for the response body.
// They throw ONLY on real DB failure (-> 500). Allowlist misses / unresolved
// users return a handled 200 status string.
// ----------------------------------------------------------------------------

async function handleOrdersPaid(order: any): Promise<string> {
  const plan = matchPlan(order);
  if (!plan) {
    console.log("orders/paid: no allowlisted product, ignoring");
    return "ignored_unknown_product";
  }

  const now = new Date();
  const planExpires = addPeriod(now, plan.period);
  const customerId = order?.customer?.id != null ? String(order.customer.id) : null;
  const subId = order?.subscription_id != null ? String(order.subscription_id)
    : (order?.line_items?.[0]?.selling_plan_allocation?.selling_plan?.id != null
        ? String(order.line_items[0].selling_plan_allocation.selling_plan.id) : null);
  const orderId = order?.id != null ? String(order.id) : null;
  const profileId = resolveProfileId(order);
  const email = order?.customer?.email ? String(order.customer.email) : null;

  const userId = await findProfileId({ profileId });

  if (!userId) {
    // No bound profile. Park as a pending entitlement keyed by normalized email.
    // Never auto-grant to a profile matched by email alone.
    if (!email) {
      console.log("orders/paid: no profile_id and no email; cannot park");
      return "unresolved_no_email";
    }
    const { error } = await svc.from("pending_entitlements").insert({
      email_norm: email.trim().toLowerCase(),
      subscription_tier: plan.subscription_tier,
      billing_provider: PROVIDER,
      billing_status: "active",
      shopify_customer_id: customerId,
      shopify_subscription_id: subId,
      shopify_order_id: orderId,
      plan_started_at: now.toISOString(),
      plan_expires_at: planExpires,
    });
    if (error) throw new Error(`pending insert: ${error.message}`);
    return "parked_pending";
  }

  const { error } = await svc.from("profiles").update({
    subscription_tier: plan.subscription_tier,
    billing_provider: PROVIDER,
    billing_status: "active",
    access_status: "active",
    access_source: "shopify",
    shopify_customer_id: customerId,
    shopify_subscription_id: subId,
    shopify_order_id: orderId,
    plan_started_at: now.toISOString(),
    plan_expires_at: planExpires,
  }).eq("id", userId);
  if (error) throw new Error(`profile update: ${error.message}`);

  await recalc(userId);
  return "granted_pro";
}

async function handleSubscriptionContractUpdate(contract: any): Promise<string> {
  const subId = contract?.admin_graphql_api_id ?? contract?.id;
  const subIdStr = subId != null ? String(subId) : null;
  const customerId = contract?.customer_id != null ? String(contract.customer_id) : null;
  const status = String(contract?.status ?? "").toLowerCase(); // active | cancelled | paused | expired | failed

  const userId = await findProfileId({
    shopifySubscriptionId: subIdStr,
    shopifyCustomerId: customerId,
  });
  if (!userId) return "unresolved";

  // Cancel/pause: keep access until the current period end (read-time clamp
  // downgrades at plan_expires_at). Do NOT clear plan_expires_at here.
  const billingStatus = status === "active" ? "active"
    : status === "paused" ? "paused"
    : status === "cancelled" || status === "expired" ? "cancelled"
    : status;

  const update: Record<string, unknown> = { billing_status: billingStatus };
  // If Shopify gives us a concrete next/last billing boundary, honor it.
  const periodEnd = contract?.next_billing_date ?? contract?.billing_policy?.max_cycles_end ?? null;
  if (periodEnd) update.plan_expires_at = new Date(periodEnd).toISOString();

  const { error } = await svc.from("profiles").update(update).eq("id", userId);
  if (error) throw new Error(`contract update: ${error.message}`);

  await recalc(userId);
  return `contract_${billingStatus}`;
}

async function handleBillingAttemptFailure(attempt: any): Promise<string> {
  const subId = attempt?.subscription_contract_id != null ? String(attempt.subscription_contract_id) : null;
  const customerId = attempt?.customer_id != null ? String(attempt.customer_id) : null;

  const userId = await findProfileId({
    shopifySubscriptionId: subId,
    shopifyCustomerId: customerId,
  });
  if (!userId) return "unresolved";

  // Past due -> free preview (never blank-block a lapsed payer).
  const { error } = await svc.from("profiles")
    .update({ access_status: "past_due", billing_status: "past_due" })
    .eq("id", userId);
  if (error) throw new Error(`past_due update: ${error.message}`);

  await recalc(userId);
  return "past_due";
}

async function handleRefundCreate(refund: any): Promise<string> {
  const orderId = refund?.order_id != null ? String(refund.order_id) : null;
  const customerId = refund?.customer?.id != null ? String(refund.customer.id) : null;

  const userId = await findProfileId({
    shopifyOrderId: orderId,
    shopifyCustomerId: customerId,
  });
  if (!userId) return "unresolved";

  // Hard revoke: status -> revoked, recalc (pushes deny-set row), then revoke
  // the refresh-token family so the renewable credential is cut, not just the
  // entitlements.
  const { error } = await svc.from("profiles")
    .update({ access_status: "revoked", billing_status: "refunded" })
    .eq("id", userId);
  if (error) throw new Error(`revoke update: ${error.message}`);

  await recalc(userId);

  try {
    // @ts-ignore admin API present on the service-role client
    await svc.auth.admin.signOut(userId, "global");
  } catch (e) {
    console.error("sign-out-everywhere failed (entitlement already revoked):", e);
  }
  return "revoked";
}

async function handleCustomersUpdate(customer: any): Promise<string> {
  // Contact fields ONLY, on the already-bound profile, matched by shopify
  // customer id. Never move shopify_customer_id between profiles.
  const customerId = customer?.id != null ? String(customer.id) : null;
  if (!customerId) return "unresolved";
  const userId = await findProfileId({ shopifyCustomerId: customerId });
  if (!userId) return "unresolved";

  const update: Record<string, unknown> = {};
  if (customer?.email) update.email = String(customer.email);
  if (Object.keys(update).length === 0) return "noop";

  const { error } = await svc.from("profiles").update(update).eq("id", userId);
  if (error) throw new Error(`customers/update: ${error.message}`);
  // Spec: always recalc after a mutation (no-op for entitlements on a contact
  // change, but keeps the audit trail + version monotonic).
  await recalc(userId);
  return "contact_updated";
}

// ----------------------------------------------------------------------------
// Entry point
// ----------------------------------------------------------------------------
Deno.serve(async (req) => {
  if (req.method !== "POST") return new Response("Method not allowed", { status: 405 });

  // RAW bytes for HMAC -- must verify before parsing anything.
  const raw = new Uint8Array(await req.arrayBuffer());
  const hmac = req.headers.get("x-shopify-hmac-sha256") || "";

  if (!(await verifyHmac(raw, hmac))) {
    return new Response("Unauthorized", { status: 401 }); // zero writes
  }

  const topic = (req.headers.get("x-shopify-topic") || "").toLowerCase();
  const eventId = req.headers.get("x-shopify-webhook-id") || "";

  let payload: any;
  try {
    payload = JSON.parse(new TextDecoder().decode(raw));
  } catch {
    // Authenticated but unparseable -> handled, no retry storm.
    return ok({ status: "bad_json" });
  }

  // Idempotency: first writer for this event id wins; replays no-op.
  if (eventId) {
    const { error: insErr } = await svc.from("billing_events").insert({
      provider: PROVIDER,
      provider_event_id: eventId,
      topic,
      payload,
    });
    if (insErr) {
      // Unique violation => already processed.
      if ((insErr as any).code === "23505" || /duplicate key/i.test(insErr.message)) {
        return ok({ status: "duplicate_noop" });
      }
      // Real DB failure -> let Shopify retry.
      return new Response("DB error", { status: 500 });
    }
  }

  try {
    let status = "ignored_topic";
    switch (topic) {
      case "orders/paid":
        status = await handleOrdersPaid(payload); break;
      case "subscription_contracts/update":
        status = await handleSubscriptionContractUpdate(payload); break;
      case "subscription_billing_attempts/failure":
        status = await handleBillingAttemptFailure(payload); break;
      case "refunds/create":
        status = await handleRefundCreate(payload); break;
      case "customers/update":
        status = await handleCustomersUpdate(payload); break;
      default:
        console.log(`unhandled topic: ${topic}`);
    }
    return ok({ status, topic });
  } catch (e) {
    console.error("handler error:", e);
    // The idempotency row was claimed BEFORE the handler ran. If the handler
    // failed partway (e.g. profile mutated but recalc threw), a Shopify retry
    // would otherwise hit duplicate_noop and skip reprocessing, leaving the
    // mutation half-applied (a refund/revoke would not push the deny-set row
    // until the 15-min cron). Release the claim so the retry reprocesses
    // cleanly and converges.
    if (eventId) {
      await svc.from("billing_events")
        .delete()
        .eq("provider", PROVIDER)
        .eq("provider_event_id", eventId);
    }
    return new Response("Processing error", { status: 500 }); // Shopify retries
  }
});
