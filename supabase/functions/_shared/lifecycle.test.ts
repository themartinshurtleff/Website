import {
  buildKlaviyoEventPayload,
  buildKlaviyoProfilePayload,
  buildKlaviyoSubscriptionPayload,
  type LifecycleProfile,
  sanitizeLifecycleProperties,
} from "./lifecycle.ts";

function assert(
  condition: unknown,
  message = "assertion_failed",
): asserts condition {
  if (!condition) throw new Error(message);
}

const profile: LifecycleProfile = {
  userId: "2fd01806-bb52-4a0f-825f-643717e1e579",
  email: "Trader@Example.net",
  createdAt: "2026-08-18T20:00:00.000Z",
  marketingOptIn: true,
  signupSource: "website",
  cohort: "launch",
  subscriptionTier: "free",
  accessTier: "free",
  accessStatus: "active",
  billingStatus: null,
  terminalAccess: true,
  foundingMemberNumber: null,
};

Deno.test("profile upsert uses email and Supabase id as stable identifiers", () => {
  const payload = buildKlaviyoProfilePayload(profile) as any;
  assert(payload.data.type === "profile");
  assert(payload.data.attributes.email === "trader@example.net");
  assert(payload.data.attributes.external_id === profile.userId);
  assert(payload.data.attributes.properties.marketing_opt_in === true);
});

Deno.test("marketing subscription targets the configured list", () => {
  const payload = buildKlaviyoSubscriptionPayload(
    profile,
    "klaviyo-profile",
    "TLnEht",
  ) as any;
  assert(payload.data.relationships.list.data.id === "TLnEht");
  const subscribed = payload.data.attributes.profiles.data[0];
  assert(subscribed.id === "klaviyo-profile");
  assert(
    subscribed.attributes.subscriptions.email.marketing.consent ===
      "SUBSCRIBED",
  );
});

Deno.test("events preserve stable deduplication identifiers", () => {
  const payload = buildKlaviyoEventPayload(profile, "klaviyo-profile", {
    name: "Activated",
    time: "2026-08-18T20:05:00.000Z",
    uniqueId: "9dd9ad7a-82af-4745-92d2-3fa3c5986918",
    properties: { source: "web_terminal", nested: { ignored: true } },
  }) as any;
  assert(payload.data.attributes.metric.data.attributes.name === "Activated");
  assert(
    payload.data.attributes.unique_id ===
      "9dd9ad7a-82af-4745-92d2-3fa3c5986918",
  );
  assert(payload.data.attributes.properties.source === "web_terminal");
  assert(payload.data.attributes.properties.nested === undefined);
});

Deno.test("event properties accept only bounded segment-safe values", () => {
  const properties = sanitizeLifecycleProperties({
    platform: "web",
    success: true,
    count: 1,
    nested: { secret: "ignored" },
    "bad<script>": "ignored",
  });
  assert(properties.platform === "web");
  assert(properties.success === true);
  assert(properties.count === 1);
  assert(properties.nested === undefined);
  assert(properties["bad<script>"] === undefined);
});
