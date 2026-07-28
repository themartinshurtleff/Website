import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import {
  AnnouncementValidationError,
  uuid,
  validateAnnouncementPayload,
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

class AdminAnnouncementError extends Error {
  status: number;
  code: string;
  field?: string;
  reason?: string;
  retryAfter?: number;

  constructor(code: string, status: number, options: {
    field?: string;
    reason?: string;
    retryAfter?: number;
  } = {}) {
    super(code);
    this.name = "AdminAnnouncementError";
    this.code = code;
    this.status = status;
    this.field = options.field;
    this.reason = options.reason;
    this.retryAfter = options.retryAfter;
  }
}

type AdminIdentity = {
  id: string;
  token: string;
};

function rpcCode(error: { message?: string } | null): string {
  const message = error?.message || "";
  const known = [
    "admin_required",
    "request_id_conflict",
    "invalid_announcement_action",
    "announcement_identity_required",
    "announcement_not_found",
    "revision_conflict",
    "announcement_archived",
  ];
  return known.find((code) => message.includes(code)) || "database_error";
}

function rpcStatus(code: string): number {
  if (code === "admin_required") return 403;
  if (
    code === "revision_conflict" ||
    code === "request_id_conflict" ||
    code === "announcement_archived"
  ) return 409;
  if (
    code === "invalid_announcement_action" ||
    code === "announcement_identity_required"
  ) return 400;
  if (code === "announcement_not_found") return 404;
  return 500;
}

async function requireAdmin(req: Request): Promise<AdminIdentity> {
  const token = announcementBearer(req);
  if (!token) throw new AdminAnnouncementError("missing_auth", 401);

  const { data: userData, error: userError } = await svc.auth.getUser(token);
  if (userError || !userData?.user) {
    throw new AdminAnnouncementError("invalid_auth", 401);
  }

  const { data: aal, error: aalError } =
    await svc.auth.mfa.getAuthenticatorAssuranceLevel(token);
  if (aalError) throw new AdminAnnouncementError("mfa_check_failed", 503);
  if (aal?.currentLevel !== "aal2") {
    throw new AdminAnnouncementError("mfa_required", 403);
  }

  const { data: profile, error: profileError } = await svc
    .from("profiles")
    .select("id,access_tier,access_status")
    .eq("id", userData.user.id)
    .maybeSingle();
  if (profileError) throw new AdminAnnouncementError("admin_check_failed", 503);
  if (
    !profile ||
    profile.access_tier !== "admin" ||
    ["revoked", "cancelled"].includes(String(profile.access_status || ""))
  ) {
    throw new AdminAnnouncementError("admin_required", 403);
  }

  return { id: userData.user.id, token };
}

async function consumeRateLimit(
  bucket: string,
  limit: number,
  windowSeconds: number,
): Promise<void> {
  const { data, error } = await svc.rpc(
    "consume_client_announcement_rate_limit",
    {
      p_bucket: bucket,
      p_limit: limit,
      p_window_seconds: windowSeconds,
    },
  );
  if (error) throw new AdminAnnouncementError("rate_limit_failed", 503);
  const result = Array.isArray(data) ? data[0] : data;
  if (result?.allowed !== true) {
    throw new AdminAnnouncementError("rate_limited", 429, {
      retryAfter: Math.max(1, Number(result?.retry_after_seconds || 60)),
    });
  }
}

function positiveInteger(value: unknown, fallback: number, maximum: number): number {
  const parsed = Number(value);
  if (!Number.isInteger(parsed) || parsed < 1) return fallback;
  return Math.min(parsed, maximum);
}

async function listAnnouncements(body: Record<string, unknown>) {
  const limit = positiveInteger(body.limit, 100, 100);
  const offset = Math.max(0, Number.isInteger(Number(body.offset))
    ? Number(body.offset)
    : 0);
  let query = svc
    .from("client_announcements")
    .select("*", { count: "exact" })
    .order("updated_at", { ascending: false })
    .range(offset, offset + limit - 1);

  const status = String(body.status || "all");
  if (!["all", "draft", "published", "archived"].includes(status)) {
    throw new AdminAnnouncementError("status_invalid", 400);
  }
  if (status !== "all") query = query.eq("status", status);

  const { data, error, count } = await query;
  if (error) throw new AdminAnnouncementError("announcement_list_failed", 500);
  return { announcements: data || [], count: count || 0 };
}

async function listAudit(body: Record<string, unknown>) {
  const announcementId = uuid(body.announcement_id);
  if (!announcementId) {
    throw new AdminAnnouncementError("announcement_id_invalid", 400);
  }
  const limit = positiveInteger(body.limit, 100, 100);
  const { data, error } = await svc
    .from("client_announcement_audit")
    .select(
      "id,request_id,actor_id,announcement_id,action,from_revision,to_revision,snapshot_revision,created_at",
    )
    .eq("announcement_id", announcementId)
    .order("created_at", { ascending: false })
    .limit(limit);
  if (error) throw new AdminAnnouncementError("audit_list_failed", 500);
  return { audit: data || [] };
}

async function loadAnnouncement(id: string) {
  const { data, error } = await svc
    .from("client_announcements")
    .select("*")
    .eq("id", id)
    .maybeSingle();
  if (error) throw new AdminAnnouncementError("announcement_lookup_failed", 500);
  if (!data) throw new AdminAnnouncementError("announcement_not_found", 404);
  return data;
}

function requireConfirmation(
  action: string,
  body: Record<string, unknown>,
  current: any,
): void {
  if (body.confirmed !== true) {
    throw new AdminAnnouncementError("confirmation_required", 400);
  }

  const updateIsLive = action === "update" && current?.status === "published";
  const publishIsHighImpact = action === "publish" && (
    ["critical", "maintenance"].includes(String(current?.severity || "")) ||
    current?.requires_ack === true ||
    current?.dismissible === false
  );
  if ((updateIsLive || publishIsHighImpact) && body.confirmation_text !== "PUBLISH") {
    throw new AdminAnnouncementError("publish_confirmation_required", 400);
  }
  const archiveIsHighImpact = action === "archive" &&
    current?.status === "published" &&
    ["critical", "maintenance"].includes(String(current?.severity || ""));
  if (archiveIsHighImpact && body.confirmation_text !== "ARCHIVE") {
    throw new AdminAnnouncementError("archive_confirmation_required", 400);
  }
}

async function mutateAnnouncement(
  admin: AdminIdentity,
  action: string,
  body: Record<string, unknown>,
) {
  const requestId = uuid(body.request_id);
  if (!requestId) throw new AdminAnnouncementError("request_id_invalid", 400);

  const announcementId = action === "create_draft"
    ? null
    : uuid(body.announcement_id);
  if (action !== "create_draft" && !announcementId) {
    throw new AdminAnnouncementError("announcement_id_invalid", 400);
  }
  const expectedRevision = action === "create_draft"
    ? null
    : positiveInteger(body.expected_revision, 0, 2147483647);
  if (action !== "create_draft" && !expectedRevision) {
    throw new AdminAnnouncementError("expected_revision_invalid", 400);
  }

  let current: any = null;
  if (announcementId) current = await loadAnnouncement(announcementId);

  let payload: Record<string, unknown> = {};
  if (action === "create_draft" || action === "update") {
    try {
      payload = validateAnnouncementPayload(body.payload) as unknown as Record<
        string,
        unknown
      >;
    } catch (error) {
      if (error instanceof AnnouncementValidationError) {
        throw new AdminAnnouncementError("validation_failed", 400, {
          field: error.field,
          reason: error.message,
        });
      }
      throw error;
    }
  }

  if (
    action === "publish" ||
    action === "archive" ||
    (action === "update" && current?.status === "published")
  ) {
    requireConfirmation(action, body, current);
  }

  const { data, error } = await svc.rpc("mutate_client_announcement", {
    p_actor: admin.id,
    p_action: action,
    p_request_id: requestId,
    p_announcement_id: announcementId,
    p_expected_revision: expectedRevision,
    p_payload: payload,
  });
  if (error) {
    const code = rpcCode(error);
    throw new AdminAnnouncementError(code, rpcStatus(code));
  }

  const announcement = data?.announcement || {};
  const shouldBroadcast = action === "publish" ||
    (action === "update" && announcement.status === "published") ||
    (action === "archive" && current?.status === "published");
  let broadcasted = false;
  if (shouldBroadcast) {
    const broadcast = await svc.rpc(
      "broadcast_client_announcement_invalidation",
      {
        p_snapshot_revision: data.snapshot_revision,
        p_announcement_id: announcement.id,
        p_announcement_revision: announcement.revision,
        p_operation: action,
      },
    );
    broadcasted = !broadcast.error;
    if (broadcast.error) {
      console.error(
        JSON.stringify({
          event: "announcement_broadcast_failed",
          request_id: requestId,
          announcement_id: announcement.id,
          code: broadcast.error.code || "unknown",
        }),
      );
    }
  }

  return {
    announcement,
    snapshot_revision: String(data?.snapshot_revision ?? "0"),
    idempotent: data?.idempotent === true,
    broadcasted,
  };
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
    const admin = await requireAdmin(req);
    const body = await req.json().catch(() => ({})) as Record<string, unknown>;
    const action = String(body.action || "");

    if (action === "list") {
      await consumeRateLimit(`announcement-admin-read:${admin.id}`, 120, 60);
      return announcementJson(req, await listAnnouncements(body));
    }
    if (action === "audit") {
      await consumeRateLimit(`announcement-admin-read:${admin.id}`, 120, 60);
      return announcementJson(req, await listAudit(body));
    }
    if (!["create_draft", "update", "publish", "archive"].includes(action)) {
      throw new AdminAnnouncementError("action_invalid", 400);
    }

    await consumeRateLimit(`announcement-admin-write:${admin.id}`, 30, 600);
    return announcementJson(
      req,
      await mutateAnnouncement(admin, action, body),
    );
  } catch (error) {
    if (error instanceof AdminAnnouncementError) {
      const headers: Record<string, string> = error.retryAfter
        ? { "Retry-After": String(error.retryAfter) }
        : {};
      return announcementJson(req, {
        error: error.code,
        ...(error.field ? { field: error.field } : {}),
        ...(error.reason ? { reason: error.reason } : {}),
      }, error.status, headers);
    }
    console.error("admin-announcements:", error);
    return announcementJson(req, { error: "admin_announcement_failed" }, 500);
  }
});
