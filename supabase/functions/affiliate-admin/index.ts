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

class AffiliateAdminError extends Error {
  constructor(public code: string, public status = 500) {
    super(code);
  }
}

type AdminIdentity = { id: string };

async function requireAdmin(req: Request): Promise<AdminIdentity> {
  const token = affiliateBearer(req);
  if (!token) throw new AffiliateAdminError("missing_auth", 401);

  const { data: userData, error: userError } = await svc.auth.getUser(token);
  if (userError || !userData?.user) {
    throw new AffiliateAdminError("invalid_auth", 401);
  }

  const { data: aal, error: aalError } =
    await svc.auth.mfa.getAuthenticatorAssuranceLevel(token);
  if (aalError) throw new AffiliateAdminError("mfa_check_failed", 503);
  if (aal?.currentLevel !== "aal2") {
    throw new AffiliateAdminError("mfa_required", 403);
  }

  const { data: profile, error: profileError } = await svc
    .from("profiles")
    .select("id,access_tier,access_status")
    .eq("id", userData.user.id)
    .maybeSingle();
  if (profileError) throw new AffiliateAdminError("admin_check_failed", 503);
  if (
    !profile || profile.access_tier !== "admin" ||
    ["revoked", "cancelled"].includes(String(profile.access_status || ""))
  ) {
    throw new AffiliateAdminError("admin_required", 403);
  }
  return { id: userData.user.id };
}

async function consumeRateLimit(
  adminId: string,
  kind: "read" | "write",
): Promise<void> {
  const { data, error } = await svc.rpc(
    "consume_client_announcement_rate_limit",
    {
      p_bucket: `affiliate-admin-${kind}:${adminId}`,
      p_limit: kind === "read" ? 180 : 30,
      p_window_seconds: kind === "read" ? 60 : 600,
    },
  );
  if (error) throw new AffiliateAdminError("rate_limit_failed", 503);
  const row = Array.isArray(data) ? data[0] : data;
  if (row?.allowed !== true) throw new AffiliateAdminError("rate_limited", 429);
}

async function listAffiliates() {
  const { data, error } = await svc
    .from("affiliate_admin_summary")
    .select("*")
    .order("created_at", { ascending: false });
  if (error) throw new AffiliateAdminError("affiliate_list_failed");
  return { affiliates: data || [] };
}

async function affiliateDetail(affiliateId: string) {
  const [attributions, commissions, payouts] = await Promise.all([
    svc.from("affiliate_attributions")
      .select("id,user_id,attributed_at,commission_started_at")
      .eq("affiliate_id", affiliateId)
      .order("attributed_at", { ascending: false })
      .limit(250),
    svc.from("affiliate_commissions")
      .select("id,user_id,stripe_invoice_id,currency,collected_cents,tax_cents,commissionable_cents,commission_cents,refunded_cents,reversed_commission_cents,paid_at,available_at")
      .eq("affiliate_id", affiliateId)
      .order("paid_at", { ascending: false })
      .limit(250),
    svc.from("affiliate_payouts")
      .select("id,currency,amount_cents,status,method,reference,notes,created_at,paid_at")
      .eq("affiliate_id", affiliateId)
      .order("created_at", { ascending: false })
      .limit(100),
  ]);
  if (attributions.error || commissions.error || payouts.error) {
    throw new AffiliateAdminError("affiliate_detail_failed");
  }

  const userIds = [...new Set([
    ...(attributions.data || []).map((row) => row.user_id),
    ...(commissions.data || []).map((row) => row.user_id),
  ])];
  const emails = new Map<string, string>();
  if (userIds.length) {
    const profiles = await svc.from("profiles").select("id,email").in("id", userIds);
    if (profiles.error) throw new AffiliateAdminError("affiliate_profile_lookup_failed");
    for (const row of profiles.data || []) emails.set(row.id, row.email || "");
  }

  return {
    attributions: (attributions.data || []).map((row) => ({
      ...row,
      email: emails.get(row.user_id) || null,
    })),
    commissions: (commissions.data || []).map((row) => ({
      ...row,
      email: emails.get(row.user_id) || null,
    })),
    payouts: payouts.data || [],
  };
}

function affiliateSlug(value: unknown): string | null {
  const slug = String(value || "").trim().toLowerCase();
  return /^[a-z0-9][a-z0-9-]{1,47}[a-z0-9]$/.test(slug) ? slug : null;
}

function displayName(value: unknown): string | null {
  const name = String(value || "").trim();
  return name && name.length <= 100 ? name : null;
}

async function createAffiliate(admin: AdminIdentity, body: Record<string, unknown>) {
  const slug = affiliateSlug(body.slug);
  const name = displayName(body.display_name);
  if (!slug) throw new AffiliateAdminError("affiliate_slug_invalid", 400);
  if (!name) throw new AffiliateAdminError("affiliate_name_invalid", 400);

  const { data, error } = await svc.from("affiliates").insert({
    slug,
    display_name: name,
    status: "active",
    commission_bps: 3000,
    attribution_window_days: 30,
    commission_months: 12,
    hold_days: 30,
    minimum_payout_cents: 5000,
    created_by: admin.id,
    updated_by: admin.id,
  }).select("*").single();
  if (error) {
    if (error.code === "23505") {
      throw new AffiliateAdminError("affiliate_slug_exists", 409);
    }
    throw new AffiliateAdminError("affiliate_create_failed");
  }
  return { affiliate: data };
}

async function updateAffiliate(admin: AdminIdentity, body: Record<string, unknown>) {
  const affiliateId = uuid(body.affiliate_id);
  const name = displayName(body.display_name);
  const status = String(body.status || "");
  if (!affiliateId) throw new AffiliateAdminError("affiliate_id_invalid", 400);
  if (!name) throw new AffiliateAdminError("affiliate_name_invalid", 400);
  if (!["active", "paused", "archived"].includes(status)) {
    throw new AffiliateAdminError("affiliate_status_invalid", 400);
  }

  const { data, error } = await svc.from("affiliates").update({
    display_name: name,
    status,
    updated_by: admin.id,
  }).eq("id", affiliateId).select("*").maybeSingle();
  if (error) throw new AffiliateAdminError("affiliate_update_failed");
  if (!data) throw new AffiliateAdminError("affiliate_not_found", 404);
  return { affiliate: data };
}

async function recordPayout(admin: AdminIdentity, body: Record<string, unknown>) {
  const affiliateId = uuid(body.affiliate_id);
  const reference = String(body.reference || "").trim();
  const notes = String(body.notes || "").trim();
  if (!affiliateId) throw new AffiliateAdminError("affiliate_id_invalid", 400);
  if (body.confirmed !== true || body.confirmation_text !== "PAID") {
    throw new AffiliateAdminError("payout_confirmation_required", 400);
  }
  if (!reference || reference.length > 200) {
    throw new AffiliateAdminError("payout_reference_required", 400);
  }

  const { data, error } = await svc.rpc("create_affiliate_payout", {
    p_affiliate: affiliateId,
    p_actor: admin.id,
    p_currency: String(body.currency || "usd").toLowerCase(),
    p_reference: reference,
    p_notes: notes || null,
  });
  if (error) {
    const known = [
      "payout_balance_empty",
      "payout_minimum_not_met",
      "payout_reference_required",
      "affiliate_not_found",
    ].find((code) => error.message.includes(code));
    if (known) throw new AffiliateAdminError(known, 409);
    throw new AffiliateAdminError("payout_record_failed");
  }
  return { payout: data };
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

  try {
    const admin = await requireAdmin(req);
    const body = await req.json().catch(() => ({})) as Record<string, unknown>;
    const action = String(body.action || "");

    if (action === "list") {
      await consumeRateLimit(admin.id, "read");
      return affiliateJson(req, await listAffiliates());
    }
    if (action === "detail") {
      await consumeRateLimit(admin.id, "read");
      const affiliateId = uuid(body.affiliate_id);
      if (!affiliateId) throw new AffiliateAdminError("affiliate_id_invalid", 400);
      return affiliateJson(req, await affiliateDetail(affiliateId));
    }

    await consumeRateLimit(admin.id, "write");
    if (action === "create") {
      return affiliateJson(req, await createAffiliate(admin, body));
    }
    if (action === "update") {
      return affiliateJson(req, await updateAffiliate(admin, body));
    }
    if (action === "record_payout") {
      return affiliateJson(req, await recordPayout(admin, body));
    }
    throw new AffiliateAdminError("action_invalid", 400);
  } catch (error) {
    if (error instanceof AffiliateAdminError) {
      const headers = error.status === 429 ? { "Retry-After": "60" } : {};
      return affiliateJson(req, { error: error.code }, error.status, headers);
    }
    console.error("affiliate-admin:", error);
    return affiliateJson(req, { error: "affiliate_admin_failed" }, 500);
  }
});
