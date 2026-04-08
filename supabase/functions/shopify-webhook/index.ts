// Supabase Edge Function: shopify-webhook
// Receives Shopify orders/paid webhook, updates user subscription tier in profiles table.
//
// Deploy:   supabase functions deploy shopify-webhook
// Secrets:  supabase secrets set SHOPIFY_WEBHOOK_SECRET=your_webhook_secret
//           supabase secrets set SUPABASE_SERVICE_ROLE_KEY=your_service_role_key
//
// Then in Shopify Admin → Settings → Notifications → Webhooks:
//   Event: Order payment    URL: https://edslmmldgknvyxujrbtx.supabase.co/functions/v1/shopify-webhook

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { createHmac } from "https://deno.land/std@0.208.0/crypto/mod.ts";

const SHOPIFY_SECRET = Deno.env.get("SHOPIFY_WEBHOOK_SECRET") || "";
const SUPABASE_URL = Deno.env.get("SUPABASE_URL") || "";
const SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || "";

// Map Shopify product titles/variants to subscription tiers
// Update these to match your actual Shopify product names
const TIER_MAP: Record<string, string> = {
  "TradeNet Terminal - Pro (Monthly)": "pro_monthly",
  "TradeNet Terminal - Pro (Annual)": "pro_annual",
  "Founding Member": "founding",
};

function determineTier(lineItems: any[]): string {
  for (const item of lineItems) {
    const title = item.title || "";
    const variant = item.variant_title || "";
    const combined = `${title} ${variant}`.trim();

    // Check exact matches first
    for (const [key, tier] of Object.entries(TIER_MAP)) {
      if (combined.toLowerCase().includes(key.toLowerCase())) {
        return tier;
      }
    }
  }
  return "pro_monthly"; // fallback if product name doesn't match
}

async function verifyWebhook(body: string, hmacHeader: string): Promise<boolean> {
  if (!SHOPIFY_SECRET) return false;
  const encoder = new TextEncoder();
  const key = await crypto.subtle.importKey(
    "raw",
    encoder.encode(SHOPIFY_SECRET),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"]
  );
  const signature = await crypto.subtle.sign("HMAC", key, encoder.encode(body));
  const computed = btoa(String.fromCharCode(...new Uint8Array(signature)));
  return computed === hmacHeader;
}

Deno.serve(async (req) => {
  if (req.method !== "POST") {
    return new Response("Method not allowed", { status: 405 });
  }

  const body = await req.text();
  const hmac = req.headers.get("x-shopify-hmac-sha256") || "";

  // Verify webhook signature
  const valid = await verifyWebhook(body, hmac);
  if (!valid) {
    console.error("Invalid webhook signature");
    return new Response("Unauthorized", { status: 401 });
  }

  const order = JSON.parse(body);
  const email = order.customer?.email?.toLowerCase();

  if (!email) {
    console.error("No customer email in order");
    return new Response("No email", { status: 400 });
  }

  const tier = determineTier(order.line_items || []);
  const shopifyCustomerId = order.customer?.id?.toString() || null;

  // Use service role to update profiles (bypasses RLS)
  const supabase = createClient(SUPABASE_URL, SERVICE_ROLE_KEY);

  // Find user by email in profiles
  const { data: profile, error: findError } = await supabase
    .from("profiles")
    .select("id")
    .eq("email", email)
    .single();

  if (findError || !profile) {
    console.error(`No profile found for email: ${email}`, findError);
    // Still return 200 so Shopify doesn't retry endlessly
    return new Response(JSON.stringify({ status: "no_profile", email }), {
      status: 200,
      headers: { "Content-Type": "application/json" },
    });
  }

  // Update subscription tier
  const { error: updateError } = await supabase
    .from("profiles")
    .update({
      subscription_tier: tier,
      shopify_customer_id: shopifyCustomerId,
    })
    .eq("id", profile.id);

  if (updateError) {
    console.error("Failed to update profile:", updateError);
    return new Response("Update failed", { status: 500 });
  }

  console.log(`Updated ${email} to tier: ${tier}`);
  return new Response(JSON.stringify({ status: "ok", email, tier }), {
    status: 200,
    headers: { "Content-Type": "application/json" },
  });
});
