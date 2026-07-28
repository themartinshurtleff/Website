export const ANNOUNCEMENT_SCHEMA_VERSION = 1;

export const ANNOUNCEMENT_SEVERITIES = [
  "info",
  "warning",
  "maintenance",
  "critical",
  "release",
] as const;
export const ANNOUNCEMENT_PLATFORMS = [
  "all",
  "web",
  "desktop",
  "windows",
  "macos",
] as const;
export const ANNOUNCEMENT_CHANNELS = ["beta", "stable", "internal"] as const;
export const ANNOUNCEMENT_ACCESS_TIERS = [
  "waitlist",
  "free",
  "referral_verified",
  "beta",
  "pro",
  "admin",
] as const;
export const ANNOUNCEMENT_SERVICE_SCOPES = [
  "all",
  "terminal",
  "website",
  "auth",
  "market_data",
  "execution",
] as const;

type PrereleasePart = number | string;

type ParsedSemver = {
  major: number;
  minor: number;
  patch: number;
  prerelease: PrereleasePart[];
};

export type AnnouncementPayload = {
  severity: typeof ANNOUNCEMENT_SEVERITIES[number];
  title: string;
  body: string;
  starts_at: string;
  ends_at: string | null;
  platforms: string[];
  channels: string[];
  min_version: string | null;
  max_version: string | null;
  access_tiers: string[];
  service_scopes: string[];
  dismissible: boolean;
  requires_ack: boolean;
  action_label: string | null;
  action_url: string | null;
};

export class AnnouncementValidationError extends Error {
  field: string;

  constructor(field: string, message: string) {
    super(message);
    this.name = "AnnouncementValidationError";
    this.field = field;
  }
}

const SEMVER_RE =
  /^(0|[1-9]\d*)\.(0|[1-9]\d*)\.(0|[1-9]\d*)(?:-((?:0|[1-9]\d*|[0-9A-Za-z-]*[A-Za-z-][0-9A-Za-z-]*)(?:\.(?:0|[1-9]\d*|[0-9A-Za-z-]*[A-Za-z-][0-9A-Za-z-]*))*))?(?:\+[0-9A-Za-z-]+(?:\.[0-9A-Za-z-]+)*)?$/;
const HTML_TAG_RE = /<\/?[a-z][^>]*>/i;
const CONTROL_CHAR_RE = /[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/;

export function parseSemver(value: string): ParsedSemver | null {
  const match = SEMVER_RE.exec(value.trim());
  if (!match) return null;
  const prerelease = match[4]
    ? match[4].split(".").map((part) => /^\d+$/.test(part) ? Number(part) : part)
    : [];
  return {
    major: Number(match[1]),
    minor: Number(match[2]),
    patch: Number(match[3]),
    prerelease,
  };
}

function comparePrerelease(a: PrereleasePart[], b: PrereleasePart[]): number {
  if (a.length === 0 && b.length === 0) return 0;
  if (a.length === 0) return 1;
  if (b.length === 0) return -1;

  const length = Math.max(a.length, b.length);
  for (let index = 0; index < length; index += 1) {
    if (index >= a.length) return -1;
    if (index >= b.length) return 1;
    const left = a[index];
    const right = b[index];
    if (left === right) continue;
    if (typeof left === "number" && typeof right === "number") {
      return left < right ? -1 : 1;
    }
    if (typeof left === "number") return -1;
    if (typeof right === "number") return 1;
    return left < right ? -1 : 1;
  }
  return 0;
}

export function compareSemver(left: string, right: string): number {
  const a = parseSemver(left);
  const b = parseSemver(right);
  if (!a || !b) throw new Error("invalid_semver");
  if (a.major !== b.major) return a.major < b.major ? -1 : 1;
  if (a.minor !== b.minor) return a.minor < b.minor ? -1 : 1;
  if (a.patch !== b.patch) return a.patch < b.patch ? -1 : 1;
  return comparePrerelease(a.prerelease, b.prerelease);
}

export function versionMatches(
  version: string,
  minVersion: string | null | undefined,
  maxVersion: string | null | undefined,
): boolean {
  if (!parseSemver(version)) return false;
  if (minVersion && compareSemver(version, minVersion) < 0) return false;
  if (maxVersion && compareSemver(version, maxVersion) > 0) return false;
  return true;
}

function requiredText(
  value: unknown,
  field: string,
  min: number,
  max: number,
): string {
  if (typeof value !== "string") {
    throw new AnnouncementValidationError(field, `${field}_required`);
  }
  const text = value.trim();
  if (text.length < min || text.length > max) {
    throw new AnnouncementValidationError(field, `${field}_length`);
  }
  if (CONTROL_CHAR_RE.test(text)) {
    throw new AnnouncementValidationError(field, `${field}_control_characters`);
  }
  return text;
}

function optionalText(
  value: unknown,
  field: string,
  max: number,
): string | null {
  if (value === null || value === undefined || value === "") return null;
  return requiredText(value, field, 1, max);
}

function enumValue<T extends readonly string[]>(
  value: unknown,
  field: string,
  allowed: T,
): T[number] {
  if (typeof value !== "string" || !allowed.includes(value)) {
    throw new AnnouncementValidationError(field, `${field}_invalid`);
  }
  return value as T[number];
}

function enumArray<T extends readonly string[]>(
  value: unknown,
  field: string,
  allowed: T,
  allowEmpty: boolean,
): string[] {
  if (!Array.isArray(value)) {
    throw new AnnouncementValidationError(field, `${field}_required`);
  }
  const entries = [...new Set(value.map((item) => String(item)))];
  if ((!allowEmpty && entries.length === 0) || entries.length > allowed.length) {
    throw new AnnouncementValidationError(field, `${field}_invalid`);
  }
  if (entries.some((entry) => !allowed.includes(entry))) {
    throw new AnnouncementValidationError(field, `${field}_invalid`);
  }
  return entries;
}

function timestamp(
  value: unknown,
  field: string,
  required: boolean,
): string | null {
  if (value === null || value === undefined || value === "") {
    if (required) {
      throw new AnnouncementValidationError(field, `${field}_required`);
    }
    return null;
  }
  if (typeof value !== "string") {
    throw new AnnouncementValidationError(field, `${field}_invalid`);
  }
  const parsed = Date.parse(value);
  if (!Number.isFinite(parsed)) {
    throw new AnnouncementValidationError(field, `${field}_invalid`);
  }
  return new Date(parsed).toISOString();
}

function booleanValue(value: unknown, field: string): boolean {
  if (typeof value !== "boolean") {
    throw new AnnouncementValidationError(field, `${field}_required`);
  }
  return value;
}

export function allowedActionHosts(): Set<string> {
  const configured = Deno.env.get("ANNOUNCEMENT_ACTION_HOSTS") ||
    "tradenet.org,www.tradenet.org";
  return new Set(
    configured.split(",").map((host) => host.trim().toLowerCase()).filter(Boolean),
  );
}

function validateActionUrl(value: string | null, hosts: Set<string>): string | null {
  if (value === null) return null;
  let parsed: URL;
  try {
    parsed = new URL(value);
  } catch {
    throw new AnnouncementValidationError("action_url", "action_url_invalid");
  }
  if (
    parsed.protocol !== "https:" ||
    parsed.username ||
    parsed.password ||
    parsed.port ||
    !hosts.has(parsed.hostname.toLowerCase())
  ) {
    throw new AnnouncementValidationError("action_url", "action_url_not_allowed");
  }
  return parsed.toString();
}

export function validateAnnouncementPayload(
  input: unknown,
  hosts = allowedActionHosts(),
): AnnouncementPayload {
  const value = input && typeof input === "object"
    ? input as Record<string, unknown>
    : {};
  const severity = enumValue(
    value.severity,
    "severity",
    ANNOUNCEMENT_SEVERITIES,
  );
  const title = requiredText(value.title, "title", 1, 120);
  const body = requiredText(value.body, "body", 1, 4000);
  if (HTML_TAG_RE.test(title) || HTML_TAG_RE.test(body)) {
    throw new AnnouncementValidationError("body", "html_not_allowed");
  }

  const startsAt = timestamp(value.starts_at, "starts_at", true)!;
  const endsAt = timestamp(value.ends_at, "ends_at", false);
  if (endsAt && Date.parse(endsAt) <= Date.parse(startsAt)) {
    throw new AnnouncementValidationError("ends_at", "ends_at_before_start");
  }

  const platforms = enumArray(
    value.platforms,
    "platforms",
    ANNOUNCEMENT_PLATFORMS,
    false,
  );
  if (platforms.includes("all") && platforms.length > 1) {
    throw new AnnouncementValidationError("platforms", "platforms_all_exclusive");
  }
  const channels = enumArray(
    value.channels,
    "channels",
    ANNOUNCEMENT_CHANNELS,
    false,
  );
  const accessTiers = enumArray(
    value.access_tiers,
    "access_tiers",
    ANNOUNCEMENT_ACCESS_TIERS,
    true,
  );
  const serviceScopes = enumArray(
    value.service_scopes,
    "service_scopes",
    ANNOUNCEMENT_SERVICE_SCOPES,
    true,
  );
  if (serviceScopes.includes("all") && serviceScopes.length > 1) {
    throw new AnnouncementValidationError(
      "service_scopes",
      "service_scopes_all_exclusive",
    );
  }

  const minVersion = optionalText(value.min_version, "min_version", 64);
  const maxVersion = optionalText(value.max_version, "max_version", 64);
  if (minVersion && !parseSemver(minVersion)) {
    throw new AnnouncementValidationError("min_version", "min_version_invalid");
  }
  if (maxVersion && !parseSemver(maxVersion)) {
    throw new AnnouncementValidationError("max_version", "max_version_invalid");
  }
  if (minVersion && maxVersion && compareSemver(minVersion, maxVersion) > 0) {
    throw new AnnouncementValidationError("max_version", "version_range_invalid");
  }

  const requiresAck = booleanValue(value.requires_ack, "requires_ack");
  const dismissible = booleanValue(value.dismissible, "dismissible");
  if (requiresAck && dismissible) {
    throw new AnnouncementValidationError("dismissible", "ack_must_not_dismiss");
  }

  const actionLabel = optionalText(value.action_label, "action_label", 40);
  const actionUrlInput = optionalText(value.action_url, "action_url", 2048);
  if ((actionLabel === null) !== (actionUrlInput === null)) {
    throw new AnnouncementValidationError("action_url", "action_pair_required");
  }
  const actionUrl = validateActionUrl(actionUrlInput, hosts);

  return {
    severity,
    title,
    body,
    starts_at: startsAt,
    ends_at: endsAt,
    platforms,
    channels,
    min_version: minVersion,
    max_version: maxVersion,
    access_tiers: accessTiers,
    service_scopes: serviceScopes,
    dismissible,
    requires_ack: requiresAck,
    action_label: actionLabel,
    action_url: actionUrl,
  };
}

export function validateClientContext(input: unknown): {
  platform: "web" | "desktop";
  os: "windows" | "macos" | null;
  channel: "beta" | "stable" | "internal";
  version: string;
} {
  const value = input && typeof input === "object"
    ? input as Record<string, unknown>
    : {};
  const platform = enumValue(
    value.platform,
    "platform",
    ["web", "desktop"] as const,
  );
  const os = value.os === null || value.os === undefined || value.os === ""
    ? null
    : enumValue(value.os, "os", ["windows", "macos"] as const);
  if (platform === "web" && os !== null) {
    throw new AnnouncementValidationError("os", "web_os_must_be_null");
  }
  if (platform === "desktop" && os === null) {
    throw new AnnouncementValidationError("os", "desktop_os_required");
  }
  const channel = enumValue(
    value.channel,
    "channel",
    ANNOUNCEMENT_CHANNELS,
  );
  const version = requiredText(value.version, "version", 1, 64);
  if (!parseSemver(version)) {
    throw new AnnouncementValidationError("version", "version_invalid");
  }
  return { platform, os, channel, version };
}

export function uuid(value: unknown): string | null {
  const text = typeof value === "string" ? value : "";
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i
      .test(text)
    ? text
    : null;
}
