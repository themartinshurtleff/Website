import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import {
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

async function sha256Hex(value: string): Promise<string> {
  const digest = await crypto.subtle.digest(
    "SHA-256",
    new TextEncoder().encode(value),
  );
  return [...new Uint8Array(digest)]
    .map((byte) => byte.toString(16).padStart(2, "0"))
    .join("");
}

function sourceAddress(req: Request): string {
  return req.headers.get("cf-connecting-ip") ||
    req.headers.get("x-real-ip") ||
    req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ||
    "unavailable";
}

function safePath(value: unknown): string | null {
  const path = String(value || "").trim();
  if (!path || path.length > 500 || !path.startsWith("/")) return null;
  return path;
}

function safeCampaign(value: unknown): string | null {
  const campaign = String(value || "").trim();
  return campaign && campaign.length <= 100 ? campaign : null;
}

function referrerHost(req: Request, value: unknown): string | null {
  const raw = String(value || req.headers.get("referer") || "").trim();
  if (!raw) return null;
  try {
    return new URL(raw).hostname.slice(0, 255) || null;
  } catch {
    return null;
  }
}

async function consumeRateLimit(visitorHash: string): Promise<boolean> {
  const { data, error } = await svc.rpc(
    "consume_client_announcement_rate_limit",
    {
      p_bucket: `affiliate-click:${visitorHash.slice(0, 40)}`,
      p_limit: 30,
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
    const body = await req.json().catch(() => ({})) as Record<string, unknown>;
    const slug = String(body.slug || "").trim().toLowerCase();
    const visitorId = uuid(body.visitor_id);
    if (!/^[a-z0-9][a-z0-9-]{1,47}[a-z0-9]$/.test(slug)) {
      return affiliateJson(req, { error: "affiliate_not_found" }, 404);
    }

    const userAgent = String(req.headers.get("user-agent") || "unavailable")
      .slice(0, 512);
    const visitorHash = await sha256Hex([
      SERVICE_ROLE_KEY,
      sourceAddress(req),
      userAgent,
      visitorId || "no-browser-id",
    ].join("|"));

    if (!(await consumeRateLimit(visitorHash))) {
      return affiliateJson(
        req,
        { error: "rate_limited" },
        429,
        { "Retry-After": "60" },
      );
    }

    const { data, error } = await svc.rpc("record_affiliate_click", {
      p_slug: slug,
      p_visitor_hash: visitorHash,
      p_landing_path: safePath(body.landing_path),
      p_campaign: safeCampaign(body.campaign),
      p_referrer_host: referrerHost(req, body.referrer),
    });
    if (error) {
      if (error.message.includes("affiliate_not_found")) {
        return affiliateJson(req, { error: "affiliate_not_found" }, 404);
      }
      throw error;
    }

    return affiliateJson(req, data || { error: "affiliate_click_failed" });
  } catch (error) {
    console.error("affiliate-click:", error);
    return affiliateJson(req, { error: "affiliate_click_failed" }, 500);
  }
});
