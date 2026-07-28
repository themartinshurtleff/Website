# Client Announcements Runbook

## Purpose

This system lets a TradeNet administrator create, schedule, target, publish,
revise, and archive notices for authenticated web and desktop terminal clients.

Announcements are communication. They do not enable maintenance mode, disable
trading, change entitlements, enforce minimum versions, or control either
market-data server. Those controls must remain server-authoritative and must use
separate contracts.

## Components

| Component | Responsibility |
| --- | --- |
| `client_announcements` | Current draft, published, and archived announcement rows |
| `client_announcement_state` | Monotonic authoritative snapshot revision |
| `client_announcement_audit` | Immutable mutation history |
| `client_announcement_rate_limits` | Database-backed per-user request buckets |
| `admin-announcements` | MFA-protected admin read and mutation API |
| `client-announcement-snapshot` | Authenticated, filtered client snapshot API |
| `client:announcements` | Private Supabase Broadcast invalidation topic |
| Website admin dashboard | Announcement authoring and audit interface |

Clients never read or write the announcement tables. Both browser and terminal
clients obtain content from `client-announcement-snapshot`.

## Security Boundary

- Both Edge Functions verify the bearer with Supabase Auth inside the function.
- `admin-announcements` also requires a current `profiles.access_tier = 'admin'`
  row and an Authenticator Assurance Level of `aal2`.
- AAL2 is provided by a verified TOTP factor. Email or password login alone is
  not enough.
- Table access and privileged RPC execution are revoked from `anon` and
  `authenticated`.
- Edge Functions hold the service role credential supplied by Supabase. It is
  never included in Website or terminal assets.
- Realtime clients may receive the exact private Broadcast topic. No client
  policy permits sending to it.
- Announcement action links must use HTTPS and an exact configured hostname.
- Announcement bodies are plain text. HTML and control characters are rejected.
- Mutations use UUID request IDs for idempotency and expected revisions for
  optimistic concurrency.
- Publish, archive, and live revision actions require explicit confirmation.
  High-impact publication and all live revisions require typed confirmation.
- Audit rows reject update and delete operations.
- Browser origins use an exact allowlist. Native clients without an Origin
  header are still authenticated by bearer.

## Environment Variables

Set these as Supabase project secrets. Do not put them in `.env` files shipped
to a browser or Tauri bundle.

```text
CLIENT_ANNOUNCEMENTS_ENABLED=false
ANNOUNCEMENT_ACTION_HOSTS=tradenet.org,www.tradenet.org
ANNOUNCEMENT_ALLOWED_ORIGINS=https://tradenet.org,https://www.tradenet.org,https://app.tradenet.org,tauri://localhost,http://tauri.localhost
```

Local development origins may be added in staging:

```text
http://localhost:5173,http://127.0.0.1:5175
```

Quote comma-delimited values when calling the Supabase CLI from PowerShell:

```powershell
npx supabase secrets set --project-ref <project-ref> `
  "ANNOUNCEMENT_ACTION_HOSTS=tradenet.org,www.tradenet.org" `
  "ANNOUNCEMENT_ALLOWED_ORIGINS=https://tradenet.org,https://www.tradenet.org,https://app.tradenet.org,tauri://localhost,http://tauri.localhost"
```

## Database Deployment

The database changes are:

1. `010_client_announcements.sql`
2. `011_client_announcement_actor_retention.sql`

Before pushing a linked project, inspect all pending migrations:

```powershell
npx supabase migration list --linked
```

`supabase db push --linked` applies every pending migration in order. It must
not be used against production until older pending Website migrations have been
reviewed and approved for that environment.

For a clean environment:

```powershell
npx supabase link --project-ref <project-ref>
npx supabase db push --linked
npx supabase db lint --linked --schema public --level warning
```

## Edge Function Deployment

JWT gateway verification must remain enabled for both functions:

```powershell
npx supabase functions deploy admin-announcements `
  --project-ref <project-ref>

npx supabase functions deploy client-announcement-snapshot `
  --project-ref <project-ref>
```

Do not deploy either function with `--no-verify-jwt`.

Keep `CLIENT_ANNOUNCEMENTS_ENABLED=false` until the schema, functions, admin MFA,
and client behavior have passed staging. The disabled response is intentional:

```json
{"error":"announcements_disabled"}
```

## Admin Activation

1. Confirm the operator has a current `profiles` row with
   `access_tier = 'admin'`.
2. Sign into `/admin/dashboard`.
3. Open `Announcements`.
4. Enroll a TOTP authenticator when prompted.
5. Verify a current six-digit TOTP code.
6. Create a draft targeted only to `internal` or a disposable staging account.
7. Publish and confirm it appears in the client snapshot.
8. Archive it and confirm it disappears.

Verified factors cannot be removed in the announcement interface. Factor
recovery and removal remain an explicit Supabase account administration action.

## Staging Verification

The integration verifier requires credentials only through process environment
variables. It creates disposable accounts and cleans them after the run:

```powershell
$env:TN_SUPABASE_URL = "https://<project-ref>.supabase.co"
$env:TN_SUPABASE_ANON_KEY = "<publishable-or-anon-key>"
$env:TN_SUPABASE_SERVICE_ROLE_KEY = "<service-role-key>"
node scripts/verify-announcements-staging.cjs
Remove-Item Env:TN_SUPABASE_URL
Remove-Item Env:TN_SUPABASE_ANON_KEY
Remove-Item Env:TN_SUPABASE_SERVICE_ROLE_KEY
```

Never paste those values into source, shell history shared with another person,
an issue, a handoff, or client logs.

The verifier checks:

- direct table read and write denial;
- direct privileged RPC denial;
- AAL1 admin denial;
- AAL2 admin acceptance;
- AAL2 non-admin denial;
- hostile browser origin denial;
- mutation idempotency;
- explicit publish confirmation;
- authoritative snapshot filtering and sanitization;
- semantic version targeting;
- private Broadcast delivery;
- forged client Broadcast denial;
- optimistic revision conflict handling;
- archive removal;
- audit completeness.

Run the pure validation suite too:

```powershell
npx -y deno check --no-lock `
  supabase/functions/admin-announcements/index.ts `
  supabase/functions/client-announcement-snapshot/index.ts `
  supabase/functions/_shared/announcements.test.ts

npx -y deno test --no-lock `
  supabase/functions/_shared/announcements.test.ts
```

## Production Rollout

1. Review every migration pending in production, including migrations older
   than `010`.
2. Confirm current production backups and recovery access.
3. Apply the reviewed migration sequence.
4. Run database lint.
5. Set allowlist secrets with `CLIENT_ANNOUNCEMENTS_ENABLED=false`.
6. Deploy both functions with gateway JWT verification enabled.
7. Deploy the Website admin interface.
8. Confirm a production admin can complete AAL2.
9. Enable the announcement feature.
10. Publish a short internal or tightly targeted smoke-test notice.
11. Verify snapshot, Broadcast invalidation, polling, revision, and archive from
    a signed production client build.
12. Review Edge Function logs and the immutable audit row.

## Disable And Recovery

The fastest application-level disable is:

```powershell
npx supabase secrets set --project-ref <project-ref> `
  CLIENT_ANNOUNCEMENTS_ENABLED=false
```

This blocks both authoring and snapshots with `503`. Already cached client
content follows the frontend cache policy and expires locally.

If Realtime is unhealthy, do not disable snapshots. Clients are designed to
continue through focus refresh and polling.

If an admin account is compromised:

1. Revoke its sessions and remove its admin tier.
2. Remove or reset its MFA factors through trusted Supabase administration.
3. Rotate relevant credentials if exposure is possible.
4. Review `client_announcement_audit` by `actor_id` and time.
5. Archive any unauthorized published rows with a different trusted admin.

Actor UUIDs remain in announcement and audit history even if the Auth user is
deleted. This is intentional for incident review.

## Current Environment State

As of 2026-07-28:

- staging project `ijmgrrxqkigcqfsonueq` has migrations `010` and `011`;
- both Edge Functions are deployed in staging with JWT verification enabled;
- staging announcements are enabled for integration testing;
- the complete staging verifier passes;
- production project `edslmmldgknvyxujrbtx` has not received this system;
- production must not be pushed until its earlier pending Website migrations
  are reviewed as one ordered rollout.
