import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import {
  affiliateBearer,
  affiliateEnabled,
  affiliateJson,
  affiliateOriginAllowed,
  uuid,
} from "../_shared/affiliateHttp.ts";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL") || "";
const SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || "";

const svc = createClient(SUPABASE_URL, SERVICE_ROLE_KEY, {
  auth: { persistSession: false, autoRefreshToken: false },
});

async function consumeRateLimit(userId: string): Promise<boolean> {
  const { data, error } = await svc.rpc(
    "consume_client_announcement_rate_limit",
    {
      p_bucket: `affiliate-claim:${userId}`,
      p_limit: 20,
      p_window_seconds: 60,
    },
  );
  if (error) throw new Error("affiliate_rate_limit_failed");
  const row = Array.isArray(data) ? data[0] : data;
  return row?.allowed === true;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    if (!affiliateOriginAllowed(req)) {
      return affiliateJson(req, { error: "origin_denied" }, 403);
    }
    return new Response(null, { status: 204, headers: affiliateJson(req, {}).headers });
  }
  if (req.method !== "POST") {
    return affiliateJson(req, { error: "method_not_allowed" }, 405);
  }
  if (!affiliateOriginAllowed(req)) {
    return affiliateJson(req, { error: "origin_denied" }, 403);
  }
  if (!affiliateEnabled()) {
    return affiliateJson(req, { error: "affiliate_tracking_disabled" }, 503);
  }
  if (!SUPABASE_URL || !SERVICE_ROLE_KEY) {
    return affiliateJson(req, { error: "server_not_configured" }, 503);
  }

  try {
    const token = affiliateBearer(req);
    if (!token) return affiliateJson(req, { error: "missing_auth" }, 401);

    const { data: userData, error: userError } = await svc.auth.getUser(token);
    if (userError || !userData?.user) {
      return affiliateJson(req, { error: "invalid_auth" }, 401);
    }

    if (!(await consumeRateLimit(userData.user.id))) {
      return affiliateJson(
        req,
        { error: "rate_limited" },
        429,
        { "Retry-After": "60" },
      );
    }

    const body = await req.json().catch(() => ({})) as Record<string, unknown>;
    const clickToken = uuid(body.click_token);
    if (!clickToken) {
      return affiliateJson(req, { error: "affiliate_click_invalid" }, 400);
    }

    const { data, error } = await svc.rpc("claim_affiliate_attribution", {
      p_user: userData.user.id,
      p_click_token: clickToken,
    });
    if (error) {
      const known = [
        "affiliate_click_invalid",
        "affiliate_not_active",
        "affiliate_click_already_claimed",
      ].find((code) => error.message.includes(code));
      if (known) return affiliateJson(req, { error: known }, 409);
      throw error;
    }

    return affiliateJson(req, data || { error: "affiliate_claim_failed" });
  } catch (error) {
    console.error("affiliate-claim:", error);
    return affiliateJson(req, { error: "affiliate_claim_failed" }, 500);
  }
});
