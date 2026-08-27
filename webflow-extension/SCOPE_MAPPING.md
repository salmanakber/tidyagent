# Webflow resubmission — architecture & scope mapping

Paste / attach this with your Marketplace resubmission. Keep **Data Client permissions in the Webflow App dashboard identical** to the OAuth scopes below (no Forms, Assets, or extra Design data scopes).

## Architecture: Hybrid App (intentional)

tidyAgent is a **Hybrid App**:

| Building block | Production use |
| --- | --- |
| **Designer Extension** | Launch panel in the Webflow Designer. Bundle only opens the hosted dashboard (`https://agent.tidyflowapp.com/webflow?embed=1`). It does **not** edit canvas, styles, or design elements. |
| **Data Client** | OAuth + Webflow Data APIs for site profile, pages, CMS, ecommerce, and Custom Code (chat widget). |

**Why authorization shows “View your designs” / “Edit designs on your behalf”:**  
Those strings come from enabling the **Designer Extension** building block (required to Launch from Designer). Production Designer functionality is **Launch → hosted app only**. We do not request additional Design/Assets/Forms Data Client scopes.

**Artifacts:** Designer Extension zip + source maps + Preflight receipt (same build). Demo video should show Launch from Designer opening the dashboard.

Documentation: `https://agent.tidyflowapp.com/docs/webflow`  
Permissions list: `https://agent.tidyflowapp.com/install/webflow`

## Custom Code (disclose on listing)

- On install/open, tidyAgent registers a **site-wide JavaScript chat widget** via the Custom Code API and applies it at the site footer.
- The script loads remote assets from `https://agent.tidyflowapp.com/widget.js` (and related embed JS).
- Required so visitors see the chat bubble on the **published** site (publish still required).
- On **Disconnect** in tidyAgent Settings, the app removes only its applied Custom Code while the token is valid. Unrelated customer scripts are preserved. After Webflow uninstall, publish again if a cached bubble remains.

## Knowledge: Data APIs only (no domain crawl)

Webflow workspaces **never** run public-site crawl/scrape. Knowledge is loaded only through official Webflow Data APIs listed below.

## Scope mapping (required)

| Scope | Customer-facing feature | API | Trigger | Why read/write | Where in app / demo |
| --- | --- | --- | --- | --- | --- |
| `authorized_user:read` | Tie workspace to installing user | `GET /v2/token/authorized_by` | OAuth install / reconnect | Read identity only | Install → dashboard |
| `sites:read` | Site name, URL, locale for workspace | `GET /v2/sites`, `GET /v2/sites/{site_id}` | Install; Knowledge sync | Read site metadata | Onboarding, Knowledge, Settings |
| `sites:write` | Apply/remove site-level Custom Code (Webflow lifecycle) | Used with Custom Code site endpoints | Install widget; Disconnect remove | Write required by Webflow for site-level script apply/remove | Install; Settings → Disconnect |
| `pages:read` | Page titles/paths for AI knowledge | `GET /v2/sites/{site_id}/pages` | Knowledge “Read site via Webflow APIs” | Read page metadata (not HTML scrape) | Knowledge / onboarding scan |
| `cms:read` | CMS items for answers | `GET /v2/sites/{site_id}/collections`, `GET …/collections/{id}/items` | Knowledge sync (plan-scoped) | Read CMS content | Knowledge |
| `ecommerce:read` | Product catalog answers | `GET /v2/sites/{site_id}/products` | Knowledge sync on Business/Pro when store exists | Read products | Knowledge, chat product cards |
| `custom_code:read` | Detect existing tidyAgent script | `GET /v2/sites/{site_id}/custom_code`, `GET …/registered_scripts` | Install / open app | Read applied scripts | Background on open |
| `custom_code:write` | Install & remove chat widget | `POST …/registered_scripts/inline` (or hosted); `PUT …/custom_code` | Install/open; Disconnect | Write to register and apply/remove **only** tidyAgent script | Live bubble on published site |

**Not requested:** `pages:write`, Forms, Assets, Design file APIs beyond Designer Extension Launch.

## Align your Webflow dashboard

1. Data Client permissions = **exactly** the eight scopes in the table.  
2. Turn off Forms, Assets, and any unused write scopes.  
3. Architecture on form: **Hybrid**.  
4. Documentation URL: `https://agent.tidyflowapp.com/docs/webflow`.
