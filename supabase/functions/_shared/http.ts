export const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
};

export function json(
  body: Record<string, unknown>,
  status = 200,
  cors = true,
): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      ...(cors ? corsHeaders : {}),
      "Content-Type": "application/json",
      "Cache-Control": "no-store",
    },
  });
}

export function bearer(req: Request): string {
  const header = req.headers.get("authorization") || "";
  return header.toLowerCase().startsWith("bearer ") ? header.slice(7) : "";
}

export function envFlag(name: string, fallback = false): boolean {
  const value = Deno.env.get(name);
  if (value == null || value === "") return fallback;
  return value.toLowerCase() === "true";
}
