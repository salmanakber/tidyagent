# Webflow Marketplace — exact production scope mapping (Data Client)

Architecture: Data Client only. No Designer Extension.

Documentation: https://agent.tidyflowapp.com/docs/webflow
Permissions list: https://agent.tidyflowapp.com/install/webflow

This file lists every Webflow Data API endpoint the production App calls. No optional, fallback, or unused endpoints.

## Knowledge sources (exact)

| Source | What production reads | What production does not read |
| --- | --- | --- |
| Site profile | Site display name, short name, publish time, public URL fields | — |
| Pages | Page list metadata only: title, SEO description, published path | Static page DOM / body text. Production does not call GET /v2/pages/{page_id}/dom (Get Page Content). |
| CMS | Collection list and item fieldData | — |
| Ecommerce | Product catalog fields when the site has a store | — |
| Owner notes | Text the merchant types in the tidyAgent dashboard | — |

There is no domain crawl and no HTML scrape of the published site.

## Exact production endpoint mapping

| Scope | Exact production endpoint | Method | When called | Customer-facing use |
| --- | --- | --- | --- | --- |
| authorized_user:read | /v2/token/authorized_by | GET | OAuth install and reconnect | Identify the installing Webflow user and bind the tidyAgent workspace |
| sites:read | /v2/sites | GET | OAuth install and reconnect | List authorized sites and select the connected site |
| sites:read | /v2/sites/{site_id} | GET | Knowledge scan | Read site profile (name, domains, publish metadata) for the workspace |
| sites:write | Used together with PUT /v2/sites/{site_id}/custom_code below | — | Install widget; Disconnect | Webflow requires sites:write for site-level Custom Code apply and remove. tidyAgent does not call a separate sites update endpoint |
| pages:read | /v2/sites/{site_id}/pages | GET | Knowledge scan | Read page metadata (title, SEO description, published path) for AI knowledge. Does not read page DOM content |
| cms:read | /v2/sites/{site_id}/collections | GET | Knowledge scan (plan-scoped) | List CMS collections |
| cms:read | /v2/collections/{collection_id}/items | GET | Knowledge scan (plan-scoped) | Read CMS item fields for AI knowledge |
| ecommerce:read | /v2/sites/{site_id}/products | GET | Knowledge scan (plan-scoped, when store exists) | Read product catalog for AI product answers |
| custom_code:read | /v2/sites/{site_id}/registered_scripts | GET | Install and open app | Detect whether the tidyAgent script is already registered |
| custom_code:read | /v2/sites/{site_id}/custom_code | GET | Install, open app, Disconnect | Read applied site scripts before apply or remove |
| custom_code:write | /v2/sites/{site_id}/registered_scripts/inline | POST | Install and open app | Register the production tidyAgent inline loader, which loads https://agent.tidyflowapp.com/widget.js |
| custom_code:write | /v2/sites/{site_id}/custom_code | PUT | Install and open app | Apply the tidyAgent script at the site footer |
| custom_code:write | /v2/sites/{site_id}/custom_code | DELETE | Uninstall / Settings → Uninstall & remove widget | Remove Custom Code applied by this App only; unrelated scripts preserved. Merchant is then prompted to Publish |

## Custom Code disclosure (exact — paste this section only)

**Do not paste any older text that mentions hosted registration, embed.js, or SemVer 1.1.0.** That older path is retired and must not appear anywhere in the submission.

Production uses **one** code-delivery path:

1. `POST /v2/sites/{site_id}/registered_scripts/inline`
   - `sourceCode`: compact inline loader (under 2000 characters)
   - The loader loads **only**: `https://agent.tidyflowapp.com/widget.js?v=1.3.1&instance={workspaceId}`
   - `version`: `1.3.1`
   - `displayName`: `tidyAgent`
2. `PUT /v2/sites/{site_id}/custom_code` — apply that registered script at location `footer`
3. On disconnect: `DELETE /v2/sites/{site_id}/custom_code` (App-applied scripts only), or PUT remaining non-tidyAgent scripts

Production executable:

- URL: `https://agent.tidyflowapp.com/widget.js`
- Delivered through **inline** script registration only
- `widget.js` **is** the chat UI. It calls tidyAgent HTTPS JSON APIs for config/chat. It does **not** create another remote `<script>` element.
- **Not used:** `POST /v2/sites/{site_id}/registered_scripts/hosted`
- **Not used:** registering or documenting `embed.js` as a production Custom Code path
- **No** alternative production code-delivery path

Merchant must publish the Webflow site for visitors to see or lose the bubble.

## Uninstall lifecycle (exact)

1. Merchant opens tidyAgent Settings and clicks Uninstall & remove widget.
2. While the OAuth token is valid, tidyAgent calls DELETE /v2/sites/{site_id}/custom_code (removes Custom Code applied by this App only). If needed, falls back to PUT /v2/sites/{site_id}/custom_code with tidyAgent’s script omitted so unrelated scripts remain.
3. tidyAgent does not apply page-level Custom Code, so site-level removal is sufficient.
4. Merchant is redirected to /webflow/uninstalled and prompted to Publish the Webflow site so the live bubble disappears.
5. Merchant may then revoke the app in Webflow Site settings if desired.

Publishing is required for removal to take effect on the live site. tidyAgent does not publish automatically.

## Endpoints not used in production

- GET /v2/pages/{page_id}/dom (Get Page Content)
- POST /v2/sites/{site_id}/registered_scripts/hosted
- pages:write, Forms, Assets, Designer Extension APIs

## Align Webflow App dashboard permissions

Enable only:

1. authorized_user:read
2. sites:read
3. sites:write
4. pages:read
5. cms:read
6. ecommerce:read
7. custom_code:read
8. custom_code:write

Turn off pages:write, Forms, Assets, and any Designer Extension building block.
