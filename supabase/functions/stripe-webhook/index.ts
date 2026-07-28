// Stripe webhook reconciliation for TradeNet billing and founding schedules.

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { json } from "../_shared/http.ts";
import { stripeRequest } from "../_shared/stripe.ts";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL") || "";
const SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || "";
const STRIPE_SECRET_KEY = Deno.env.get("STRIPE_SECRET_KEY") || "";
const STRIPE_WEBHOOK_SECRET = Deno.env.get("STRIPE_WEBHOOK_SECRET") || "";
const PROVIDER = "stripe";

type PlanKey = "monthly" | "annual";

const PRICE_CONFIG: Record<PlanKey, {
  tier: "pro_monthly" | "pro_annual";
  standard: string;
  intro: string;
  renewal: string;
  introIterations: number;
}> = {
  monthly: {
    tier: "pro_monthly",
    standard: Deno.env.get("STRIPE_PRICE_MONTHLY") || "",
    intro: Deno.env.get("STRIPE_PRICE_FOUNDING_MONTHLY_INTRO") || "",
    renewal: Deno.env.get("STRIPE_PRICE_FOUNDING_MONTHLY_RENEWAL") || "",
    introIterations: 3,
  },
  annual: {
    tier: "pro_annual",
    standard: Deno.env.get("STRIPE_PRICE_ANNUAL") || "",
    intro: Deno.env.get("STRIPE_PRICE_FOUNDING_ANNUAL_INTRO") || "",
    renewal: Deno.env.get("STRIPE_PRICE_FOUNDING_ANNUAL_RENEWAL") || "",
    introIterations: 1,
  },
};

const svc = createClient(SUPABASE_URL, SERVICE_ROLE_KEY, {
  auth: { persistSession: false, autoRefreshToken: false },
});

function bytesToHex(bytes: Uint8Array): string {
  return [...bytes].map((byte) => byte.toString(16).padStart(2, "0")).join("");
}

function hexToBytes(hex: string): Uint8Array | null {
  if (!/^[a-f0-9]+$/i.test(hex) || hex.length % 2 !== 0) return null;
  const output = new Uint8Array(hex.length / 2);
  for (let index = 0; index < output.length; index++) {
    output[index] = parseInt(hex.slice(index * 2, index * 2 + 2), 16);
  }
  return output;
}

function constantTimeEqual(a: Uint8Array, b: Uint8Array): boolean {
  let difference = a.length ^ b.length;
  const length = Math.max(a.length, b.length);
  for (let index = 0; index < length; index++) {
    difference |= (a[index] ?? 0) ^ (b[index] ?? 0);
  }
  return difference === 0;
}

async function hmacHex(secret: string, payload: string): Promise<string> {
  const key = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
  const signature = await crypto.subtle.sign(
    "HMAC",
    key,
    new TextEncoder().encode(payload),
  );
  return bytesToHex(new Uint8Array(signature));
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

  const expected = hexToBytes(
    await hmacHex(STRIPE_WEBHOOK_SECRET, `${timestamp}.${rawBody}`),
  );
  if (!expected) return false;

  return signatures.some((signature) => {
    const provided = hexToBytes(signature);
    return provided ? constantTimeEqual(expected, provided) : false;
  });
}

function stringId(value: any): string | null {
  if (typeof value === "string") return value;
  if (value && typeof value.id === "string") return value.id;
  return null;
}

function fromUnix(seconds: unknown): string | null {
  const value = Number(seconds);
  if (!Number.isFinite(value) || value <= 0) return null;
  return new Date(value * 1000).toISOString();
}

function subscriptionPriceId(subscription: any): string | null {
  return subscription?.items?.data?.[0]?.price?.id || null;
}

function planFromSubscription(subscription: any): PlanKey | null {
  const metadataPlan = subscription?.metadata?.plan;
  if (metadataPlan === "monthly" || metadataPlan === "annual") return metadataPlan;

  const priceId = subscriptionPriceId(subscription);
  for (const [plan, prices] of Object.entries(PRICE_CONFIG)) {
    if ([prices.standard, prices.intro, prices.renewal].includes(priceId || "")) {
      return plan as PlanKey;
    }
  }
  return null;
}

function tierFromSubscription(subscription: any): string | null {
  const plan = planFromSubscription(subscription);
  if (plan) return PRICE_CONFIG[plan].tier;
  return subscription?.metadata?.subscription_tier || null;
}

function isFoundingSubscription(subscription: any): boolean {
  return subscription?.metadata?.founding_offer === "true";
}

function activeBillingStatus(status: string): string {
  return status === "active" || status === "trialing" ? "active" : status;
}

function accessStatusForBilling(status: string): string {
  return status === "active" || status === "trialing" ? "active" : "past_due";
}

async function fetchSubscription(subscriptionId: string): Promise<any> {
  return await stripeRequest(
    STRIPE_SECRET_KEY,
    "GET",
    `/v1/subscriptions/${encodeURIComponent(subscriptionId)}`,
    { "expand[]": "schedule" },
  );
}

async function fetchSchedule(scheduleId: string): Promise<any> {
  return await stripeRequest(
    STRIPE_SECRET_KEY,
    "GET",
    `/v1/subscription_schedules/${encodeURIComponent(scheduleId)}`,
  );
}

function scheduleHasFoundingPhases(
  schedule: any,
  introPrice: string,
  renewalPrice: string,
): boolean {
  if (schedule?.metadata?.tradenet_founding !== "true") return false;
  const phasePrices = (schedule?.phases || []).flatMap((phase: any) =>
    (phase?.items || []).map((item: any) => stringId(item?.price || item?.plan))
  );
  return phasePrices.includes(introPrice) && phasePrices.includes(renewalPrice);
}

async function ensureFoundingSchedule(subscription: any): Promise<string> {
  const subscriptionId = String(subscription?.id || "");
  const planKey = planFromSubscription(subscription);
  if (!subscriptionId || !planKey || !isFoundingSubscription(subscription)) {
    throw new Error("invalid_founding_subscription");
  }

  const config = PRICE_CONFIG[planKey];
  if (!config.intro || !config.renewal) {
    throw new Error("founding_prices_not_configured");
  }

  const currentPrice = subscriptionPriceId(subscription);
  if (currentPrice !== config.intro && currentPrice !== config.renewal) {
    throw new Error("founding_subscription_price_mismatch");
  }

  let scheduleId = stringId(subscription?.schedule);
  let schedule = scheduleId ? await fetchSchedule(scheduleId) : null;

  if (schedule && scheduleHasFoundingPhases(schedule, config.intro, config.renewal)) {
    return schedule.id;
  }

  if (!schedule) {
    schedule = await stripeRequest(
      STRIPE_SECRET_KEY,
      "POST",
      "/v1/subscription_schedules",
      { from_subscription: subscriptionId },
      `tradenet-founding-schedule-${subscriptionId}`,
    );
    scheduleId = schedule.id;
  }

  const firstPhaseStart = Number(
    schedule?.current_phase?.start ||
      schedule?.phases?.[0]?.start_date ||
      subscription?.start_date,
  );
  if (!Number.isFinite(firstPhaseStart) || firstPhaseStart <= 0) {
    throw new Error("founding_schedule_start_missing");
  }

  const profileId = String(subscription?.metadata?.profile_id || "");
  const reservationToken = String(
    subscription?.metadata?.founding_reservation_token || "",
  );

  const configured = await stripeRequest(
    STRIPE_SECRET_KEY,
    "POST",
    `/v1/subscription_schedules/${encodeURIComponent(scheduleId!)}`,
    {
      end_behavior: "release",
      proration_behavior: "none",
      "metadata[tradenet_founding]": "true",
      "metadata[profile_id]": profileId,
      "metadata[plan]": planKey,
      "metadata[reservation_token]": reservationToken,
      "phases[0][start_date]": String(firstPhaseStart),
      "phases[0][items][0][price]": config.intro,
      "phases[0][items][0][quantity]": "1",
      "phases[0][iterations]": String(config.introIterations),
      "phases[0][proration_behavior]": "none",
      "phases[0][metadata][profile_id]": profileId,
      "phases[0][metadata][plan]": planKey,
      "phases[0][metadata][founding_offer]": "true",
      "phases[0][metadata][founding_phase]": "intro",
      "phases[1][items][0][price]": config.renewal,
      "phases[1][items][0][quantity]": "1",
      "phases[1][iterations]": "1",
      "phases[1][proration_behavior]": "none",
      "phases[1][metadata][profile_id]": profileId,
      "phases[1][metadata][plan]": planKey,
      "phases[1][metadata][founding_offer]": "true",
      "phases[1][metadata][founding_phase]": "renewal",
    },
    `tradenet-configure-founding-${subscriptionId}-v1`,
  );

  if (!scheduleHasFoundingPhases(configured, config.intro, config.renewal)) {
    throw new Error("founding_schedule_verification_failed");
  }
  return configured.id;
}

async function findProfileId(options: {
  profileId?: string | null;
  stripeCustomerId?: string | null;
  stripeSubscriptionId?: string | null;
}): Promise<string | null> {
  if (options.profileId) {
    const { data } = await svc.from("profiles").select("id")
      .eq("id", options.profileId).maybeSingle();
    if (data?.id) return data.id;
  }
  if (options.stripeSubscriptionId) {
    const { data } = await svc.from("profiles").select("id")
      .eq("stripe_subscription_id", options.stripeSubscriptionId)
      .maybeSingle();
    if (data?.id) return data.id;
  }
  if (options.stripeCustomerId) {
    const { data } = await svc.from("profiles").select("id")
      .eq("stripe_customer_id", options.stripeCustomerId)
      .maybeSingle();
    if (data?.id) return data.id;
  }
  if (options.stripeCustomerId) {
    const { data } = await svc.from("profiles").select("id")
      .eq("billing_provider", PROVIDER)
      .eq("billing_customer_id", options.stripeCustomerId)
      .maybeSingle();
    if (data?.id) return data.id;
  }
  return null;
}

async function upsertSubscription(
  subscription: any,
  overrideProfileId?: string | null,
): Promise<string> {
  const subscriptionId = String(subscription?.id || "");
  const customerId = stringId(subscription?.customer);
  const metadataProfileId = subscription?.metadata?.profile_id ||
    overrideProfileId ||
    null;
  const userId = await findProfileId({
    profileId: metadataProfileId,
    stripeCustomerId: customerId,
    stripeSubscriptionId: subscriptionId,
  });

  if (!userId) return "unresolved";

  const status = String(subscription?.status || "active");
  const tier = tierFromSubscription(subscription);
  const start = fromUnix(subscription?.start_date);
  const end = fromUnix(subscription?.current_period_end);
  const created = fromUnix(subscription?.created);
  const mayClearRevocation = status === "active" || status === "trialing";

  const { data, error } = await svc.rpc("apply_stripe_billing_state", {
    p_user: userId,
    p_subscription_id: subscriptionId || null,
    p_subscription_created_at: created,
    p_customer_id: customerId,
    p_subscription_tier: tier,
    p_billing_status: activeBillingStatus(status),
    p_access_status: accessStatusForBilling(status),
    p_plan_started_at: start,
    p_plan_expires_at: end,
    p_may_clear_revocation: mayClearRevocation,
  });
  if (error) throw new Error(`subscription_update_failed: ${error.message}`);

  if (data === "applied") return `subscription_${status}`;
  if (data === "revoked_event_ignored") {
    return `subscription_${status}_ignored_after_revocation`;
  }
  return `subscription_${status}_${String(data || "ignored")}`;
}

async function foundingRowForSubscription(subscription: any): Promise<any | null> {
  const profileId = String(subscription?.metadata?.profile_id || "");
  const reservationToken = String(
    subscription?.metadata?.founding_reservation_token || "",
  );
  if (!profileId || !reservationToken) return null;

  const { data, error } = await svc.from("founding_offer_eligibility")
    .select("user_id,state,reservation_token,checkout_session_id")
    .eq("user_id", profileId)
    .eq("reservation_token", reservationToken)
    .maybeSingle();
  if (error) throw new Error(`founding_row_lookup_failed: ${error.message}`);
  return data;
}

async function reconcileFoundingPurchase(
  subscription: any,
  explicitSessionId?: string | null,
): Promise<string | null> {
  if (!isFoundingSubscription(subscription)) return null;

  const row = await foundingRowForSubscription(subscription);
  if (!row) throw new Error("founding_reservation_not_found");
  if (row.state === "redeemed") return null;

  const profileId = String(subscription?.metadata?.profile_id || "");
  const reservationToken = String(
    subscription?.metadata?.founding_reservation_token || "",
  );
  const sessionId = explicitSessionId || row.checkout_session_id;
  if (!sessionId) throw new Error("founding_checkout_session_missing");

  const scheduleId = await ensureFoundingSchedule(subscription);
  const { data, error } = await svc.rpc("redeem_founding_offer", {
    p_user: profileId,
    p_reservation_token: reservationToken,
    p_session_id: sessionId,
    p_customer_id: stringId(subscription?.customer),
    p_subscription_id: String(subscription?.id || ""),
    p_schedule_id: scheduleId,
  });
  if (error) throw new Error(`founding_redemption_failed: ${error.message}`);
  return `founding_${data}`;
}

async function handleCheckoutCompleted(session: any): Promise<string> {
  const subscriptionId = stringId(session?.subscription);
  if (!subscriptionId) return "checkout_no_subscription";

  const subscription = await fetchSubscription(subscriptionId);
  await reconcileFoundingPurchase(subscription, String(session?.id || ""));
  return await upsertSubscription(
    subscription,
    session?.client_reference_id || session?.metadata?.profile_id || null,
  );
}

async function handleCheckoutExpired(session: any): Promise<string> {
  if (session?.metadata?.founding_offer !== "true") return "checkout_expired_standard";

  const userId = String(
    session?.client_reference_id || session?.metadata?.profile_id || "",
  );
  const reservationToken = String(
    session?.metadata?.founding_reservation_token || "",
  );
  if (!userId || !reservationToken) return "checkout_expired_unresolved";

  const subscriptionId = stringId(session?.subscription);
  if (subscriptionId) {
    const subscription = await fetchSubscription(subscriptionId);
    const status = String(subscription?.status || "");
    if (status === "incomplete") {
      await stripeRequest(
        STRIPE_SECRET_KEY,
        "DELETE",
        `/v1/subscriptions/${encodeURIComponent(subscriptionId)}`,
        {
          invoice_now: "false",
          prorate: "false",
        },
        `tradenet-expire-incomplete-${subscriptionId}`,
      );
    } else if (status !== "canceled" && status !== "incomplete_expired") {
      return `founding_expiration_ignored_for_${status || "unknown"}_subscription`;
    }
  }

  const { data, error } = await svc.rpc("release_founding_offer_reservation", {
    p_user: userId,
    p_reservation_token: reservationToken,
    p_session_id: String(session?.id || ""),
    p_reason: "checkout_session_expired",
  });
  if (error) throw new Error(`reservation_release_failed: ${error.message}`);
  return data === true ? "founding_reservation_released" : "reservation_noop";
}

async function handleSubscriptionChanged(subscriptionObject: any): Promise<string> {
  const subscriptionId = String(subscriptionObject?.id || "");
  if (!subscriptionId) return "subscription_missing_id";

  const subscription = await fetchSubscription(subscriptionId);
  if (
    isFoundingSubscription(subscription) &&
    (subscription.status === "active" || subscription.status === "trialing")
  ) {
    await reconcileFoundingPurchase(subscription);
  }
  return await upsertSubscription(
    subscription,
    subscription?.metadata?.profile_id || null,
  );
}

async function handleSubscriptionDeleted(subscription: any): Promise<string> {
  const subscriptionId = String(subscription?.id || "");
  const customerId = stringId(subscription?.customer);
  const userId = await findProfileId({
    profileId: subscription?.metadata?.profile_id || null,
    stripeCustomerId: customerId,
    stripeSubscriptionId: subscriptionId,
  });
  if (!userId) return "unresolved";

  const { data, error } = await svc.rpc("apply_stripe_billing_state", {
    p_user: userId,
    p_subscription_id: subscriptionId || null,
    p_subscription_created_at: fromUnix(subscription?.created),
    p_customer_id: customerId,
    p_subscription_tier: tierFromSubscription(subscription),
    p_billing_status: "cancelled",
    p_access_status: "past_due",
    p_plan_started_at: fromUnix(subscription?.start_date),
    p_plan_expires_at: fromUnix(subscription?.current_period_end) ||
      fromUnix(subscription?.ended_at) ||
      new Date().toISOString(),
    p_may_clear_revocation: false,
  });
  if (error) throw new Error(`subscription_delete_failed: ${error.message}`);

  if (data === "applied") return "subscription_cancelled";
  if (data === "revoked_event_ignored") {
    return "subscription_cancelled_ignored_after_revocation";
  }
  return `subscription_cancelled_${String(data || "ignored")}`;
}

async function handleInvoicePaid(invoice: any): Promise<string> {
  const subscriptionId = stringId(
    invoice?.subscription || invoice?.parent?.subscription_details?.subscription,
  );
  if (!subscriptionId) return "invoice_no_subscription";
  const subscription = await fetchSubscription(subscriptionId);
  if (isFoundingSubscription(subscription)) {
    await reconcileFoundingPurchase(subscription);
  }
  return await upsertSubscription(
    subscription,
    subscription?.metadata?.profile_id || null,
  );
}

async function handleInvoiceFailed(invoice: any): Promise<string> {
  const subscriptionId = stringId(
    invoice?.subscription || invoice?.parent?.subscription_details?.subscription,
  );
  if (!subscriptionId) return "invoice_no_subscription";

  const subscription = await fetchSubscription(subscriptionId);
  return `payment_failed_${await upsertSubscription(
    subscription,
    subscription?.metadata?.profile_id || null,
  )}`;
}

async function handleHardRevocation(
  chargeOrDispute: any,
  billingStatus: "refunded" | "disputed",
  reason: "stripe_refund" | "stripe_dispute",
): Promise<string> {
  let customerId = stringId(chargeOrDispute?.customer);
  const chargeId = stringId(chargeOrDispute?.charge);
  if (!customerId && chargeId) {
    const charge = await stripeRequest(
      STRIPE_SECRET_KEY,
      "GET",
      `/v1/charges/${encodeURIComponent(chargeId)}`,
    );
    customerId = stringId(charge?.customer);
  }

  const userId = await findProfileId({ stripeCustomerId: customerId });
  if (!userId) return "unresolved";

  const { error } = await svc.rpc("apply_stripe_hard_revocation", {
    p_user: userId,
    p_billing_status: billingStatus,
    p_reason: reason,
  });
  if (error) throw new Error(`refund_revoke_failed: ${error.message}`);

  try {
    // @ts-ignore The admin API is available on the service-role client.
    await svc.auth.admin.signOut(userId, "global");
  } catch (error) {
    console.error("sign-out-everywhere failed after hard revoke:", error);
  }
  return reason;
}

Deno.serve(async (req) => {
  if (req.method !== "POST") {
    return new Response("Method not allowed", { status: 405 });
  }
  if (!STRIPE_SECRET_KEY || !STRIPE_WEBHOOK_SECRET || !SERVICE_ROLE_KEY || !SUPABASE_URL) {
    return json({ error: "server_not_configured" }, 503, false);
  }

  const rawBody = await req.text();
  const signature = req.headers.get("stripe-signature") || "";
  if (!(await verifyStripeSignature(rawBody, signature))) {
    return new Response("Unauthorized", { status: 401 });
  }

  let event: any;
  try {
    event = JSON.parse(rawBody);
  } catch {
    return json({ status: "bad_json" }, 400, false);
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
        return json({ status: "duplicate_noop" }, 200, false);
      }
      console.error("billing event insert failed:", error.message);
      return new Response("DB error", { status: 500 });
    }
  }

  try {
    let status = "ignored_topic";
    switch (type) {
      case "checkout.session.completed":
      case "checkout.session.async_payment_succeeded":
        status = await handleCheckoutCompleted(object);
        break;
      case "checkout.session.expired":
      case "checkout.session.async_payment_failed":
        status = await handleCheckoutExpired(object);
        break;
      case "customer.subscription.created":
      case "customer.subscription.updated":
        status = await handleSubscriptionChanged(object);
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
        status = await handleHardRevocation(object, "refunded", "stripe_refund");
        break;
      case "charge.dispute.created":
        status = await handleHardRevocation(object, "disputed", "stripe_dispute");
        break;
      default:
        console.log(`unhandled Stripe topic: ${type}`);
    }

    return json({ status, type }, 200, false);
  } catch (error) {
    console.error("stripe-webhook handler error:", error);
    if (eventId) {
      await svc.from("billing_events")
        .delete()
        .eq("provider", PROVIDER)
        .eq("provider_event_id", eventId);
    }
    return new Response("Processing error", { status: 500 });
  }
});
