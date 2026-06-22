// Supabase Edge Function: stripe-checkout
// Creates an authenticated Stripe Checkout Session for a logged-in TradeNet user.

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL") || "";
const SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || "";
const STRIPE_SECRET_KEY = Deno.env.get("STRIPE_SECRET_KEY") || "";
const SITE_URL = (Deno.env.get("SITE_URL") || "https://tradenet.org").replace(/\/+$/, "");

const PLANS: Record<string, { price: string; tier: string }> = {
  monthly: {
    price: Deno.env.get("STRIPE_PRICE_MONTHLY") || "",
    tier: "pro_monthly",
  },
  annual: {
    price: Deno.env.get("STRIPE_PRICE_ANNUAL") || "",
    tier: "pro_annual",
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

async function getUser(req: Request) {
  const token = bearer(req);
  if (!token) throw new Error("missing_auth");

  const { data, error } = await svc.auth.getUser(token);
  if (error || !data?.user) throw new Error("invalid_auth");
  return data.user;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { status: 204, headers: corsHeaders });
  if (req.method !== "POST") return json({ error: "method_not_allowed" }, 405);

  try {
    if (!STRIPE_SECRET_KEY || !SERVICE_ROLE_KEY || !SUPABASE_URL) {
      return json({ error: "server_not_configured" }, 500);
    }

    const user = await getUser(req);
    const body = await req.json().catch(() => ({}));
    const planKey = String(body?.plan || "monthly");
    const plan = PLANS[planKey];
    if (!plan?.price) return json({ error: "unknown_plan" }, 400);

    let { data: profile, error: profileError } = await svc
      .from("profiles")
      .select("id,email,stripe_customer_id,billing_customer_id,billing_provider")
      .eq("id", user.id)
      .maybeSingle();

    if (profileError) throw new Error(`profile_lookup_failed: ${profileError.message}`);

    if (!profile) {
      const { data, error } = await svc
        .from("profiles")
        .insert({ id: user.id, email: user.email })
        .select("id,email,stripe_customer_id,billing_customer_id,billing_provider")
        .single();
      if (error) throw new Error(`profile_create_failed: ${error.message}`);
      profile = data;
    }

    let customerId = profile.stripe_customer_id ||
      (profile.billing_provider === "stripe" ? profile.billing_customer_id : null);

    if (!customerId) {
      const customer = await stripePost("/v1/customers", {
        email: profile.email || user.email || "",
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

    const session = await stripePost("/v1/checkout/sessions", {
      mode: "subscription",
      customer: customerId,
      client_reference_id: user.id,
      allow_promotion_codes: "true",
      success_url: `${SITE_URL}/account?activating=1&session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${SITE_URL}/#pricing`,
      "line_items[0][price]": plan.price,
      "line_items[0][quantity]": "1",
      "metadata[profile_id]": user.id,
      "metadata[plan]": planKey,
      "metadata[subscription_tier]": plan.tier,
      "subscription_data[metadata][profile_id]": user.id,
      "subscription_data[metadata][plan]": planKey,
      "subscription_data[metadata][subscription_tier]": plan.tier,
    });

    return json({ url: session.url });
  } catch (e) {
    const message = e instanceof Error ? e.message : "unknown_error";
    const status = message.includes("auth") ? 401 : 500;
    console.error("stripe-checkout:", message);
    return json({ error: message }, status);
  }
});
