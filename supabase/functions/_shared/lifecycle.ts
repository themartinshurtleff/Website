const KLAVIYO_API_BASE = "https://a.klaviyo.com/api";
const KLAVIYO_REVISION = "2026-07-15";

export type LifecycleProfile = {
  userId: string;
  email: string;
  createdAt: string;
  marketingOptIn: boolean;
  signupSource: string | null;
  cohort: string | null;
  subscriptionTier: string | null;
  accessTier: string | null;
  accessStatus: string | null;
  billingStatus: string | null;
  terminalAccess: boolean;
  foundingMemberNumber: number | null;
};

export type LifecycleEvent = {
  name: string;
  time: string;
  uniqueId: string;
  properties: Record<string, unknown>;
};

type JsonRecord = Record<string, unknown>;

function cleanString(value: unknown, maxLength: number): string | null {
  if (typeof value !== "string") return null;
  const text = value.trim();
  return text ? text.slice(0, maxLength) : null;
}

function compact(properties: JsonRecord): JsonRecord {
  return Object.fromEntries(
    Object.entries(properties).filter(([, value]) =>
      value !== null && value !== undefined
    ),
  );
}

export function sanitizeLifecycleProperties(value: unknown): JsonRecord {
  if (!value || typeof value !== "object" || Array.isArray(value)) return {};
  const output: JsonRecord = {};
  for (
    const [rawKey, rawValue] of Object.entries(value as JsonRecord).slice(0, 64)
  ) {
    const key = cleanString(rawKey, 64);
    if (!key || !/^[A-Za-z0-9_.$ -]+$/.test(key)) continue;
    if (typeof rawValue === "string") output[key] = rawValue.slice(0, 500);
    else if (typeof rawValue === "boolean") output[key] = rawValue;
    else if (typeof rawValue === "number" && Number.isFinite(rawValue)) {
      output[key] = rawValue;
    } else if (Array.isArray(rawValue)) {
      output[key] = rawValue.slice(0, 20).filter((entry) =>
        typeof entry === "string" || typeof entry === "boolean" ||
        (typeof entry === "number" && Number.isFinite(entry))
      ).map((entry) => typeof entry === "string" ? entry.slice(0, 200) : entry);
    }
  }
  return output;
}

export function profileProperties(profile: LifecycleProfile): JsonRecord {
  return compact({
    tradenet_user_id: profile.userId,
    account_created_at: profile.createdAt,
    marketing_opt_in: profile.marketingOptIn,
    signup_source: profile.signupSource,
    cohort: profile.cohort,
    subscription_tier: profile.subscriptionTier,
    access_tier: profile.accessTier,
    access_status: profile.accessStatus,
    billing_status: profile.billingStatus,
    terminal_access: profile.terminalAccess,
    founding_member_number: profile.foundingMemberNumber,
  });
}

export function buildKlaviyoProfilePayload(
  profile: LifecycleProfile,
): JsonRecord {
  return {
    data: {
      type: "profile",
      attributes: {
        email: profile.email.trim().toLowerCase(),
        external_id: profile.userId,
        properties: profileProperties(profile),
      },
    },
  };
}

export function buildKlaviyoSubscriptionPayload(
  profile: LifecycleProfile,
  providerProfileId: string,
  listId: string,
): JsonRecord {
  return {
    data: {
      type: "profile-subscription-bulk-create-job",
      attributes: {
        custom_source: "TradeNet account signup",
        profiles: {
          data: [{
            type: "profile",
            id: providerProfileId,
            attributes: {
              email: profile.email.trim().toLowerCase(),
              subscriptions: {
                email: {
                  marketing: { consent: "SUBSCRIBED" },
                },
              },
            },
          }],
        },
      },
      relationships: {
        list: {
          data: { type: "list", id: listId },
        },
      },
    },
  };
}

export function buildKlaviyoEventPayload(
  profile: LifecycleProfile,
  providerProfileId: string,
  event: LifecycleEvent,
): JsonRecord {
  return {
    data: {
      type: "event",
      attributes: {
        properties: {
          ...sanitizeLifecycleProperties(event.properties),
          access_tier: profile.accessTier || "unknown",
          subscription_tier: profile.subscriptionTier || "free",
          marketing_opt_in: profile.marketingOptIn,
        },
        time: event.time,
        unique_id: event.uniqueId,
        metric: {
          data: {
            type: "metric",
            attributes: { name: event.name },
          },
        },
        profile: {
          data: {
            type: "profile",
            id: providerProfileId,
            attributes: {
              email: profile.email.trim().toLowerCase(),
              external_id: profile.userId,
            },
          },
        },
      },
    },
  };
}

export class LifecycleProviderError extends Error {
  status: number | null;
  retryAfterSeconds: number;
  retryable: boolean;
  providerCode: string | null;

  constructor(
    message: string,
    options: {
      status?: number | null;
      retryAfterSeconds?: number;
      retryable?: boolean;
      providerCode?: string | null;
    } = {},
  ) {
    super(message);
    this.name = "LifecycleProviderError";
    this.status = options.status ?? null;
    this.retryAfterSeconds = options.retryAfterSeconds ?? 0;
    this.retryable = options.retryable ?? true;
    this.providerCode = options.providerCode ?? null;
  }
}

function retryAfterSeconds(response: Response): number {
  const value = response.headers.get("retry-after");
  if (!value) return 0;
  const seconds = Number(value);
  if (Number.isFinite(seconds)) return Math.max(0, Math.ceil(seconds));
  const date = Date.parse(value);
  return Number.isFinite(date)
    ? Math.max(0, Math.ceil((date - Date.now()) / 1000))
    : 0;
}

function safeProviderError(
  payload: unknown,
): { code: string | null; title: string | null } {
  const first =
    (payload as { errors?: Array<{ code?: unknown; title?: unknown }> })?.errors
      ?.[0];
  return {
    code: cleanString(first?.code, 80),
    title: cleanString(first?.title, 120),
  };
}

export class KlaviyoLifecycleProvider {
  #apiKey: string;
  #listId: string;

  constructor(apiKey: string, listId: string) {
    if (!apiKey || !listId) {
      throw new LifecycleProviderError("klaviyo_not_configured", {
        retryable: false,
      });
    }
    this.#apiKey = apiKey;
    this.#listId = listId;
  }

  async #request(
    path: string,
    body: JsonRecord,
    accepted: number[],
  ): Promise<unknown> {
    let response: Response;
    try {
      response = await fetch(`${KLAVIYO_API_BASE}${path}`, {
        method: "POST",
        headers: {
          "Authorization": `Klaviyo-API-Key ${this.#apiKey}`,
          "Accept": "application/vnd.api+json",
          "Content-Type": "application/vnd.api+json",
          "revision": KLAVIYO_REVISION,
        },
        body: JSON.stringify(body),
      });
    } catch {
      throw new LifecycleProviderError("klaviyo_network_error", {
        retryable: true,
      });
    }

    const text = await response.text();
    let payload: unknown = null;
    if (text) {
      try {
        payload = JSON.parse(text);
      } catch {
        payload = null;
      }
    }
    if (accepted.includes(response.status)) return payload;

    const error = safeProviderError(payload);
    const retryable = response.status === 429 || response.status >= 500;
    throw new LifecycleProviderError(
      `klaviyo_request_failed:${response.status}:${error.title || "unknown"}`,
      {
        status: response.status,
        retryAfterSeconds: retryAfterSeconds(response),
        retryable,
        providerCode: error.code,
      },
    );
  }

  async upsertProfile(profile: LifecycleProfile): Promise<string> {
    const payload = await this.#request(
      "/profile-import",
      buildKlaviyoProfilePayload(profile),
      [200, 201],
    ) as { data?: { id?: unknown } } | null;
    const id = cleanString(payload?.data?.id, 128);
    if (!id) {
      throw new LifecycleProviderError("klaviyo_profile_id_missing", {
        retryable: true,
      });
    }
    return id;
  }

  async subscribeMarketing(
    profile: LifecycleProfile,
    providerProfileId: string,
  ): Promise<void> {
    await this.#request(
      "/profile-subscription-bulk-create-jobs",
      buildKlaviyoSubscriptionPayload(profile, providerProfileId, this.#listId),
      [202],
    );
  }

  async trackEvent(
    profile: LifecycleProfile,
    providerProfileId: string,
    event: LifecycleEvent,
  ): Promise<void> {
    await this.#request(
      "/events",
      buildKlaviyoEventPayload(profile, providerProfileId, event),
      [202],
    );
  }
}

export function lifecycleProviderFromEnv(): KlaviyoLifecycleProvider {
  const provider = (Deno.env.get("LIFECYCLE_EMAIL_PROVIDER") || "").trim()
    .toLowerCase();
  if (provider !== "klaviyo") {
    throw new LifecycleProviderError("lifecycle_provider_disabled", {
      retryable: false,
    });
  }
  return new KlaviyoLifecycleProvider(
    Deno.env.get("KLAVIYO_PRIVATE_API_KEY") || "",
    Deno.env.get("KLAVIYO_MAIN_LIST_ID") || "",
  );
}
