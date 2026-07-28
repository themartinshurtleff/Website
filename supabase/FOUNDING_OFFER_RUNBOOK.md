# TradeNet Founding Offer Runbook

Last updated: 2026-07-28

## Offer Contract

The founding offer is private. It is not a Stripe coupon and it cannot be
claimed by entering a code.

- Eligible cohort: every unique normalized email present in the TradeNet
  waitlist at the launch snapshot, ordered by earliest signup
- Purchase cap: first 100 completed founding purchases
- Claim window: seven days from the account's individual invitation
- Checkout reservation: 35 minutes while a Stripe Checkout Session is active
- Monthly: $19 per month for three billing periods, then $29 per month
- Annual: $199 for the first billing period, then $284 per year
- Public monthly: $39 per month
- Public annual: $384 per year

Eligibility is identity-bound. The Supabase account email must match the
private cohort email. Migration `012` expands the original 464-row snapshot to
all waitlist members present at launch. Later public waitlist inserts do not
enter the founding cohort automatically.

## Projects

| Environment | Supabase ref | Expected Stripe mode |
| --- | --- | --- |
| Staging | `ijmgrrxqkigcqfsonueq` | Sandbox |
| Production | `edslmmldgknvyxujrbtx` | Live |

Do not copy sandbox Price IDs or signing secrets into production.

## Staging Price IDs

| Plan phase | Stripe Price ID |
| --- | --- |
| Monthly intro | `price_1TxJkS2M901mWzya5YCmCwtr` |
| Monthly renewal | `price_1TxJl22M901mWzyaEDEHRdSm` |
| Annual intro | `price_1TxJlM2M901mWzyap5dCFfjx` |
| Annual renewal | `price_1TxJlb2M901mWzya0NcQpNVZ` |
| Standard monthly | `price_1Txys02M901mWzyayDoSxoup` |
| Standard annual | `price_1TxysJ2M901mWzyan0kDZVnF` |

The checkout function validates each Price directly with Stripe before
creating a session. It rejects the wrong currency, amount, cadence, active
state, or live/sandbox mode.

## Three Checkout Gates

All three gates must be open before a founding purchase can start:

1. Website build: `VITE_BETA_CHECKOUT_VISIBLE=true`
2. Edge Function environment: `STRIPE_CHECKOUT_ENABLED=true`
3. Database configuration: `founding_offer_config.checkout_enabled=true`

Public standard checkout has a fourth gate:

4. Edge Function environment: `STRIPE_PUBLIC_CHECKOUT_ENABLED=true`

Every gate defaults to false. The production website remains in waitlist mode
unless its Vercel build variable is deliberately changed.

## Staging Secrets

Set secrets from a trusted terminal. Never place a Stripe secret key in source,
the vault, chat, or a browser-exposed environment variable.

```powershell
supabase secrets set --project-ref ijmgrrxqkigcqfsonueq `
  STRIPE_SECRET_KEY="sk_test_..." `
  STRIPE_WEBHOOK_SECRET="whsec_..."
```

The following nonsecret staging values are already configured:

```text
SITE_URL=https://tradenet.org
STRIPE_CHECKOUT_ENABLED=false
STRIPE_PUBLIC_CHECKOUT_ENABLED=false
STRIPE_EXPECT_LIVE_MODE=false
STRIPE_PRICE_FOUNDING_MONTHLY_INTRO=price_1TxJkS2M901mWzya5YCmCwtr
STRIPE_PRICE_FOUNDING_MONTHLY_RENEWAL=price_1TxJl22M901mWzyaEDEHRdSm
STRIPE_PRICE_FOUNDING_ANNUAL_INTRO=price_1TxJlM2M901mWzyap5dCFfjx
STRIPE_PRICE_FOUNDING_ANNUAL_RENEWAL=price_1TxJlb2M901mWzya0NcQpNVZ
STRIPE_PRICE_MONTHLY=price_1Txys02M901mWzyayDoSxoup
STRIPE_PRICE_ANNUAL=price_1TxysJ2M901mWzyan0kDZVnF
```

All six sandbox Prices are configured in staging.

## Stripe Sandbox Webhook

Create a sandbox webhook destination in Stripe:

```text
https://ijmgrrxqkigcqfsonueq.supabase.co/functions/v1/stripe-webhook
```

Subscribe it to:

```text
checkout.session.completed
checkout.session.async_payment_succeeded
checkout.session.expired
checkout.session.async_payment_failed
customer.subscription.created
customer.subscription.updated
customer.subscription.deleted
invoice.paid
invoice.payment_failed
charge.refunded
charge.dispute.created
```

Copy that destination's sandbox signing secret to
`STRIPE_WEBHOOK_SECRET` in staging.

## Webhook Ordering

Stripe does not guarantee event delivery order. A dispute can arrive before
the successful Checkout, invoice, and subscription events from the same
purchase.

Migrations `008_stripe_webhook_ordering_guard.sql` and
`009_stripe_subscription_generation_guard.sql` make billing transitions
atomic:

- `apply_stripe_hard_revocation` locks the profile and writes the profile and
  deny set in one transaction.
- `apply_stripe_billing_state` ignores all later events from the revoked
  subscription, even when those events report an active paid state.
- The profile stores the current Stripe subscription creation time. Once a
  newer subscription is authoritative, events from an older subscription
  cannot replace it or downgrade access.
- A failed or incomplete replacement cannot displace an existing nonterminal
  subscription.
- A different successful subscription can restore access only when its Stripe
  creation time is later than the hard revocation.
- Refunds use `billing_status=refunded` and deny-set reason `stripe_refund`.
- Disputes use `billing_status=disputed` and deny-set reason `stripe_dispute`.

Never replace these functions with separate profile-update and entitlement
recalculation calls.

## Failed First Payment Recovery

Stripe keeps a subscription in `incomplete` state for up to 23 hours after its
first payment fails. Checkout handles that state without creating a duplicate
subscription:

- If the original Checkout Session is still open, the account is sent back to
  the same secure Checkout URL.
- If a standard Checkout Session has expired but the first invoice is still
  payable, the account is sent to Stripe's Hosted Invoice Page for that exact
  subscription.
- If a founding Checkout Session is no longer open, the incomplete
  subscription is canceled and its temporary reservation is released before
  a new founding Checkout Session can be created.
- `incomplete_expired` and `canceled` subscriptions are terminal and do not
  block a new Checkout Session.
- Active, trialing, past-due, unpaid, or paused subscriptions continue to
  block a second subscription. Those accounts must use the billing portal.

Never allow a database status alone to decide whether a second subscription
can be created. The Checkout function verifies the current subscription
directly with Stripe.

## Invite A Wave

Use the Supabase SQL Editor on the intended project. Start with a small wave.
The function only changes rows still in `eligible` state and returns the number
invited.

```sql
select public.invite_founding_offer(
  array[
    'first@example.com',
    'second@example.com'
  ],
  now()
) as invited_count;
```

Inspect the result before opening checkout:

```sql
select
  cohort_position,
  email_norm,
  state,
  invited_at,
  claim_deadline,
  reservation_expires_at,
  founding_member_number
from public.founding_offer_eligibility
where email_norm in ('first@example.com', 'second@example.com')
order by cohort_position;
```

This table is operator-only. Do not expose the query or its emails to browser
clients.

## Open Founding Checkout In Staging

Leave public checkout closed while testing the founding path:

```powershell
supabase secrets set --project-ref ijmgrrxqkigcqfsonueq `
  STRIPE_CHECKOUT_ENABLED=true `
  STRIPE_PUBLIC_CHECKOUT_ENABLED=false `
  STRIPE_EXPECT_LIVE_MODE=false
```

Then open the database gate:

```sql
update public.founding_offer_config
set checkout_enabled = true,
    updated_at = now()
where id = 1;
```

Build a Vercel preview or local website build with:

```text
VITE_SUPABASE_URL=https://ijmgrrxqkigcqfsonueq.supabase.co
VITE_SUPABASE_ANON_KEY=<staging anon or publishable key>
VITE_BETA_CHECKOUT_VISIBLE=true
```

Use an invited staging account whose verified Supabase email exactly matches
the cohort email.

## Required Sandbox Acceptance

Complete these before any production migration or live checkout:

1. Signed-out pricing shows $39 monthly and $384 annual without exposing Price
   IDs or cohort data.
2. A non-cohort account cannot see or claim founding pricing.
3. A cohort account that is not invited sees its reserved terms but cannot
   start checkout.
4. An invited cohort account sees the correct claim deadline and founding
   prices.
5. Monthly Checkout charges $19 and creates a schedule with three $19 monthly
   phases followed by $29 renewal pricing.
6. Annual Checkout charges $199 and creates a schedule that moves to $284
   annual renewal pricing.
7. A completed Checkout grants terminal access exactly once.
8. Replayed webhook events do not duplicate access, schedules, or founding
   member numbers.
9. Expired or failed Checkout releases the temporary slot.
10. Cancellation preserves access through the paid period and does not restore
    the redeemed founding offer.
11. Payment failure, refund, and dispute paths produce the expected entitlement
    state. After a refund or dispute, replay a stale successful Checkout or
    invoice event and confirm the hard revocation, version, and timestamps do
    not change.
12. The 101st concurrent founding reservation or redemption is rejected.
13. After an initial card decline, starting the same purchase reopens the
    existing Checkout Session instead of creating a second subscription.
14. After an incomplete standard Checkout Session expires, the retry opens the
    exact unpaid invoice. After an incomplete founding Checkout Session
    expires, the old subscription and reservation are retired before a fresh
    reservation is created.
15. After a newer subscription becomes active, replay subscription,
    cancellation, invoice-failure, and Checkout events from the older
    subscription. The current subscription id, access, version, and timestamps
    must not regress.

Inspect the Stripe subscription and schedule in the Stripe Dashboard after
each completed payment. Do not infer schedule correctness from the website
success page alone.

## Close Staging Checkout

Close both server gates after testing:

```powershell
supabase secrets set --project-ref ijmgrrxqkigcqfsonueq `
  STRIPE_CHECKOUT_ENABLED=false `
  STRIPE_PUBLIC_CHECKOUT_ENABLED=false
```

```sql
update public.founding_offer_config
set checkout_enabled = false,
    updated_at = now()
where id = 1;
```

## Production Rollout

1. Back up production and verify the current waitlist ordering and unique email
   count.
2. Review the snapshot queries in migrations `006` and `012`.
3. Apply migrations `006_founding_offer_infrastructure.sql`,
   `007_founding_member_sequence_floor.sql`, and
   `008_stripe_webhook_ordering_guard.sql`,
   `009_stripe_subscription_generation_guard.sql`, and
   `012_expand_founding_cohort_to_launch_waitlist.sql` to production.
4. Confirm the private eligibility count exactly matches the valid unique
   waitlist count and inspect the first and last cohort positions.
5. Create or verify all six live Stripe Prices: two standard, four founding.
6. Create the production webhook destination and set its live signing secret.
7. Deploy the four Edge Functions with all checkout gates still false.
8. Run signed-out, unauthorized, and invite-status checks against production.
9. Open the founding database and server gates for a tiny internal wave.
10. Complete one real low-risk purchase and inspect the Stripe schedule,
    webhook event ledger, profile entitlement, and terminal access.
11. Enable the launch website build.
12. Invite waitlist waves deliberately. Do not invite the full cohort at once
    unless support and monitoring are ready.
13. Open public checkout only when standard purchase testing is complete.

## Monitoring Queries

Offer totals:

```sql
select state, count(*)
from public.founding_offer_eligibility
group by state
order by state;
```

Occupied founding capacity:

```sql
select count(*) as occupied_slots
from public.founding_offer_eligibility
where state = 'redeemed'
   or (state = 'reserved' and reservation_expires_at > now());
```

Recent accepted webhook events:

```sql
select provider_event_id, topic, created_at
from public.billing_events
where provider = 'stripe'
order by created_at desc
limit 50;
```

Failed handlers remove their idempotency row so Stripe can retry. Inspect the
`stripe-webhook` Edge Function logs and Stripe destination delivery attempts
for failures.

## Emergency Stop

Set `STRIPE_CHECKOUT_ENABLED=false` first. This stops new Checkout Sessions
without altering existing paid subscriptions. Then close the database gate and
investigate.

Do not delete eligibility rows, subscription schedules, profiles, or webhook
events during an incident. Preserve the evidence and reconcile from Stripe.
