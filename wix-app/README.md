# Wix CLI app (companion)

For **App Market listing copy, legal URLs, and the submit checklist**, use [MARKETPLACE_SUBMISSION.md](./MARKETPLACE_SUBMISSION.md).

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

## BI events (App Market recommendation)

Wix tracks setup and usage through [Send BI Event](https://dev.wix.com/docs/rest/app-management/bi-event/send-bi-event.md). tidyAgent sends these automatically after you deploy this code — there is nothing to toggle in the Wix dashboard.

| Event | When |
| --- | --- |
| `APP_DASHBOARD_LOADED` | Owner opens tidyAgent from the site dashboard (`/wix/open`) |
| `APP_SETUP_FINISHED` + `APP_FINISHED_CONFIGURATION` | Onboarding is published (widget live) |
| `APP_UPGRADED` | Paid Plan Purchased or Paid Plan Changed webhook |
| `PRIMARY_ACTION_PERFORMED` | A visitor starts a live chat |

Do **not** send `CHARGE` / `FUNDS_RETURNED` — Wix checkout already owns billing. After deploy, complete onboarding once on a test site so Wix can record `APP_SETUP_FINISHED` and drop the “Add BI events” recommendation.

## Customer-site widget (required)

Wix will not inject the chat bubble unless the app has an **Embedded Script** extension.

1. Wix Developers → your app → **Extensions** → **Embedded Script**.
2. Type: **Essential**. Placement: **Body** (not Head).
3. **Uncheck** “The embedded script uses frontend modules from the Wix JavaScript SDK”. Our widget is a normal script, not a Wix SDK module. That checkbox will prevent `widget.js` from appearing on the site.
4. HTML:

```html
<script src="https://agent.tidyflowapp.com/widget.js" data-instance="{{instanceId}}" async></script>
```

5. Add a **dynamic parameter** named exactly `instanceId`.
6. Release a **new app version**, then update the app on the test site.
7. **Publish** the Wix site (Editor preview often does not inject embedded scripts).
8. Permission: Manage Embedded Scripts. Copy the extension ID into `WIX_EMBEDDED_SCRIPT_COMPONENT_ID` if you have more than one script.

On install / publish, tidyAgent calls Wix `embedScript` with that `instanceId`. The live site must be **published** for visitors to see the widget.

Fallback: Settings in the tidyAgent dashboard has a copy-paste snippet for Wix Editor → Settings → Custom Code.

## Plans vs Wix permissions

Wix permissions are requested **once for the whole app**, not per paid plan.

Ask for:

- Manage Your App
- Manage Embedded Scripts
- Read Site Owner Email
- Read site, business, and email details (site properties)
- Wix Data: Read collections and items
- Stores: Read Products, Read Orders (used by Business and Pro)

tidyAgent then **gates** features per plan in the backend:

| Wix plan | tidyAgent seat | Includes |
| --- | --- | --- |
| (none / free install) | Locked | Billing only — no dashboard, no live bubble |
| Starter | Starter | Live widget, site profile, pages, CMS, domain crawl |
| Business | Business (stored as GROWTH) | Stores catalog + bookings + automations |
| Pro | Pro | Deepest APIs + voice + highest limits |

Put each Wix Pricing plan ID in `.env`:

```
WIX_VENDOR_PRODUCT_STARTER=
WIX_VENDOR_PRODUCT_BUSINESS=
WIX_VENDOR_PRODUCT_PRO=
```
