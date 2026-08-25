const SHOPIFY_API_VERSION = "2024-10";

export class ShopifyApiError extends Error {
  constructor(
    message: string,
    public status?: number,
  ) {
    super(message);
    this.name = "ShopifyApiError";
  }
}

export async function exchangeShopifyCode(input: {
  shop: string;
  apiKey: string;
  apiSecret: string;
  code: string;
}) {
  const response = await fetch(`https://${input.shop}/admin/oauth/access_token`, {
    method: "POST",
    headers: { Accept: "application/json", "Content-Type": "application/json" },
    body: JSON.stringify({
      client_id: input.apiKey,
      client_secret: input.apiSecret,
      code: input.code,
    }),
  });
  const body = (await response.json().catch(() => ({}))) as {
    access_token?: string;
    scope?: string;
    error?: string;
    error_description?: string;
  };
  if (!response.ok || !body.access_token) {
    throw new ShopifyApiError(
      body.error_description || body.error || `Shopify token exchange failed (${response.status})`,
      response.status,
    );
  }
  return { accessToken: body.access_token, scope: body.scope ?? "" };
}

function shopifyApi(shop: string, path: string) {
  const suffix = path.startsWith("/") ? path : `/${path}`;
  return `https://${shop}/admin/api/${SHOPIFY_API_VERSION}${suffix}`;
}

export async function shopifyGet<T>(shop: string, accessToken: string, path: string): Promise<T> {
  const response = await fetch(shopifyApi(shop, path), {
    headers: {
      "X-Shopify-Access-Token": accessToken,
      Accept: "application/json",
    },
  });
  if (!response.ok) {
    throw new ShopifyApiError(`Shopify GET ${path} failed (${response.status})`, response.status);
  }
  return (await response.json()) as T;
}

export async function shopifySend<T>(
  shop: string,
  accessToken: string,
  path: string,
  method: "POST" | "PUT" | "DELETE",
  body?: unknown,
): Promise<T> {
  const response = await fetch(shopifyApi(shop, path), {
    method,
    headers: {
      "X-Shopify-Access-Token": accessToken,
      Accept: "application/json",
      "Content-Type": "application/json",
    },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  if (!response.ok) {
    const text = await response.text().catch(() => "");
    throw new ShopifyApiError(
      `Shopify ${method} ${path} failed (${response.status})${text ? `: ${text.slice(0, 200)}` : ""}`,
      response.status,
    );
  }
  if (response.status === 204) return undefined as T;
  return (await response.json()) as T;
}

export async function shopifyGraphql<T>(
  shop: string,
  accessToken: string,
  query: string,
  variables?: Record<string, unknown>,
): Promise<T> {
  const response = await fetch(shopifyApi(shop, "/graphql.json"), {
    method: "POST",
    headers: {
      "X-Shopify-Access-Token": accessToken,
      Accept: "application/json",
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ query, variables }),
  });
  const body = (await response.json().catch(() => ({}))) as {
    data?: T;
    errors?: Array<{ message?: string }>;
  };
  if (!response.ok || body.errors?.length) {
    const message = body.errors?.map((e) => e.message).filter(Boolean).join("; ") || `Shopify GraphQL failed (${response.status})`;
    throw new ShopifyApiError(message, response.status);
  }
  return body.data as T;
}

export type ShopifyShopRecord = {
  id?: number;
  name?: string;
  email?: string;
  domain?: string;
  myshopify_domain?: string;
  primary_locale?: string;
  currency?: string;
  shop_owner?: string;
};

export async function fetchShopifyShop(shop: string, accessToken: string) {
  const payload = await shopifyGet<{ shop?: ShopifyShopRecord }>(shop, accessToken, "/shop.json");
  return payload.shop ?? null;
}
