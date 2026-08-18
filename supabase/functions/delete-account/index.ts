import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import {
  accountHeaders,
  accountJson,
  accountOriginAllowed,
  bearerToken,
} from "../_shared/accountHttp.ts";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL") || "";
const SUPABASE_ANON_KEY = Deno.env.get("SUPABASE_ANON_KEY") || "";
const SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || "";

function normalizedEmail(value: unknown): string {
  return typeof value === "string" ? value.trim().toLowerCase() : "";
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { status: 204, headers: accountHeaders(req) });
  }
  if (req.method !== "POST") return accountJson(req, { error: "method_not_allowed" }, 405);
  if (!accountOriginAllowed(req)) return accountJson(req, { error: "origin_denied" }, 403);
  if (!SUPABASE_URL || !SUPABASE_ANON_KEY || !SERVICE_ROLE_KEY) {
    return accountJson(req, { error: "server_not_configured" }, 503);
  }

  const contentLength = Number(req.headers.get("content-length") || "0");
  if (Number.isFinite(contentLength) && contentLength > 8192) {
    return accountJson(req, { error: "payload_too_large" }, 413);
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

    const body = await req.json().catch(() => ({})) as Record<string, unknown>;
    const password = typeof body.password === "string" ? body.password : "";
    const confirmationEmail = normalizedEmail(body.confirmation_email);

    if (!password || password.length > 1024) {
      return accountJson(req, { error: "current_password_required" }, 400);
    }
    if (confirmationEmail !== normalizedEmail(user.email)) {
      return accountJson(req, { error: "confirmation_email_mismatch" }, 400);
    }

    const credentials = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
      auth: {
        persistSession: false,
        autoRefreshToken: false,
        detectSessionInUrl: false,
      },
    });
    const { data: signInData, error: signInError } = await credentials.auth
      .signInWithPassword({ email: user.email, password });

    if (signInError || signInData.user?.id !== user.id) {
      return accountJson(req, { error: "invalid_current_password" }, 403);
    }

    await credentials.auth.signOut({ scope: "local" }).catch(() => null);

    const { data: result, error: deletionError } = await service.rpc(
      "delete_self_service_account",
      { p_user: user.id },
    );
    if (deletionError) {
      console.error("delete-account rpc failed", deletionError.code, deletionError.message);
      return accountJson(req, { error: "account_delete_failed" }, 500);
    }

    if (!result?.ok) {
      const code = typeof result?.error === "string"
        ? result.error
        : "account_delete_failed";
      const status = code === "account_not_found" ? 404 : 409;
      return accountJson(req, { error: code }, status);
    }

    return accountJson(req, { deleted: true });
  } catch (error) {
    console.error("delete-account failed", error instanceof Error ? error.message : error);
    return accountJson(req, { error: "account_delete_failed" }, 500);
  }
});
