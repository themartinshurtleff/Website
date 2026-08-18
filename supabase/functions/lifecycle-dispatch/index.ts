import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import {
  type LifecycleEvent,
  type LifecycleProfile,
  LifecycleProviderError,
  lifecycleProviderFromEnv,
} from "../_shared/lifecycle.ts";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL") || "";
const SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || "";
const DISPATCH_SECRET = Deno.env.get("LIFECYCLE_DISPATCH_SECRET") || "";

type LifecycleJob = {
  id: string;
  user_id: string;
  operation: "profile_sync" | "marketing_subscribe" | "event";
  event_name: string | null;
  event_time: string | null;
  properties: Record<string, unknown>;
  attempts: number;
};

function response(body: Record<string, unknown>, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      "Content-Type": "application/json",
      "Cache-Control": "no-store",
    },
  });
}

async function secureEqual(left: string, right: string): Promise<boolean> {
  if (!left || !right) return false;
  const encoder = new TextEncoder();
  const [leftHash, rightHash] = await Promise.all([
    crypto.subtle.digest("SHA-256", encoder.encode(left)),
    crypto.subtle.digest("SHA-256", encoder.encode(right)),
  ]);
  const a = new Uint8Array(leftHash);
  const b = new Uint8Array(rightHash);
  let mismatch = a.length ^ b.length;
  for (let index = 0; index < Math.min(a.length, b.length); index++) {
    mismatch |= a[index] ^ b[index];
  }
  return mismatch === 0;
}

function lifecycleProfile(row: Record<string, unknown>): LifecycleProfile {
  return {
    userId: String(row.id || ""),
    email: String(row.email || "").trim().toLowerCase(),
    createdAt: String(row.created_at || ""),
    marketingOptIn: row.marketing_opt_in === true,
    signupSource: typeof row.signup_source === "string"
      ? row.signup_source
      : null,
    cohort: typeof row.cohort === "string" ? row.cohort : null,
    subscriptionTier: typeof row.subscription_tier === "string"
      ? row.subscription_tier
      : null,
    accessTier: typeof row.access_tier === "string" ? row.access_tier : null,
    accessStatus: typeof row.access_status === "string"
      ? row.access_status
      : null,
    billingStatus: typeof row.billing_status === "string"
      ? row.billing_status
      : null,
    terminalAccess: row.terminal_access === true,
    foundingMemberNumber: typeof row.founding_member_number === "number"
      ? row.founding_member_number
      : null,
  };
}

function retryDelay(job: LifecycleJob, error: LifecycleProviderError): number {
  const exponential = Math.min(
    21_600,
    30 * (2 ** Math.max(0, job.attempts - 1)),
  );
  const providerDelay = Math.min(21_600, Math.max(0, error.retryAfterSeconds));
  const subscriptionFloor = job.operation === "marketing_subscribe" ? 1_800 : 0;
  return Math.max(exponential, providerDelay, subscriptionFloor);
}

Deno.serve(async (req) => {
  if (req.method !== "POST") {
    return response({ error: "method_not_allowed" }, 405);
  }
  if (!SUPABASE_URL || !SERVICE_ROLE_KEY || !DISPATCH_SECRET) {
    return response({ error: "server_not_configured" }, 503);
  }
  if (
    !await secureEqual(
      req.headers.get("x-lifecycle-dispatch-secret") || "",
      DISPATCH_SECRET,
    )
  ) {
    return response({ error: "unauthorized" }, 401);
  }

  const worker = crypto.randomUUID();
  const service = createClient(SUPABASE_URL, SERVICE_ROLE_KEY, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  let provider;
  try {
    provider = lifecycleProviderFromEnv();
  } catch (error) {
    console.error(
      "lifecycle provider unavailable",
      error instanceof Error ? error.message : "unknown",
    );
    return response({ error: "provider_not_configured" }, 503);
  }

  const { data: claimed, error: claimError } = await service.rpc(
    "claim_lifecycle_jobs",
    {
      p_worker: worker,
      p_limit: 20,
    },
  );
  if (claimError) {
    console.error("lifecycle claim failed", claimError.code);
    return response({ error: "claim_failed" }, 500);
  }

  const jobs = (claimed || []) as LifecycleJob[];
  let delivered = 0;
  let retried = 0;
  let deadLettered = 0;
  let skipped = 0;

  for (const job of jobs) {
    const { data: profileRow, error: profileError } = await service
      .from("profiles")
      .select(
        "id,email,created_at,marketing_opt_in,signup_source,cohort,subscription_tier,access_tier,access_status,billing_status,terminal_access,founding_member_number",
      )
      .eq("id", job.user_id)
      .maybeSingle();

    if (profileError || !profileRow?.email) {
      const { error: completeError } = await service.rpc(
        "complete_lifecycle_job",
        {
          p_job_id: job.id,
          p_worker: worker,
          p_provider_status: null,
          p_provider_result: { skipped: "profile_missing" },
        },
      );
      if (completeError) {
        console.error("lifecycle skip completion failed", completeError.code);
      }
      skipped++;
      continue;
    }

    const profile = lifecycleProfile(profileRow);
    try {
      const providerProfileId = await provider.upsertProfile(profile);
      const { error: mappingError } = await service
        .from("lifecycle_provider_profiles")
        .upsert({
          user_id: profile.userId,
          provider: "klaviyo",
          provider_profile_id: providerProfileId,
          synced_email: profile.email,
          last_synced_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        }, { onConflict: "user_id" });
      if (mappingError) {
        console.error("lifecycle provider mapping failed", mappingError.code);
      }

      if (job.operation === "marketing_subscribe") {
        if (!profile.marketingOptIn) {
          const { error: completeError } = await service.rpc(
            "complete_lifecycle_job",
            {
              p_job_id: job.id,
              p_worker: worker,
              p_provider_status: 200,
              p_provider_result: { skipped: "marketing_opt_out" },
            },
          );
          if (completeError) {
            console.error(
              "lifecycle opt-out completion failed",
              completeError.code,
            );
          }
          skipped++;
          continue;
        }
        await provider.subscribeMarketing(profile, providerProfileId);
      } else if (job.operation === "event") {
        const event: LifecycleEvent = {
          name: job.event_name || "",
          time: job.event_time || new Date().toISOString(),
          uniqueId: job.id,
          properties: job.properties || {},
        };
        await provider.trackEvent(profile, providerProfileId, event);
      }

      const status = job.operation === "profile_sync" ? 200 : 202;
      const { data: completed, error: completeError } = await service.rpc(
        "complete_lifecycle_job",
        {
          p_job_id: job.id,
          p_worker: worker,
          p_provider_status: status,
          p_provider_result: {
            provider: "klaviyo",
            provider_profile_id: providerProfileId,
            operation: job.operation,
          },
        },
      );
      if (completeError || !completed) {
        console.error(
          "lifecycle completion failed",
          completeError?.code || "lock_lost",
        );
      }
      delivered++;
    } catch (error) {
      const providerError = error instanceof LifecycleProviderError
        ? error
        : new LifecycleProviderError("lifecycle_delivery_failed", {
          retryable: true,
        });
      const retryable = providerError.retryable && job.attempts < 8;
      const { error: failError } = await service.rpc("fail_lifecycle_job", {
        p_job_id: job.id,
        p_worker: worker,
        p_retryable: retryable,
        p_retry_after_seconds: retryDelay(job, providerError),
        p_error: providerError.message,
        p_provider_status: providerError.status,
        p_provider_result: {
          provider: "klaviyo",
          code: providerError.providerCode,
        },
      });
      if (failError) {
        console.error("lifecycle failure recording failed", failError.code);
      }
      if (retryable) retried++;
      else deadLettered++;
    }
  }

  return response({
    claimed: jobs.length,
    delivered,
    retried,
    dead_lettered: deadLettered,
    skipped,
  });
});
