import { accountOriginAllowed } from "./accountHttp.ts";

function assert(
  condition: unknown,
  message = "assertion_failed",
): asserts condition {
  if (!condition) throw new Error(message);
}

function requestFrom(origin: string): Request {
  return new Request(
    "https://example.supabase.co/functions/v1/lifecycle-event",
    {
      method: "POST",
      headers: { Origin: origin },
    },
  );
}

Deno.test("account endpoints accept exact website and packaged Tauri origins", () => {
  for (
    const origin of [
      "https://tradenet.org",
      "https://www.tradenet.org",
      "https://app.tradenet.org",
      "tauri://localhost",
      "http://tauri.localhost",
      "https://tauri.localhost",
    ]
  ) {
    assert(
      accountOriginAllowed(requestFrom(origin)),
      `origin rejected: ${origin}`,
    );
  }
});

Deno.test("account endpoints reject lookalike remote origins", () => {
  assert(
    !accountOriginAllowed(
      requestFrom("https://app.tradenet.org.attacker.example"),
    ),
  );
  assert(
    !accountOriginAllowed(
      requestFrom("https://tauri.localhost.attacker.example"),
    ),
  );
});
