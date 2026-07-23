// Supabase Edge Function: stripe-checkout
// Creates an authenticated Stripe Checkout Session for a logged-in TradeNet user.

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL") || "";
const SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || "";
const STRIPE_SECRET_KEY = Deno.env.get("STRIPE_SECRET_KEY") || "";
const SITE_URL = (Deno.env.get("SITE_URL") || "https://tradenet.org").replace(/\/+$/, "");
const WAITLIST_DISCOUNTS: Record<string, string> = {
  monthly: Deno.env.get("STRIPE_WAITLIST_DISCOUNT_MONTHLY") || "",
  annual: Deno.env.get("STRIPE_WAITLIST_DISCOUNT_ANNUAL") || "",
};

const PLANS: Record<string, { price: string; tier: string; amount: number; interval: string }> = {
  monthly: {
    price: Deno.env.get("STRIPE_PRICE_MONTHLY") || "",
    tier: "pro_monthly",
    amount: 3900,
    interval: "month",
  },
  annual: {
    price: Deno.env.get("STRIPE_PRICE_ANNUAL") || "",
    tier: "pro_annual",
    amount: 38400,
    interval: "year",
  },
};

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const svc = createClient(SUPABASE_URL, SERVICE_ROLE_KEY, {
  auth: { persistSession: false, autoRefreshToken: false },
});

function json(body: Record<string, unknown>, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

function bearer(req: Request): string {
  const header = req.headers.get("authorization") || "";
  return header.toLowerCase().startsWith("bearer ") ? header.slice(7) : "";
}

async function stripePost(path: string, params: Record<string, string>): Promise<any> {
  const res = await fetch(`https://api.stripe.com${path}`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${STRIPE_SECRET_KEY}`,
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body: new URLSearchParams(params),
  });

  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    const message = data?.error?.message || `Stripe ${res.status}`;
    throw new Error(message);
  }
  return data;
}

async function stripeGet(path: string): Promise<any> {
  const res = await fetch(`https://api.stripe.com${path}`, {
    headers: { Authorization: `Bearer ${STRIPE_SECRET_KEY}` },
  });

  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    const message = data?.error?.message || `Stripe ${res.status}`;
    throw new Error(message);
  }
  return data;
}

async function getUser(req: Request) {
  const token = bearer(req);
  if (!token) throw new Error("missing_auth");

  const { data, error } = await svc.auth.getUser(token);
  if (error || !data?.user) throw new Error("invalid_auth");
  return data.user;
}

async function isWaitlistMember(email: string): Promise<boolean> {
  const { data, error } = await svc.rpc("is_waitlist_member", {
    p_email: email,
  });

  if (error) throw new Error(`waitlist_lookup_failed: ${error.message}`);
  return data === true;
}

type StripeDiscount = {
  parameter: "coupon" | "promotion_code";
  value: string;
};

async function resolveDiscount(configuredValue: string): Promise<StripeDiscount> {
  const value = configuredValue.trim();
  if (!value) throw new Error("waitlist_discount_not_configured");

  if (value.startsWith("coupon:")) {
    return { parameter: "coupon", value: value.slice("coupon:".length) };
  }
  if (value.startsWith("promo:")) {
    return { parameter: "promotion_code", value: value.slice("promo:".length) };
  }
  if (value.startsWith("promo_")) {
    return { parameter: "promotion_code", value };
  }
  if (value.startsWith("coupon_")) {
    return { parameter: "coupon", value };
  }

  const query = new URLSearchParams({ code: value, active: "true", limit: "1" });
  const result = await stripeGet(`/v1/promotion_codes?${query.toString()}`);
  const promotionCodeId = result?.data?.[0]?.id;
  if (!promotionCodeId) throw new Error("waitlist_discount_not_found");
  return { parameter: "promotion_code", value: promotionCodeId };
}

async function validateConfiguredPrice(plan: { price: string; amount: number; interval: string }) {
  const price = await stripeGet(`/v1/prices/${encodeURIComponent(plan.price)}`);
  const matches = price?.active === true &&
    price?.currency === "usd" &&
    price?.unit_amount === plan.amount &&
    price?.type === "recurring" &&
    price?.recurring?.interval === plan.interval;

  if (!matches) throw new Error("stripe_price_mismatch");
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { status: 204, headers: corsHeaders });
  if (req.method !== "POST") return json({ error: "method_not_allowed" }, 405);

  try {
    if (!STRIPE_SECRET_KEY || !SERVICE_ROLE_KEY || !SUPABASE_URL) {
      return json({ error: "server_not_configured" }, 500);
    }

    const user = await getUser(req);
    if (!user.email) return json({ error: "account_email_required" }, 400);

    const body = await req.json().catch(() => ({}));
    const planKey = String(body?.plan || "monthly");
    const plan = PLANS[planKey];
    if (!plan?.price) return json({ error: "unknown_plan" }, 400);
    await validateConfiguredPrice(plan);

    let { data: profile, error: profileError } = await svc
      .from("profiles")
      .select("id,stripe_customer_id,stripe_subscription_id,billing_customer_id,billing_provider,billing_status")
      .eq("id", user.id)
      .maybeSingle();

    if (profileError) throw new Error(`profile_lookup_failed: ${profileError.message}`);

    if (!profile) {
      const { data, error } = await svc
        .from("profiles")
        .insert({ id: user.id, email: user.email })
        .select("id,stripe_customer_id,stripe_subscription_id,billing_customer_id,billing_provider,billing_status")
        .single();
      if (error) throw new Error(`profile_create_failed: ${error.message}`);
      profile = data;
    }

    const hasExistingSubscription = Boolean(profile.stripe_subscription_id) &&
      !["cancelled", "refunded"].includes(String(profile.billing_status || ""));
    if (hasExistingSubscription) {
      return json({ error: "existing_subscription" }, 409);
    }

    const waitlistEligible = await isWaitlistMember(user.email);
    const discount = waitlistEligible
      ? await resolveDiscount(WAITLIST_DISCOUNTS[planKey])
      : null;

    let customerId = profile.stripe_customer_id ||
      (profile.billing_provider === "stripe" ? profile.billing_customer_id : null);

    if (!customerId) {
      const customer = await stripePost("/v1/customers", {
        email: user.email,
        "metadata[profile_id]": user.id,
        "metadata[supabase_user_id]": user.id,
      });
      customerId = customer.id;

      const { error } = await svc.from("profiles").update({
        stripe_customer_id: customerId,
        billing_provider: "stripe",
        billing_customer_id: customerId,
      }).eq("id", user.id);
      if (error) throw new Error(`customer_bind_failed: ${error.message}`);
    }

    const checkoutParams: Record<string, string> = {
      mode: "subscription",
      customer: customerId,
      client_reference_id: user.id,
      success_url: `${SITE_URL}/account?activating=1&session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${SITE_URL}/pricing`,
      "line_items[0][price]": plan.price,
      "line_items[0][quantity]": "1",
      "metadata[profile_id]": user.id,
      "metadata[plan]": planKey,
      "metadata[subscription_tier]": plan.tier,
      "metadata[waitlist_offer]": waitlistEligible ? "true" : "false",
      "subscription_data[metadata][profile_id]": user.id,
      "subscription_data[metadata][plan]": planKey,
      "subscription_data[metadata][subscription_tier]": plan.tier,
      "subscription_data[metadata][waitlist_offer]": waitlistEligible ? "true" : "false",
    };

    if (discount) {
      checkoutParams[`discounts[0][${discount.parameter}]`] = discount.value;
    }

    const session = await stripePost("/v1/checkout/sessions", checkoutParams);

    return json({ url: session.url, waitlist_offer: waitlistEligible });
  } catch (e) {
    const message = e instanceof Error ? e.message : "unknown_error";
    const status = message.includes("auth")
      ? 401
      : message === "waitlist_discount_not_configured"
      ? 503
      : message === "stripe_price_mismatch"
      ? 503
      : 500;
    console.error("stripe-checkout:", message);
    return json({ error: message }, status);
  }
});
