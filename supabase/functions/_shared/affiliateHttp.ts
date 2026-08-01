const DEFAULT_ALLOWED_ORIGINS = [
  "https://tradenet.org",
  "https://www.tradenet.org",
  "https://app.tradenet.org",
];

function configuredOrigins(): Set<string> {
  const configured = Deno.env.get("AFFILIATE_ALLOWED_ORIGINS");
  return new Set(
    configured
      ? configured.split(",").map((value) => value.trim()).filter(Boolean)
      : DEFAULT_ALLOWED_ORIGINS,
  );
}

function localDevelopmentOrigin(origin: string): boolean {
  try {
    const url = new URL(origin);
    return url.protocol === "http:" &&
      (url.hostname === "127.0.0.1" || url.hostname === "localhost");
  } catch {
    return false;
  }
}

export function affiliateOriginAllowed(req: Request): boolean {
  const origin = req.headers.get("origin");
  return !origin || configuredOrigins().has(origin) || localDevelopmentOrigin(origin);
}

export function affiliateCors(req: Request): Record<string, string> {
  const origin = req.headers.get("origin");
  const allowed = origin && affiliateOriginAllowed(req);
  return {
    ...(allowed ? { "Access-Control-Allow-Origin": origin } : {}),
    "Access-Control-Allow-Headers":
      "authorization, x-client-info, apikey, content-type",
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    "Access-Control-Max-Age": "86400",
    "Vary": "Origin",
  };
}

export function affiliateJson(
  req: Request,
  body: Record<string, unknown>,
  status = 200,
  extraHeaders: Record<string, string> = {},
): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      ...affiliateCors(req),
      "Content-Type": "application/json",
      "Cache-Control": "no-store",
      ...extraHeaders,
    },
  });
}

export function affiliateBearer(req: Request): string {
  const header = req.headers.get("authorization") || "";
  return header.toLowerCase().startsWith("bearer ") ? header.slice(7) : "";
}

export function affiliateEnabled(): boolean {
  return (Deno.env.get("AFFILIATE_TRACKING_ENABLED") || "false")
    .toLowerCase() === "true";
}

export function uuid(value: unknown): string | null {
  const text = String(value || "");
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i
      .test(text)
    ? text
    : null;
}
