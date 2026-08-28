/** Prefer a current Admin API version; public apps should use GraphQL over legacy REST. */
const SHOPIFY_API_VERSION = "2025-01";

export class ShopifyApiError extends Error {
  constructor(
    message: string,
    public status?: number,
  ) {
    super(message);
    this.name = "ShopifyApiError";
  }
}

export { exchangeShopifyCode } from "@/modules/shopify/tokens";

function shopifyApi(shop: string, path: string) {
  const suffix = path.startsWith("/") ? path : `/${path}`;
  return `https://${shop}/admin/api/${SHOPIFY_API_VERSION}${suffix}`;
}

/** Shopify GraphQL/REST may return errors as an array, string, or keyed object. */
export function graphqlErrorMessages(errors: unknown): string[] {
  if (errors == null) return [];

  if (Array.isArray(errors)) {
    return errors
      .flatMap((entry) => graphqlErrorMessages(entry))
      .filter(Boolean);
  }

  if (typeof errors === "string") {
    const trimmed = errors.trim();
    return trimmed ? [trimmed] : [];
  }

  if (typeof errors === "object") {
    const record = errors as Record<string, unknown>;
    if (typeof record.message === "string" && record.message.trim()) {
      return [record.message.trim()];
    }
    const nested: string[] = [];
    for (const value of Object.values(record)) {
      nested.push(...graphqlErrorMessages(value));
    }
    if (nested.length) return nested;
  }

  return [String(errors)];
}

function graphqlErrorSummary(errors: unknown, status?: number) {
  const messages = graphqlErrorMessages(errors);
  if (messages.length) return messages.join("; ");
  return `Shopify GraphQL failed (${status ?? "unknown"})`;
}

function hasGraphqlErrors(errors: unknown) {
  return graphqlErrorMessages(errors).length > 0;
}

export async function shopifyGet<T>(shop: string, accessToken: string, path: string): Promise<T> {
  const response = await fetch(shopifyApi(shop, path), {
    headers: {
      "X-Shopify-Access-Token": accessToken,
      Accept: "application/json",
    },
  });
  if (!response.ok) {
    const text = await response.text().catch(() => "");
    let detail = text.slice(0, 240);
    try {
      const parsed = JSON.parse(text) as { errors?: unknown; error?: string };
      const messages = graphqlErrorMessages(parsed.errors ?? parsed.error);
      if (messages.length) detail = messages.join("; ");
    } catch {
      /* keep raw text */
    }
    throw new ShopifyApiError(
      `Shopify GET ${path} failed (${response.status})${detail ? `: ${detail}` : ""}`,
      response.status,
    );
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
    data?: T | null;
    errors?: unknown;
    error?: unknown;
  };

  const message = graphqlErrorSummary(body.errors ?? body.error, response.status);

  if (!response.ok) {
    throw new ShopifyApiError(message, response.status);
  }

  // Shopify often returns field-level ACCESS_DENIED with partial `data`.
  if (body.data != null && hasGraphqlPayload(body.data)) {
    if (hasGraphqlErrors(body.errors ?? body.error)) {
      console.warn("Shopify GraphQL partial errors", { shop, message });
    }
    return body.data;
  }

  if (hasGraphqlErrors(body.errors ?? body.error)) {
    throw new ShopifyApiError(message, response.status);
  }

  throw new ShopifyApiError(message, response.status);
}

function hasGraphqlPayload(data: unknown): boolean {
  if (!data || typeof data !== "object") return false;
  return Object.values(data as Record<string, unknown>).some((value) => value != null);
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
  try {
    const data = await shopifyGraphql<{
      shop?: {
        name?: string;
        email?: string | null;
        contactEmail?: string | null;
        currencyCode?: string | null;
        primaryLocale?: string | null;
        myshopifyDomain?: string | null;
        primaryDomain?: { host?: string | null; url?: string | null } | null;
        shopOwnerName?: string | null;
      };
    }>(
      shop,
      accessToken,
      `query ShopifyShopBootstrap {
        shop {
          name
          contactEmail
          currencyCode
          primaryLocale
          myshopifyDomain
          primaryDomain { host url }
          shopOwnerName
        }
      }`,
    );
    const row = data.shop;
    if (!row) return null;
    return {
      name: row.name,
      email: row.contactEmail || undefined,
      currency: row.currencyCode || undefined,
      primary_locale: row.primaryLocale || undefined,
      myshopify_domain: row.myshopifyDomain || undefined,
      domain: row.primaryDomain?.host || row.myshopifyDomain || undefined,
      shop_owner: row.shopOwnerName || undefined,
    } satisfies ShopifyShopRecord;
  } catch (error) {
    if (error instanceof ShopifyApiError && error.status === 401) throw error;
    const payload = await shopifyGet<{ shop?: ShopifyShopRecord }>(shop, accessToken, "/shop.json");
    return payload.shop ?? null;
  }
}
