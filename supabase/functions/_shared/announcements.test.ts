import {
  AnnouncementValidationError,
  compareSemver,
  parseSemver,
  validateAnnouncementPayload,
  validateClientContext,
  versionMatches,
} from "./announcements.ts";

function assert(condition: unknown, message = "assertion_failed"): asserts condition {
  if (!condition) throw new Error(message);
}

function assertThrows(fn: () => unknown, field?: string): void {
  let thrown: unknown;
  try {
    fn();
  } catch (error) {
    thrown = error;
  }
  assert(thrown instanceof AnnouncementValidationError, "expected_validation_error");
  if (field) assert(thrown.field === field, `expected_${field}_got_${thrown.field}`);
}

function validPayload() {
  return {
    severity: "info",
    title: "Beta update",
    body: "A new terminal build is available.",
    starts_at: "2026-07-28T12:00:00.000Z",
    ends_at: null,
    platforms: ["all"],
    channels: ["beta"],
    min_version: "0.2.0-beta.1",
    max_version: "0.2.0",
    access_tiers: [],
    service_scopes: ["terminal"],
    dismissible: true,
    requires_ack: false,
    action_label: "Read release notes",
    action_url: "https://www.tradenet.org/docs/releases",
  };
}

Deno.test("SemVer parsing and prerelease ordering", () => {
  assert(parseSemver("0.2.0-beta.12") !== null);
  assert(parseSemver("01.2.3") === null);
  assert(compareSemver("0.2.0-beta.12", "0.2.0") < 0);
  assert(compareSemver("0.2.0-beta.12", "0.2.0-beta.2") > 0);
  assert(versionMatches("0.2.0-beta.12", "0.2.0-beta.1", "0.2.0"));
  assert(!versionMatches("0.1.9", "0.2.0-beta.1", null));
});

Deno.test("announcement payload canonicalizes safe plain text", () => {
  const payload = validateAnnouncementPayload(
    validPayload(),
    new Set(["www.tradenet.org"]),
  );
  assert(payload.title === "Beta update");
  assert(payload.action_url === "https://www.tradenet.org/docs/releases");
  assert(payload.platforms.length === 1 && payload.platforms[0] === "all");
});

Deno.test("announcement payload rejects HTML and unapproved actions", () => {
  assertThrows(
    () =>
      validateAnnouncementPayload(
        { ...validPayload(), body: "<script>alert(1)</script>" },
        new Set(["www.tradenet.org"]),
      ),
    "body",
  );
  assertThrows(
    () =>
      validateAnnouncementPayload(
        { ...validPayload(), action_url: "https://example.com/phish" },
        new Set(["www.tradenet.org"]),
      ),
    "action_url",
  );
});

Deno.test("acknowledgement notices cannot use generic dismissal", () => {
  assertThrows(
    () =>
      validateAnnouncementPayload(
        { ...validPayload(), requires_ack: true, dismissible: true },
        new Set(["www.tradenet.org"]),
      ),
    "dismissible",
  );
});

Deno.test("platform all is exclusive and schedule must be ordered", () => {
  assertThrows(
    () =>
      validateAnnouncementPayload(
        { ...validPayload(), platforms: ["all", "web"] },
        new Set(["www.tradenet.org"]),
      ),
    "platforms",
  );
  assertThrows(
    () =>
      validateAnnouncementPayload(
        { ...validPayload(), ends_at: "2026-07-28T11:00:00.000Z" },
        new Set(["www.tradenet.org"]),
      ),
    "ends_at",
  );
});

Deno.test("client context requires explicit desktop OS and valid version", () => {
  const desktop = validateClientContext({
    platform: "desktop",
    os: "windows",
    channel: "beta",
    version: "0.2.0-beta.12",
  });
  assert(desktop.os === "windows");
  assertThrows(
    () =>
      validateClientContext({
        platform: "desktop",
        os: null,
        channel: "beta",
        version: "0.2.0-beta.12",
      }),
    "os",
  );
  assertThrows(
    () =>
      validateClientContext({
        platform: "web",
        os: null,
        channel: "beta",
        version: "latest",
      }),
    "version",
  );
});
