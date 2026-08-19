import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import {
  accountHeaders,
  accountJson,
  accountOriginAllowed,
  bearerToken,
} from "../_shared/accountHttp.ts";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL") || "";
const SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || "";

const ALLOWED_EVENTS = new Set(["trial_started", "activated"]);
const ALLOWED_SOURCES = new Set([
  "web_terminal",
  "desktop_terminal",
  "web_terminal_handoff",
  "website",
]);
const ALLOWED_PLATFORMS = new Set(["web", "desktop"]);

function cleanString(value: unknown, maxLength: number): string | null {
  if (typeof value !== "string") return null;
  const text = value.trim();
  return text ? text.slice(0, maxLength) : null;
}

function clientProperties(value: unknown): Record<string, unknown> {
  if (!value || typeof value !== "object" || Array.isArray(value)) return {};
  const input = value as Record<string, unknown>;
  const platform = cleanString(input.platform, 16);
  const appVersion = cleanString(input.app_version, 64);
  const releaseChannel = cleanString(input.release_channel, 32);
  const activationMarker = cleanString(input.activation_marker, 64);
  return {
    ...(platform && ALLOWED_PLATFORMS.has(platform) ? { platform } : {}),
    ...(appVersion ? { app_version: appVersion } : {}),
    ...(releaseChannel ? { release_channel: releaseChannel } : {}),
    ...(activationMarker ? { activation_marker: activationMarker } : {}),
  };
}

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

  const contentLength = Number(req.headers.get("content-length") || "0");
  if (Number.isFinite(contentLength) && contentLength > 4096) {
    return accountJson(req, { error: "payload_too_large" }, 413);
  }

  try {
    const token = bearerToken(req);
    if (!token) return accountJson(req, { error: "missing_auth" }, 401);

    const service = createClient(SUPABASE_URL, SERVICE_ROLE_KEY, {
      auth: { persistSession: false, autoRefreshToken: false },
    });
    const { data: authData, error: authError } = await service.auth.getUser(
      token,
    );
    const user = authData?.user;
    if (authError || !user?.id) {
      return accountJson(req, { error: "invalid_auth" }, 401);
    }

    const body = await req.json().catch(() => ({})) as Record<string, unknown>;
    const event = cleanString(body.event, 32);
    const source = cleanString(body.source, 64);
    if (!event || !ALLOWED_EVENTS.has(event)) {
      return accountJson(req, { error: "invalid_event" }, 400);
    }
    if (!source || !ALLOWED_SOURCES.has(source)) {
      return accountJson(req, { error: "invalid_source" }, 400);
    }

    const { data: created, error: milestoneError } = await service.rpc(
      "record_lifecycle_milestone",
      {
        p_user_id: user.id,
        p_milestone: event,
        p_source: source,
        p_properties: clientProperties(body.properties),
      },
    );
    if (milestoneError) {
      console.error("lifecycle milestone failed", milestoneError.code);
      return accountJson(req, { error: "milestone_failed" }, 500);
    }

    return accountJson(req, { accepted: true, created: created === true });
  } catch (error) {
    console.error(
      "lifecycle-event failed",
      error instanceof Error ? error.message : "unknown",
    );
    return accountJson(req, { error: "lifecycle_event_failed" }, 500);
  }
});
