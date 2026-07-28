const DEFAULT_ALLOWED_ORIGINS = [
  "https://tradenet.org",
  "https://www.tradenet.org",
  "https://app.tradenet.org",
  "tauri://localhost",
  "http://tauri.localhost",
];

function allowedOrigins(): Set<string> {
  const configured = Deno.env.get("ANNOUNCEMENT_ALLOWED_ORIGINS");
  const origins = configured
    ? configured.split(",").map((value) => value.trim()).filter(Boolean)
    : DEFAULT_ALLOWED_ORIGINS;
  return new Set(origins);
}

export function announcementCors(req: Request): Record<string, string> {
  const origin = req.headers.get("origin");
  if (!origin || !allowedOrigins().has(origin)) {
    return {
      "Access-Control-Allow-Headers":
        "authorization, x-client-info, apikey, content-type",
      "Access-Control-Allow-Methods": "POST, OPTIONS",
      "Vary": "Origin",
    };
  }
  return {
    "Access-Control-Allow-Origin": origin,
    "Access-Control-Allow-Headers":
      "authorization, x-client-info, apikey, content-type",
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    "Access-Control-Max-Age": "86400",
    "Vary": "Origin",
  };
}

export function originAllowed(req: Request): boolean {
  const origin = req.headers.get("origin");
  return !origin || allowedOrigins().has(origin);
}

export function announcementJson(
  req: Request,
  body: Record<string, unknown>,
  status = 200,
  extraHeaders: Record<string, string> = {},
): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      ...announcementCors(req),
      "Content-Type": "application/json",
      "Cache-Control": "no-store",
      ...extraHeaders,
    },
  });
}

export function announcementBearer(req: Request): string {
  const header = req.headers.get("authorization") || "";
  return header.toLowerCase().startsWith("bearer ") ? header.slice(7) : "";
}

export function announcementEnabled(): boolean {
  return (Deno.env.get("CLIENT_ANNOUNCEMENTS_ENABLED") || "false")
    .toLowerCase() === "true";
}
