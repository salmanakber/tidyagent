/** Scopes we request on /webflow/install. Must match the Data Client permissions in Webflow. */
export const WEBFLOW_OAUTH_SCOPES = [
  "authorized_user:read",
  "sites:read",
  "sites:write",
  "pages:read",
  "custom_code:read",
  "custom_code:write",
  "cms:read",
  "ecommerce:read",
] as const;

export const WEBFLOW_SCOPE_STRING = WEBFLOW_OAUTH_SCOPES.join(" ");
