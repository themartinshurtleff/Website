import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import {
  accountHeaders,
  accountJson,
  accountOriginAllowed,
  bearerToken,
} from "../_shared/accountHttp.ts";
import { stripeRequest } from "../_shared/stripe.ts";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL") || "";
const SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || "";
const STRIPE_SECRET_KEY = Deno.env.get("STRIPE_SECRET_KEY") || "";

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { status: 204, headers: accountHeaders(req) });
  }
  if (req.method !== "POST") {
    return accountJson(req, { error: "method_not_allowed" }, 405);
  }
  if (!accountOriginAllowed(req)) {
    return accountJson(req, { error: "origin_denied" }, 403);
  }
  if (!SUPABASE_URL || !SERVICE_ROLE_KEY) {
    return accountJson(req, { error: "server_not_configured" }, 503);
  }

  try {
    const token = bearerToken(req);
    if (!token) return accountJson(req, { error: "missing_auth" }, 401);

    const service = createClient(SUPABASE_URL, SERVICE_ROLE_KEY, {
      auth: { persistSession: false, autoRefreshToken: false },
    });
    const { data: authData, error: authError } = await service.auth.getUser(token);
    const user = authData?.user;
    if (authError || !user?.id || !user.email) {
      return accountJson(req, { error: "invalid_auth" }, 401);
    }

    const { data: profile, error: profileError } = await service
      .from("profiles")
      .select("billing_provider,billing_customer_id,stripe_customer_id")
      .eq("id", user.id)
      .maybeSingle();
    if (profileError) throw profileError;

    const { error: profileUpdateError } = await service
      .from("profiles")
      .update({ email: user.email })
      .eq("id", user.id);
    if (profileUpdateError) throw profileUpdateError;

    const stripeCustomerId = profile?.stripe_customer_id ||
      (profile?.billing_provider === "stripe" ? profile.billing_customer_id : null);
    if (stripeCustomerId) {
      if (!STRIPE_SECRET_KEY) {
        return accountJson(req, { error: "billing_sync_not_configured" }, 503);
      }
      await stripeRequest(
        STRIPE_SECRET_KEY,
        "POST",
        `/v1/customers/${encodeURIComponent(stripeCustomerId)}`,
        { email: user.email },
      );
    }

    return accountJson(req, {
      synced: true,
      billing_customer_updated: Boolean(stripeCustomerId),
    });
  } catch (error) {
    console.error(
      "sync-account-email failed",
      error instanceof Error ? error.message : error,
    );
    return accountJson(req, { error: "account_email_sync_failed" }, 500);
  }
});
