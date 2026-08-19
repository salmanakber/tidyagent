# Wix CLI app (companion)

tidyAgent’s intelligence lives in the Next.js app at the repo root. The Wix CLI app is the install surface: dashboard entry, webhooks, and the site widget.

Do **not** use Wix Blocks/Velo as the primary backend. This product is an externally hosted Next.js + Postgres service.

## Dashboard / Open App (inside the Wix site dashboard)

Wix does **not** auto-embed your admin UI. Add a **Dashboard Page** extension:

1. Wix Developers → your app → **Extensions** → **Dashboard Page** (self-hosted / iframe).
2. **iFrame URL:** `https://<tidyagent-host>/wix/open`
3. Page name: `tidyAgent` (this is the sidebar label in the customer’s Wix dashboard).
4. HTTPS is required.

Also set **Open App URL** (App settings / Dashboard) to the same URL:

`https://<tidyagent-host>/wix/open`

Wix appends `?instance=...`. We set a session cookie and show onboarding or the dashboard **inside that iframe**.

If the iframe is blank: publish a new app version, then on the test site open **Dashboard → tidyAgent**.

## Webhooks (all of these → same URL)

`https://<tidyagent-host>/api/wix/webhooks`

- App Instance Installed
- App Instance Removed
- Paid Plan Purchased
- Paid Plan Changed
- Paid Plan Auto Renewal Cancelled

## Customer-site widget (required)

Wix will not inject the chat bubble unless the app has an **Embedded Script** extension.

1. Wix Developers → your app → **Extensions** → **Embedded Script**.
2. Load on all pages. Type: essential.
3. HTML:

```html
<script src="https://<tidyagent-host>/widget.js" data-instance="{{instanceId}}" async></script>
```

4. Add a dynamic parameter named exactly `instanceId`.
5. Permission: **Manage Embedded Scripts** (plus Manage Your App).
6. Copy the extension ID into `WIX_EMBEDDED_SCRIPT_COMPONENT_ID` if Wix shows more than one script.

On install / publish, tidyAgent calls Wix `embedScript` with that `instanceId`. The live site must be **published** for visitors to see the widget.

Fallback: Settings in the tidyAgent dashboard has a copy-paste snippet for Wix Editor → Settings → Custom Code.

## Plans vs Wix permissions

Wix permissions are requested **once for the whole app**, not per paid plan.

Ask for:

- Manage Your App
- Manage Embedded Scripts
- Read Site Owner Email
- Stores: Read Products, Read Orders (used by Business and Pro)

tidyAgent then **gates** features per plan in the backend:

| Wix plan | tidyAgent seat | Includes |
| --- | --- | --- |
| (none / free install) | Free | Dashboard + preview only |
| Starter | Starter | Live widget, Q&A, handoff |
| Business | Business (stored as GROWTH) | Stores tools + automations |
| Pro | Pro | Voice + highest limits |

Put each Wix Pricing plan ID in `.env`:

```
WIX_VENDOR_PRODUCT_STARTER=
WIX_VENDOR_PRODUCT_BUSINESS=
WIX_VENDOR_PRODUCT_PRO=
```
