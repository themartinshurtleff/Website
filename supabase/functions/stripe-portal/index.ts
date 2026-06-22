// Supabase Edge Function: stripe-portal
// Creates an authenticated Stripe Billing Portal Session for the current user.

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL") || "";
const SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || "";
const STRIPE_SECRET_KEY = Deno.env.get("STRIPE_SECRET_KEY") || "";
const SITE_URL = (Deno.env.get("SITE_URL") || "https://tradenet.org").replace(/\/+$/, "");

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

async function getUser(req: Request) {
  const token = bearer(req);
  if (!token) throw new Error("missing_auth");

  const { data, error } = await svc.auth.getUser(token);
  if (error || !data?.user) throw new Error("invalid_auth");
  return data.user;
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

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { status: 204, headers: corsHeaders });
  if (req.method !== "POST") return json({ error: "method_not_allowed" }, 405);

  try {
    if (!STRIPE_SECRET_KEY || !SERVICE_ROLE_KEY || !SUPABASE_URL) {
      return json({ error: "server_not_configured" }, 500);
    }

    const user = await getUser(req);
    const { data: profile, error } = await svc
      .from("profiles")
      .select("stripe_customer_id,billing_customer_id,billing_provider")
      .eq("id", user.id)
      .maybeSingle();

    if (error) throw new Error(`profile_lookup_failed: ${error.message}`);

    const customerId = profile?.stripe_customer_id ||
      (profile?.billing_provider === "stripe" ? profile?.billing_customer_id : null);

    if (!customerId) return json({ error: "no_stripe_customer" }, 409);

    const session = await stripePost("/v1/billing_portal/sessions", {
      customer: customerId,
      return_url: `${SITE_URL}/account`,
    });

    return json({ url: session.url });
  } catch (e) {
    const message = e instanceof Error ? e.message : "unknown_error";
    const status = message.includes("auth") ? 401 : 500;
    console.error("stripe-portal:", message);
    return json({ error: message }, status);
  }
});

