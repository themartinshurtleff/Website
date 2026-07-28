// Authenticated Stripe Billing Portal session for an existing customer.

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { bearer, corsHeaders, json } from "../_shared/http.ts";
import { stripeRequest, StripeRequestError } from "../_shared/stripe.ts";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL") || "";
const SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || "";
const STRIPE_SECRET_KEY = Deno.env.get("STRIPE_SECRET_KEY") || "";
const SITE_URL = (Deno.env.get("SITE_URL") || "https://tradenet.org").replace(/\/+$/, "");

const svc = createClient(SUPABASE_URL, SERVICE_ROLE_KEY, {
  auth: { persistSession: false, autoRefreshToken: false },
});

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { status: 204, headers: corsHeaders });
  }
  if (req.method !== "POST") return json({ error: "method_not_allowed" }, 405);

  try {
    if (!STRIPE_SECRET_KEY || !SERVICE_ROLE_KEY || !SUPABASE_URL) {
      return json({ error: "server_not_configured" }, 503);
    }

    const token = bearer(req);
    if (!token) return json({ error: "missing_auth" }, 401);

    const { data: authData, error: authError } = await svc.auth.getUser(token);
    if (authError || !authData?.user) return json({ error: "invalid_auth" }, 401);

    const { data: profile, error } = await svc
      .from("profiles")
      .select("stripe_customer_id,billing_customer_id,billing_provider")
      .eq("id", authData.user.id)
      .maybeSingle();
    if (error) throw new Error(`profile_lookup_failed: ${error.message}`);

    const customerId = profile?.stripe_customer_id ||
      (profile?.billing_provider === "stripe" ? profile?.billing_customer_id : null);
    if (!customerId) return json({ error: "no_stripe_customer" }, 409);

    const session = await stripeRequest(
      STRIPE_SECRET_KEY,
      "POST",
      "/v1/billing_portal/sessions",
      {
        customer: customerId,
        return_url: `${SITE_URL}/account`,
      },
    );

    return json({ url: session.url });
  } catch (error) {
    if (error instanceof StripeRequestError) {
      console.error("stripe-portal Stripe error:", error.status, error.code, error.message);
      return json({ error: "stripe_request_failed" }, 502);
    }
    console.error("stripe-portal:", error);
    return json({ error: "portal_failed" }, 500);
  }
});

