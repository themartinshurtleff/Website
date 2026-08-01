// Authenticated, entitlement-gated desktop release download tickets.

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { bearer, corsHeaders, json } from "../_shared/http.ts";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL") || "";
const SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || "";
const DOWNLOAD_URL_TTL_SECONDS = 90;
const DESKTOP_TIERS = new Set(["referral_verified", "beta", "pro", "admin"]);

const svc = createClient(SUPABASE_URL, SERVICE_ROLE_KEY, {
  auth: { persistSession: false, autoRefreshToken: false },
});

function releasePayload(release: Record<string, unknown>) {
  return {
    id: release.id,
    channel: release.channel,
    version: release.version,
    platform: release.platform,
    architecture: release.architecture,
    filename: release.filename,
    sha256: release.sha256,
    size_bytes: release.size_bytes,
    published_at: release.published_at,
  };
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { status: 204, headers: corsHeaders });
  }
  if (req.method !== "POST") return json({ error: "method_not_allowed" }, 405);
  if (!SUPABASE_URL || !SERVICE_ROLE_KEY) {
    return json({ error: "server_not_configured" }, 503);
  }

  try {
    const token = bearer(req);
    if (!token) return json({ error: "missing_auth" }, 401);

    const { data: authData, error: authError } = await svc.auth.getUser(token);
    if (authError || !authData?.user) return json({ error: "invalid_auth" }, 401);

    const { data: profile, error: profileError } = await svc
      .from("profiles")
      .select("access_tier,access_status")
      .eq("id", authData.user.id)
      .maybeSingle();
    if (profileError) throw new Error(`profile_lookup_failed: ${profileError.message}`);

    const tier = String(profile?.access_tier || "waitlist");
    if (!DESKTOP_TIERS.has(tier)) {
      return json({ error: "desktop_access_required" }, 403);
    }
    if (["revoked", "past_due"].includes(String(profile?.access_status || ""))) {
      return json({ error: "desktop_access_required" }, 403);
    }

    const body = await req.json().catch(() => ({}));
    const action = body?.action === "download" ? "download" : "status";

    const { data: release, error: releaseError } = await svc
      .from("terminal_releases")
      .select("id,channel,version,platform,architecture,bucket_id,object_path,filename,sha256,size_bytes,published_at")
      .eq("channel", "beta")
      .eq("platform", "windows")
      .eq("architecture", "x86_64")
      .eq("is_active", true)
      .maybeSingle();
    if (releaseError) throw new Error(`release_lookup_failed: ${releaseError.message}`);
    if (!release) return json({ error: "release_unavailable" }, 404);

    if (action === "status") {
      return json({ release: releasePayload(release) });
    }

    const { data: signed, error: signedError } = await svc.storage
      .from(release.bucket_id)
      .createSignedUrl(release.object_path, DOWNLOAD_URL_TTL_SECONDS, {
        download: release.filename,
      });
    if (signedError || !signed?.signedUrl) {
      throw new Error(`signed_url_failed: ${signedError?.message || "missing_url"}`);
    }

    const { error: eventError } = await svc.from("terminal_download_events").insert({
      user_id: authData.user.id,
      release_id: release.id,
    });
    if (eventError) console.error("terminal-download event insert:", eventError.message);

    return json({
      release: releasePayload(release),
      url: signed.signedUrl,
      expires_in: DOWNLOAD_URL_TTL_SECONDS,
    });
  } catch (error) {
    console.error("terminal-download:", error);
    return json({ error: "terminal_download_failed" }, 500);
  }
});
