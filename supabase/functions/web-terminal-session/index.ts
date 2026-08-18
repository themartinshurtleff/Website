import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import {
  accountHeaders,
  accountJson,
  bearerToken,
} from "../_shared/accountHttp.ts";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL") || "";
const SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || "";

const WEBSITE_ORIGINS = new Set([
  "https://tradenet.org",
  "https://www.tradenet.org",
]);

function websiteOriginAllowed(req: Request): boolean {
  const origin = req.headers.get("origin");
  if (!origin) return true;
  if (WEBSITE_ORIGINS.has(origin)) return true;
  try {
    const url = new URL(origin);
    return url.protocol === "http:" &&
      (url.hostname === "127.0.0.1" || url.hostname === "localhost");
  } catch {
    return false;
  }
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { status: 204, headers: accountHeaders(req) });
  }
  if (req.method !== "POST") {
    return accountJson(req, { error: "method_not_allowed" }, 405);
  }
  if (!websiteOriginAllowed(req)) {
    return accountJson(req, { error: "origin_denied" }, 403);
  }
  if (!SUPABASE_URL || !SERVICE_ROLE_KEY) {
    return accountJson(req, { error: "server_not_configured" }, 503);
  }

  try {
    const token = bearerToken(req);
    if (!token) return accountJson(req, { error: "missing_auth" }, 401);

    const service = createClient(SUPABASE_URL, SERVICE_ROLE_KEY, {
      auth: {
        persistSession: false,
        autoRefreshToken: false,
        detectSessionInUrl: false,
      },
    });
    const { data: authData, error: authError } = await service.auth.getUser(token);
    const user = authData?.user;
    if (authError || !user?.id || !user.email) {
      return accountJson(req, { error: "invalid_auth" }, 401);
    }

    // Generate, but do not email, a one-time token for a second independent
    // Supabase session. The browser terminal redeems this token immediately.
    const { data: linkData, error: linkError } = await service.auth.admin
      .generateLink({ type: "magiclink", email: user.email });
    const properties = linkData?.properties;
    if (
      linkError ||
      linkData?.user?.id !== user.id ||
      properties?.verification_type !== "magiclink" ||
      !properties.hashed_token
    ) {
      console.error(
        "web-terminal-session token generation failed",
        linkError?.message || "invalid_generate_link_response",
      );
      return accountJson(req, { error: "session_issue_failed" }, 500);
    }

    return accountJson(req, {
      token_hash: properties.hashed_token,
      verification_type: "magiclink",
    });
  } catch (error) {
    console.error(
      "web-terminal-session failed",
      error instanceof Error ? error.message : "unknown_error",
    );
    return accountJson(req, { error: "session_issue_failed" }, 500);
  }
});
