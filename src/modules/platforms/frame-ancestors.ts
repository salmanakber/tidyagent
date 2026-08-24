/**
 * CSP frame-ancestors for marketplace iframes.
 * Wix origins stay as they are in production. Extra Webflow hosts cover Designer
 * Extensions (unique CDN URIs) so Launch is not blocked by a nested iframe parent.
 */
export const FRAME_ANCESTORS = [
  "'self'",
  "https://manage.wix.com",
  "https://www.wix.com",
  "https://*.wix.com",
  "https://*.editor.wix.com",
  "https://*.studio.wix.com",
  "https://*.harmony.wix.com",
  "https://webflow.com",
  "https://*.webflow.com",
  "https://*.design.webflow.com",
  "https://webflow.io",
  "https://*.webflow.io",
  "https://cdn.webflow.com",
  "https://*.cdn.webflow.com",
  "https://*.design-extensions.webflow.io",
  "https://*.webflowusercontent.com",
  "https://d3e54v103j8qbb.cloudfront.net",
  "https://*.cloudfront.net",
  "https://admin.shopify.com",
  "https://*.myshopify.com",
] as const;

export const FRAME_ANCESTORS_CSP = `frame-ancestors ${FRAME_ANCESTORS.join(" ")}`;
