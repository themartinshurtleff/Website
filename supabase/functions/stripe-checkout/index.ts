// Authenticated Stripe Checkout for TradeNet public and founding plans.
// All eligibility, capacity, and Price selection is server-owned.

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { bearer, corsHeaders, envFlag, json } from "../_shared/http.ts";
import {
  stripeRequest,
  StripeRequestError,
  validateRecurringPrice,
} from "../_shared/stripe.ts";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL") || "";
const SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || "";
const STRIPE_SECRET_KEY = Deno.env.get("STRIPE_SECRET_KEY") || "";
const SITE_URL = (Deno.env.get("SITE_URL") || "https://tradenet.org").replace(/\/+$/, "");
const CHECKOUT_ENABLED = envFlag("STRIPE_CHECKOUT_ENABLED", false);
const PUBLIC_CHECKOUT_ENABLED = envFlag("STRIPE_PUBLIC_CHECKOUT_ENABLED", false);
const EXPECT_LIVE_MODE = envFlag("STRIPE_EXPECT_LIVE_MODE", false);

type PlanKey = "monthly" | "annual";

type CheckoutRecovery = {
  url: string;
  offer: "founding" | "standard";
  reused: true;
  recovery: "checkout_session" | "hosted_invoice";
};

type PlanDefinition = {
  tier: "pro_monthly" | "pro_annual";
  interval: "month" | "year";
  standard: { price: string; amount: number };
  founding: {
    introPrice: string;
    introAmount: number;
    renewalPrice: string;
    renewalAmount: number;
    iterations: number;
  };
};

const PLANS: Record<PlanKey, PlanDefinition> = {
  monthly: {
    tier: "pro_monthly",
    interval: "month",
    standard: {
      price: Deno.env.get("STRIPE_PRICE_MONTHLY") || "",
      amount: 3900,
    },
    founding: {
      introPrice: Deno.env.get("STRIPE_PRICE_FOUNDING_MONTHLY_INTRO") || "",
      introAmount: 1900,
      renewalPrice: Deno.env.get("STRIPE_PRICE_FOUNDING_MONTHLY_RENEWAL") || "",
      renewalAmount: 2900,
      iterations: 3,
    },
  },
  annual: {
    tier: "pro_annual",
    interval: "year",
    standard: {
      price: Deno.env.get("STRIPE_PRICE_ANNUAL") || "",
      amount: 38400,
    },
    founding: {
      introPrice: Deno.env.get("STRIPE_PRICE_FOUNDING_ANNUAL_INTRO") || "",
      introAmount: 19900,
      renewalPrice: Deno.env.get("STRIPE_PRICE_FOUNDING_ANNUAL_RENEWAL") || "",
      renewalAmount: 28400,
      iterations: 1,
    },
  },
};

const svc = createClient(SUPABASE_URL, SERVICE_ROLE_KEY, {
  auth: { persistSession: false, autoRefreshToken: false },
});

class CheckoutError extends Error {
  status: number;
  code: string;

  constructor(code: string, status = 500) {
    super(code);
    this.name = "CheckoutError";
    this.code = code;
    this.status = status;
  }
}

const IDEMPOTENCY_RETRY_DELAYS_MS = [150, 300, 600, 1_200, 1_800, 2_500];

async function stripePostWithConcurrentRetry(
  path: string,
  params: Record<string, string>,
  idempotencyKey: string,
): Promise<any> {
  for (let attempt = 0;; attempt += 1) {
    try {
      return await stripeRequest(
        STRIPE_SECRET_KEY,
        "POST",
        path,
        params,
        idempotencyKey,
      );
    } catch (error) {
      const concurrentRequest = error instanceof StripeRequestError &&
        error.code === "idempotency_key_in_use";
      if (!concurrentRequest) throw error;
      if (attempt >= IDEMPOTENCY_RETRY_DELAYS_MS.length) {
        throw new CheckoutError("checkout_in_progress", 409);
      }
      await new Promise((resolve) =>
        setTimeout(resolve, IDEMPOTENCY_RETRY_DELAYS_MS[attempt])
      );
    }
  }
}

function planFrom(value: unknown): PlanKey | null {
  return value === "monthly" || value === "annual" ? value : null;
}

function asUuid(value: unknown): string | null {
  const text = String(value || "");
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i
    .test(text)
    ? text
    : null;
}

function rpcCode(error: { message?: string } | null): string {
  const message = error?.message || "database_error";
  const known = [
    "founding_checkout_disabled",
    "account_email_required",
    "founding_offer_not_eligible",
    "founding_offer_account_conflict",
    "founding_offer_not_invited",
    "founding_offer_expired",
    "founding_offer_already_redeemed",
    "founding_offer_deadline_too_close",
    "founding_offer_reservation_active",
    "founding_offer_capacity_reached",
  ];
  return known.find((code) => message.includes(code)) || "founding_offer_unavailable";
}

function publicStatusFor(code: string): number {
  if (code === "founding_checkout_disabled") return 503;
  if (code === "founding_offer_capacity_reached") return 409;
  if (code === "founding_offer_already_redeemed") return 409;
  if (code === "founding_offer_reservation_active") return 409;
  if (code.startsWith("founding_offer_")) return 403;
  return 500;
}

async function getUser(req: Request) {
  const token = bearer(req);
  if (!token) throw new CheckoutError("missing_auth", 401);

  const { data, error } = await svc.auth.getUser(token);
  if (error || !data?.user) throw new CheckoutError("invalid_auth", 401);
  return data.user;
}

async function getOfferContext(userId: string): Promise<any> {
  const { data, error } = await svc.rpc("get_founding_offer_context", {
    p_user: userId,
  });
  if (error) throw new CheckoutError("offer_context_failed", 500);
  return data || {};
}

async function reserveFounding(userId: string, plan: PlanKey): Promise<any> {
  const { data, error } = await svc.rpc("reserve_founding_offer", {
    p_user: userId,
    p_plan: plan,
  });
  if (error) {
    const code = rpcCode(error);
    throw new CheckoutError(code, publicStatusFor(code));
  }
  return data;
}

async function releaseReservation(
  userId: string,
  reservationToken: string,
  reason: string,
  throwOnError = false,
): Promise<void> {
  const { error } = await svc.rpc("release_founding_offer_reservation", {
    p_user: userId,
    p_reservation_token: reservationToken,
    p_session_id: null,
    p_reason: reason.slice(0, 500),
  });
  if (error) {
    if (throwOnError) throw new CheckoutError("reservation_release_failed", 500);
    console.error("reservation release failed:", error.message);
  }
}

async function checkoutSessionAlreadyBound(
  userId: string,
  reservationToken: string,
  sessionId: string,
  sessionUrl: string,
): Promise<boolean> {
  const { data, error } = await svc
    .from("founding_offer_eligibility")
    .select("checkout_session_id,checkout_session_url")
    .eq("user_id", userId)
    .eq("reservation_token", reservationToken)
    .eq("state", "reserved")
    .maybeSingle();
  if (error) {
    console.error("reservation bind verification failed:", error.message);
    return false;
  }
  return data?.checkout_session_id === sessionId &&
    data?.checkout_session_url === sessionUrl;
}

async function validatePlanPrices(plan: PlanDefinition, founding: boolean): Promise<void> {
  if (founding) {
    await validateRecurringPrice(STRIPE_SECRET_KEY, plan.founding.introPrice, {
      amount: plan.founding.introAmount,
      interval: plan.interval,
      livemode: EXPECT_LIVE_MODE,
    });
    await validateRecurringPrice(STRIPE_SECRET_KEY, plan.founding.renewalPrice, {
      amount: plan.founding.renewalAmount,
      interval: plan.interval,
      livemode: EXPECT_LIVE_MODE,
    });
    return;
  }

  await validateRecurringPrice(STRIPE_SECRET_KEY, plan.standard.price, {
    amount: plan.standard.amount,
    interval: plan.interval,
    livemode: EXPECT_LIVE_MODE,
  });
}

async function loadProfile(user: { id: string; email?: string | null }) {
  let { data: profile, error } = await svc
    .from("profiles")
    .select(
      "id,stripe_customer_id,stripe_subscription_id,billing_customer_id,billing_provider,billing_status",
    )
    .eq("id", user.id)
    .maybeSingle();

  if (error) throw new CheckoutError("profile_lookup_failed", 500);
  if (profile) return profile;

  const inserted = await svc
    .from("profiles")
    .insert({ id: user.id, email: user.email })
    .select(
      "id,stripe_customer_id,stripe_subscription_id,billing_customer_id,billing_provider,billing_status",
    )
    .single();

  if (inserted.error) throw new CheckoutError("profile_create_failed", 500);
  profile = inserted.data;
  return profile;
}

async function ensureCustomer(
  user: { id: string; email?: string | null },
  profile: any,
): Promise<string> {
  const existing = profile.stripe_customer_id ||
    (profile.billing_provider === "stripe" ? profile.billing_customer_id : null);
  if (existing) return existing;

  const customer = await stripePostWithConcurrentRetry(
    "/v1/customers",
    {
      email: String(user.email),
      "metadata[profile_id]": user.id,
      "metadata[supabase_user_id]": user.id,
    },
    `tradenet-customer-${user.id}`,
  );

  const { error } = await svc.from("profiles").update({
    stripe_customer_id: customer.id,
    billing_provider: "stripe",
    billing_customer_id: customer.id,
  }).eq("id", user.id);
  if (error) throw new CheckoutError("customer_bind_failed", 500);
  return customer.id;
}

function stringId(value: unknown): string | null {
  if (typeof value === "string" && value) return value;
  if (
    value && typeof value === "object" &&
    typeof (value as { id?: unknown }).id === "string"
  ) {
    return (value as { id: string }).id;
  }
  return null;
}

function isMissingStripeResource(error: unknown): boolean {
  return error instanceof StripeRequestError &&
    error.status === 404 &&
    (error.code === "resource_missing" || error.code === null);
}

function checkoutBelongsToUser(session: any, userId: string): boolean {
  const owner = String(
    session?.client_reference_id || session?.metadata?.profile_id || "",
  );
  return owner === userId;
}

async function recoverIncompleteSubscription(
  userId: string,
  subscription: any,
): Promise<CheckoutRecovery | null> {
  const subscriptionId = stringId(subscription?.id);
  if (!subscriptionId) throw new CheckoutError("subscription_lookup_failed", 502);

  const sessions = await stripeRequest(
    STRIPE_SECRET_KEY,
    "GET",
    "/v1/checkout/sessions",
    {
      subscription: subscriptionId,
      limit: "10",
    },
  );
  const openSession = Array.isArray(sessions?.data)
    ? sessions.data.find((session: any) =>
      session?.status === "open" &&
      checkoutBelongsToUser(session, userId) &&
      typeof session?.url === "string" &&
      Number(session?.expires_at || 0) > Math.floor(Date.now() / 1000)
    )
    : null;

  if (openSession) {
    return {
      url: openSession.url,
      offer: openSession?.metadata?.founding_offer === "true"
        ? "founding"
        : "standard",
      reused: true,
      recovery: "checkout_session",
    };
  }

  if (subscription?.metadata?.founding_offer === "true") {
    const reservationToken = asUuid(
      subscription?.metadata?.founding_reservation_token,
    );
    if (!reservationToken) {
      throw new CheckoutError("payment_recovery_unavailable", 409);
    }

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
    await releaseReservation(
      userId,
      reservationToken,
      "founding_incomplete_checkout_closed",
      true,
    );
    return null;
  }

  const invoiceId = stringId(subscription?.latest_invoice);
  if (!invoiceId) throw new CheckoutError("payment_recovery_unavailable", 409);

  const invoice = await stripeRequest(
    STRIPE_SECRET_KEY,
    "GET",
    `/v1/invoices/${encodeURIComponent(invoiceId)}`,
  );
  const invoiceSubscriptionId = stringId(
    invoice?.subscription || invoice?.parent?.subscription_details?.subscription,
  );
  if (
    invoiceSubscriptionId !== subscriptionId ||
    invoice?.status !== "open" ||
    typeof invoice?.hosted_invoice_url !== "string"
  ) {
    throw new CheckoutError("payment_recovery_unavailable", 409);
  }

  return {
    url: invoice.hosted_invoice_url,
    offer: "standard",
    reused: true,
    recovery: "hosted_invoice",
  };
}

async function resolveExistingSubscription(
  userId: string,
  profile: any,
): Promise<CheckoutRecovery | null> {
  const subscriptionId = stringId(profile?.stripe_subscription_id);
  if (!subscriptionId) return null;

  let subscription: any;
  try {
    subscription = await stripeRequest(
      STRIPE_SECRET_KEY,
      "GET",
      `/v1/subscriptions/${encodeURIComponent(subscriptionId)}`,
    );
  } catch (error) {
    if (isMissingStripeResource(error)) return null;
    throw error;
  }

  const owner = String(subscription?.metadata?.profile_id || "");
  const expectedCustomerId = String(
    profile?.stripe_customer_id ||
      (profile?.billing_provider === "stripe" ? profile?.billing_customer_id : "") ||
      "",
  );
  const actualCustomerId = stringId(subscription?.customer);
  if (
    (owner && owner !== userId) ||
    (expectedCustomerId && actualCustomerId !== expectedCustomerId)
  ) {
    throw new CheckoutError("subscription_ownership_mismatch", 409);
  }

  const status = String(subscription?.status || "");
  if (status === "incomplete") {
    return await recoverIncompleteSubscription(userId, subscription);
  }
  if (status === "canceled" || status === "incomplete_expired") {
    return null;
  }

  throw new CheckoutError("existing_subscription", 409);
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { status: 204, headers: corsHeaders });
  }
  if (req.method !== "POST") return json({ error: "method_not_allowed" }, 405);

  let reservationToken: string | null = null;
  let reservationUserId: string | null = null;
  let reservationOwned = false;

  try {
    if (!CHECKOUT_ENABLED) throw new CheckoutError("checkout_disabled", 503);
    if (!STRIPE_SECRET_KEY || !SERVICE_ROLE_KEY || !SUPABASE_URL) {
      throw new CheckoutError("server_not_configured", 503);
    }

    const user = await getUser(req);
    if (!user.email) throw new CheckoutError("account_email_required", 400);

    const body = await req.json().catch(() => ({}));
    const planKey = planFrom(body?.plan);
    if (!planKey) throw new CheckoutError("unknown_plan", 400);
    const plan = PLANS[planKey];

    const profile = await loadProfile(user);
    const recovery = await resolveExistingSubscription(user.id, profile);
    if (recovery) return json(recovery);

    const offer = await getOfferContext(user.id);
    const founding = offer?.eligible === true &&
      (offer?.state === "invited" || offer?.state === "reserved");

    if (offer?.eligible === true && offer?.state === "eligible") {
      throw new CheckoutError("founding_offer_not_invited", 403);
    }
    if (offer?.state === "account_conflict") {
      throw new CheckoutError("founding_offer_account_conflict", 409);
    }
    if (offer?.state === "redeemed") {
      throw new CheckoutError("founding_offer_already_redeemed", 409);
    }
    if (!founding && !PUBLIC_CHECKOUT_ENABLED) {
      throw new CheckoutError("public_checkout_disabled", 503);
    }

    let reservation: any = null;
    if (founding) {
      reservation = await reserveFounding(user.id, planKey);
      reservationToken = String(reservation?.reservation_token || "");
      reservationUserId = user.id;
      reservationOwned = reservation?.reused !== true;
      if (!asUuid(reservationToken)) {
        throw new CheckoutError("reservation_failed", 500);
      }
      if (reservation?.checkout_session_url) {
        return json({
          url: reservation.checkout_session_url,
          offer: "founding",
          reused: true,
        });
      }
    }

    await validatePlanPrices(plan, founding);
    const customerId = await ensureCustomer(user, profile);
    const selectedPrice = founding
      ? plan.founding.introPrice
      : plan.standard.price;
    const attemptId = founding
      ? reservationToken!
      : asUuid(body?.request_id) || crypto.randomUUID();

    const metadata: Record<string, string> = {
      "metadata[profile_id]": user.id,
      "metadata[plan]": planKey,
      "metadata[subscription_tier]": plan.tier,
      "metadata[founding_offer]": founding ? "true" : "false",
      "subscription_data[metadata][profile_id]": user.id,
      "subscription_data[metadata][plan]": planKey,
      "subscription_data[metadata][subscription_tier]": plan.tier,
      "subscription_data[metadata][founding_offer]": founding ? "true" : "false",
    };

    if (founding) {
      metadata["metadata[founding_reservation_token]"] = reservationToken!;
      metadata["metadata[founding_intro_price]"] = plan.founding.introPrice;
      metadata["metadata[founding_renewal_price]"] = plan.founding.renewalPrice;
      metadata["metadata[founding_iterations]"] = String(plan.founding.iterations);
      metadata["subscription_data[metadata][founding_reservation_token]"] =
        reservationToken!;
      metadata["subscription_data[metadata][founding_intro_price]"] =
        plan.founding.introPrice;
      metadata["subscription_data[metadata][founding_renewal_price]"] =
        plan.founding.renewalPrice;
      metadata["subscription_data[metadata][founding_iterations]"] =
        String(plan.founding.iterations);
    }

    const session = await stripePostWithConcurrentRetry(
      "/v1/checkout/sessions",
      {
        mode: "subscription",
        customer: customerId,
        client_reference_id: user.id,
        success_url: `${SITE_URL}/account?activating=1&session_id={CHECKOUT_SESSION_ID}`,
        cancel_url: `${SITE_URL}/pricing`,
        expires_at: String(Math.floor(Date.now() / 1000) + 31 * 60),
        "line_items[0][price]": selectedPrice,
        "line_items[0][quantity]": "1",
        ...metadata,
      },
      `tradenet-checkout-${attemptId}`,
    );

    if (founding) {
      const { data: bound, error } = await svc.rpc("bind_founding_checkout_session", {
        p_user: user.id,
        p_reservation_token: reservationToken,
        p_session_id: session.id,
        p_session_url: session.url,
      });
      const alreadyBound = (error || bound !== true) &&
        await checkoutSessionAlreadyBound(
          user.id,
          reservationToken!,
          session.id,
          session.url,
        );
      if ((error || bound !== true) && !alreadyBound) {
        try {
          await stripeRequest(
            STRIPE_SECRET_KEY,
            "POST",
            `/v1/checkout/sessions/${encodeURIComponent(session.id)}/expire`,
          );
        } catch (expireError) {
          console.error("failed to expire unbound Stripe session:", expireError);
        }
        throw new CheckoutError("reservation_bind_failed", 500);
      }
    }

    return json({
      url: session.url,
      offer: founding ? "founding" : "standard",
      reused: false,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "unknown_error";

    const preserveActiveReservation = error instanceof CheckoutError &&
      error.code === "checkout_in_progress";
    if (
      reservationToken &&
      reservationUserId &&
      reservationOwned &&
      !preserveActiveReservation
    ) {
      await releaseReservation(reservationUserId, reservationToken, message);
    }

    if (error instanceof CheckoutError) {
      console.error("stripe-checkout:", error.code);
      return json({ error: error.code }, error.status);
    }
    if (error instanceof StripeRequestError) {
      console.error("stripe-checkout Stripe error:", error.status, error.code, error.message);
      return json({ error: "stripe_request_failed" }, 502);
    }

    const publicCode = message === "stripe_price_mismatch" ||
        message === "stripe_price_not_configured"
      ? "stripe_price_configuration_error"
      : "checkout_failed";
    console.error("stripe-checkout:", message);
    return json({ error: publicCode }, 500);
  }
});
