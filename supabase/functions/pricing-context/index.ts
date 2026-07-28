// Sanitized public and account-specific pricing state.

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { bearer, corsHeaders, envFlag, json } from "../_shared/http.ts";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL") || "";
const SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || "";
const ANON_KEY = Deno.env.get("SUPABASE_ANON_KEY") || "";
const CHECKOUT_ENABLED = envFlag("STRIPE_CHECKOUT_ENABLED", false);
const PUBLIC_CHECKOUT_ENABLED = envFlag("STRIPE_PUBLIC_CHECKOUT_ENABLED", false);

const svc = createClient(SUPABASE_URL, SERVICE_ROLE_KEY, {
  auth: { persistSession: false, autoRefreshToken: false },
});

const PRICING = {
  standard: {
    monthly: { amount: 39, interval: "month" },
    annual: { amount: 384, interval: "year", monthly_equivalent: 32 },
  },
  founding: {
    monthly: {
      intro_amount: 19,
      intro_intervals: 3,
      renewal_amount: 29,
      interval: "month",
    },
    annual: {
      intro_amount: 199,
      intro_intervals: 1,
      renewal_amount: 284,
      interval: "year",
    },
  },
};

function isAnonymousProjectToken(token: string): boolean {
  if (!token) return true;
  if (ANON_KEY && token === ANON_KEY) return true;
  if (token.startsWith("sb_publishable_")) return true;

  try {
    const payloadPart = token.split(".")[1];
    if (!payloadPart) return false;
    const normalized = payloadPart.replace(/-/g, "+").replace(/_/g, "/");
    const payload = JSON.parse(atob(normalized));
    return payload?.role === "anon" && !payload?.sub;
  } catch {
    return false;
  }
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { status: 204, headers: corsHeaders });
  }
  if (req.method !== "GET" && req.method !== "POST") {
    return json({ error: "method_not_allowed" }, 405);
  }
  if (!SUPABASE_URL || !SERVICE_ROLE_KEY) {
    return json({ error: "server_not_configured" }, 503);
  }

  try {
    const token = bearer(req);
    let offer: Record<string, unknown> = {
      eligible: false,
      state: "signed_out",
      can_claim: false,
    };

    if (token && !isAnonymousProjectToken(token)) {
      const { data, error } = await svc.auth.getUser(token);
      if (error || !data?.user) return json({ error: "invalid_auth" }, 401);

      const context = await svc.rpc("get_founding_offer_context", {
        p_user: data.user.id,
      });
      if (context.error) throw new Error(context.error.message);
      offer = context.data || offer;
    }

    return json({
      checkout_enabled: CHECKOUT_ENABLED,
      public_checkout_enabled: CHECKOUT_ENABLED && PUBLIC_CHECKOUT_ENABLED,
      pricing: PRICING,
      offer,
    });
  } catch (error) {
    console.error("pricing-context:", error);
    return json({ error: "pricing_context_failed" }, 500);
  }
});
