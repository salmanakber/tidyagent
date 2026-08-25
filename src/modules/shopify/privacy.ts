import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { normalizeShopifyShop } from "@/modules/shopify/shop";

export type ShopifyPrivacyPayload = {
  shop_id?: number | string;
  shop_domain?: string;
  customer?: {
    id?: number | string;
    email?: string;
    phone?: string;
  };
  orders_requested?: Array<number | string>;
  orders_to_redact?: Array<number | string>;
  data_request?: {
    id?: number | string;
  };
};

function emailsFromPayload(payload: ShopifyPrivacyPayload) {
  const email = payload.customer?.email?.trim().toLowerCase();
  return email ? [email] : [];
}

async function findShopifySite(shopDomain?: string | null) {
  const shop = normalizeShopifyShop(shopDomain);
  if (!shop) return null;
  return prisma.wixSite.findFirst({
    where: { platform: "SHOPIFY", shopifyShopDomain: shop },
  });
}

/**
 * customers/data_request — acknowledge and snapshot what we store for those emails.
 * Shopify requires a 200 after HMAC verification; we log a BillingEvent for the operator.
 */
export async function handleShopifyCustomersDataRequest(shopDomain: string, payload: ShopifyPrivacyPayload) {
  const site = await findShopifySite(shopDomain || payload.shop_domain);
  const emails = emailsFromPayload(payload);
  const customers = site
    ? await prisma.customer.findMany({
        where: {
          organizationId: site.organizationId,
          ...(emails.length ? { email: { in: emails } } : {}),
        },
        select: { id: true, email: true, name: true, phone: true, createdAt: true },
        take: 200,
      })
    : [];

  await prisma.billingEvent.create({
    data: {
      organizationId: site?.organizationId,
      siteId: site?.id,
      wixInstanceId: site?.wixInstanceId ?? `shopify:${shopDomain || "unknown"}`,
      eventType: "shopify.customers/data_request",
      payload: {
        shop_domain: shopDomain || payload.shop_domain,
        shop_id: payload.shop_id,
        data_request: payload.data_request,
        orders_requested: payload.orders_requested,
        customers,
      } as Prisma.InputJsonValue,
    },
  });

  return { ok: true as const, customerCount: customers.length };
}

/**
 * customers/redact — erase PII we store for the listed customer emails on that Shopify site only.
 */
export async function handleShopifyCustomersRedact(shopDomain: string, payload: ShopifyPrivacyPayload) {
  const site = await findShopifySite(shopDomain || payload.shop_domain);
  if (!site) return { ok: true as const, redacted: 0 };

  const emails = emailsFromPayload(payload);
  if (!emails.length) {
    await prisma.billingEvent.create({
      data: {
        organizationId: site.organizationId,
        siteId: site.id,
        wixInstanceId: site.wixInstanceId,
        eventType: "shopify.customers/redact",
        payload: { shop_domain: shopDomain, note: "no email in payload", raw: payload } as Prisma.InputJsonValue,
      },
    });
    return { ok: true as const, redacted: 0 };
  }

  const result = await prisma.customer.updateMany({
    where: {
      organizationId: site.organizationId,
      email: { in: emails },
    },
    data: {
      email: null,
      name: null,
      phone: null,
      memory: {},
      wixContactId: null,
    },
  });

  await prisma.billingEvent.create({
    data: {
      organizationId: site.organizationId,
      siteId: site.id,
      wixInstanceId: site.wixInstanceId,
      eventType: "shopify.customers/redact",
      payload: {
        shop_domain: shopDomain,
        emails,
        redacted: result.count,
        orders_to_redact: payload.orders_to_redact,
      } as Prisma.InputJsonValue,
    },
  });

  return { ok: true as const, redacted: result.count };
}

/**
 * shop/redact — 48h after uninstall. Wipe Shopify tokens and site PII for that shop only.
 * Never touches Wix rows.
 */
export async function handleShopifyShopRedact(shopDomain: string, payload: ShopifyPrivacyPayload) {
  const site = await findShopifySite(shopDomain || payload.shop_domain);
  if (!site) return { ok: true as const, found: false };

  await prisma.wixCredential.updateMany({
    where: { siteId: site.id },
    data: { metadata: {} },
  });

  await prisma.customer.updateMany({
    where: { organizationId: site.organizationId },
    data: {
      email: null,
      name: null,
      phone: null,
      memory: {},
      wixContactId: null,
    },
  });

  await prisma.wixSite.update({
    where: { id: site.id },
    data: {
      connectionStatus: "uninstalled",
      accessStatus: "revoked",
      ownerEmail: null,
      displayName: site.displayName ? `redacted-${site.id.slice(0, 8)}` : null,
      url: null,
      lastSyncedAt: new Date(),
    },
  });

  await prisma.billingEvent.create({
    data: {
      organizationId: site.organizationId,
      siteId: site.id,
      wixInstanceId: site.wixInstanceId,
      eventType: "shopify.shop/redact",
      payload: {
        shop_domain: shopDomain || payload.shop_domain,
        shop_id: payload.shop_id,
      } as Prisma.InputJsonValue,
    },
  });

  return { ok: true as const, found: true };
}

export async function dispatchShopifyPrivacyWebhook(topic: string, shopDomain: string, rawBody: string) {
  let payload: ShopifyPrivacyPayload = {};
  try {
    payload = JSON.parse(rawBody) as ShopifyPrivacyPayload;
  } catch {
    payload = {};
  }

  switch (topic) {
    case "customers/data_request":
      return handleShopifyCustomersDataRequest(shopDomain, payload);
    case "customers/redact":
      return handleShopifyCustomersRedact(shopDomain, payload);
    case "shop/redact":
      return handleShopifyShopRedact(shopDomain, payload);
    default:
      console.info("Shopify webhook (non-privacy)", { topic, shop: shopDomain });
      return { ok: true as const };
  }
}
