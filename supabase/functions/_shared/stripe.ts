export const STRIPE_API_VERSION = "2024-06-20";

type StripeParams = Record<string, string>;

export class StripeRequestError extends Error {
  status: number;
  code: string | null;

  constructor(message: string, status: number, code: string | null = null) {
    super(message);
    this.name = "StripeRequestError";
    this.status = status;
    this.code = code;
  }
}

export async function stripeRequest(
  secretKey: string,
  method: "GET" | "POST" | "DELETE",
  path: string,
  params?: StripeParams,
  idempotencyKey?: string,
): Promise<any> {
  const headers: Record<string, string> = {
    Authorization: `Bearer ${secretKey}`,
    "Stripe-Version": STRIPE_API_VERSION,
  };

  const init: RequestInit = { method, headers };
  let url = `https://api.stripe.com${path}`;

  if (params && method === "GET") {
    const query = new URLSearchParams(params).toString();
    if (query) url += `${url.includes("?") ? "&" : "?"}${query}`;
  } else if (params) {
    headers["Content-Type"] = "application/x-www-form-urlencoded";
    init.body = new URLSearchParams(params);
  }

  if (idempotencyKey) headers["Idempotency-Key"] = idempotencyKey;

  const response = await fetch(url, init);
  const data = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new StripeRequestError(
      data?.error?.message || `Stripe request failed with ${response.status}`,
      response.status,
      data?.error?.code || null,
    );
  }
  return data;
}

export async function validateRecurringPrice(
  secretKey: string,
  priceId: string,
  expected: {
    amount: number;
    interval: "month" | "year";
    livemode: boolean;
  },
): Promise<any> {
  if (!priceId) throw new Error("stripe_price_not_configured");

  const price = await stripeRequest(
    secretKey,
    "GET",
    `/v1/prices/${encodeURIComponent(priceId)}`,
  );

  const matches = price?.active === true &&
    price?.currency === "usd" &&
    price?.unit_amount === expected.amount &&
    price?.type === "recurring" &&
    price?.recurring?.interval === expected.interval &&
    price?.livemode === expected.livemode;

  if (!matches) throw new Error("stripe_price_mismatch");
  return price;
}
