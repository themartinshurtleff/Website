import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import {
  ANNOUNCEMENT_SCHEMA_VERSION,
  AnnouncementValidationError,
  validateClientContext,
  versionMatches,
} from "../_shared/announcements.ts";
import {
  announcementBearer,
  announcementCors,
  announcementEnabled,
  announcementJson,
  originAllowed,
} from "../_shared/announcementHttp.ts";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL") || "";
const SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || "";

const svc = createClient(SUPABASE_URL, SERVICE_ROLE_KEY, {
  auth: { persistSession: false, autoRefreshToken: false },
});

class SnapshotError extends Error {
  status: number;
  code: string;
  field?: string;
  retryAfter?: number;

  constructor(code: string, status: number, options: {
    field?: string;
    retryAfter?: number;
  } = {}) {
    super(code);
    this.name = "SnapshotError";
    this.code = code;
    this.status = status;
    this.field = options.field;
    this.retryAfter = options.retryAfter;
  }
}

async function requireUser(req: Request) {
  const token = announcementBearer(req);
  if (!token) throw new SnapshotError("missing_auth", 401);
  const { data, error } = await svc.auth.getUser(token);
  if (error || !data?.user) throw new SnapshotError("invalid_auth", 401);
  return data.user;
}

async function consumeRateLimit(userId: string): Promise<void> {
  const { data, error } = await svc.rpc(
    "consume_client_announcement_rate_limit",
    {
      p_bucket: `announcement-snapshot:${userId}`,
      p_limit: 30,
      p_window_seconds: 60,
    },
  );
  if (error) throw new SnapshotError("rate_limit_failed", 503);
  const result = Array.isArray(data) ? data[0] : data;
  if (result?.allowed !== true) {
    throw new SnapshotError("rate_limited", 429, {
      retryAfter: Math.max(1, Number(result?.retry_after_seconds || 60)),
    });
  }
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    if (!originAllowed(req)) return announcementJson(req, { error: "origin_denied" }, 403);
    return new Response(null, { status: 204, headers: announcementCors(req) });
  }
  if (req.method !== "POST") {
    return announcementJson(req, { error: "method_not_allowed" }, 405);
  }
  if (!originAllowed(req)) {
    return announcementJson(req, { error: "origin_denied" }, 403);
  }
  if (!announcementEnabled()) {
    return announcementJson(req, { error: "announcements_disabled" }, 503);
  }
  if (!SUPABASE_URL || !SERVICE_ROLE_KEY) {
    return announcementJson(req, { error: "server_not_configured" }, 503);
  }

  try {
    const user = await requireUser(req);
    await consumeRateLimit(user.id);
    const body = await req.json().catch(() => ({}));
    let context;
    try {
      context = validateClientContext(body);
    } catch (error) {
      if (error instanceof AnnouncementValidationError) {
        throw new SnapshotError("validation_failed", 400, { field: error.field });
      }
      throw error;
    }

    const { data: candidates, error: snapshotError } = await svc.rpc(
      "get_client_announcement_snapshot",
      {
        p_user: user.id,
        p_platform: context.platform,
        p_os: context.os,
        p_channel: context.channel,
      },
    );
    if (snapshotError) throw new SnapshotError("snapshot_failed", 500);

    const { data: state, error: stateError } = await svc
      .from("client_announcement_state")
      .select("revision")
      .eq("singleton", true)
      .single();
    if (stateError) throw new SnapshotError("snapshot_state_failed", 500);

    const announcements = (candidates || [])
      .filter((row: any) =>
        versionMatches(context.version, row.min_version, row.max_version)
      )
      .map((row: any) => ({
        id: row.id,
        revision: row.revision,
        severity: row.severity,
        title: row.title,
        body: row.body,
        starts_at: row.starts_at,
        ends_at: row.ends_at,
        service_scopes: row.service_scopes || [],
        dismissible: row.dismissible,
        requires_ack: row.requires_ack,
        action: row.action_label && row.action_url
          ? { label: row.action_label, url: row.action_url }
          : null,
      }));

    return announcementJson(req, {
      schema_version: ANNOUNCEMENT_SCHEMA_VERSION,
      snapshot_revision: String(state.revision),
      server_time: new Date().toISOString(),
      poll_after_seconds: 90,
      announcements,
    });
  } catch (error) {
    if (error instanceof SnapshotError) {
      const headers: Record<string, string> = error.retryAfter
        ? { "Retry-After": String(error.retryAfter) }
        : {};
      return announcementJson(req, {
        error: error.code,
        ...(error.field ? { field: error.field } : {}),
      }, error.status, headers);
    }
    console.error("client-announcement-snapshot:", error);
    return announcementJson(req, { error: "snapshot_failed" }, 500);
  }
});
