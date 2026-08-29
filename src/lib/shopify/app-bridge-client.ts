export type ShopifyGlobal = {
  ready?: Promise<void>;
  idToken: () => Promise<string>;
  config?: { apiKey?: string; host?: string; shop?: string };
};

export function ensureShopifyApiKeyMeta(apiKey: string) {
  if (typeof document === "undefined") return;
  let meta = document.querySelector('meta[name="shopify-api-key"]') as HTMLMetaElement | null;
  if (!meta) {
    meta = document.createElement("meta");
    meta.name = "shopify-api-key";
    document.head.appendChild(meta);
  }
  meta.content = apiKey;
}

export function loadAppBridgeScript() {
  return new Promise<void>((resolve, reject) => {
    if (typeof document === "undefined") {
      reject(new Error("No document"));
      return;
    }
    if (document.querySelector('script[src*="shopifycloud/app-bridge.js"]')) {
      resolve();
      return;
    }
    const script = document.createElement("script");
    script.src = "https://cdn.shopify.com/shopifycloud/app-bridge.js";
    script.onload = () => resolve();
    script.onerror = () => reject(new Error("Could not download Shopify App Bridge from cdn.shopify.com"));
    document.head.appendChild(script);
  });
}

export async function waitForShopifyGlobal(apiKey: string, timeoutMs = 20_000): Promise<ShopifyGlobal> {
  ensureShopifyApiKeyMeta(apiKey);
  await loadAppBridgeScript();

  const started = Date.now();
  while (Date.now() - started < timeoutMs) {
    const shopify = (window as Window & { shopify?: ShopifyGlobal }).shopify;
    if (shopify) {
      try {
        if (shopify.ready) await shopify.ready;
      } catch {
        /* ready rejected — still try idToken */
      }
      if (typeof shopify.idToken === "function") return shopify;
    }
    await sleep(40);
  }

  throw new Error("Shopify App Bridge did not initialize");
}

export async function fetchWithShopifyIdToken(path: string, idToken: string) {
  return fetch(path, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${idToken}`,
      Accept: "application/json",
    },
    credentials: "include",
  });
}

export async function postShopifyIdToken(path: string, apiKey: string, bootstrapToken = "") {
  let idToken = bootstrapToken.trim();
  if (!idToken) {
    const shopify = await waitForShopifyGlobal(apiKey);
    idToken = await shopify.idToken();
  }
  return fetchWithShopifyIdToken(path, idToken);
}

function sleep(ms: number) {
  return new Promise((resolve) => window.setTimeout(resolve, ms));
}
