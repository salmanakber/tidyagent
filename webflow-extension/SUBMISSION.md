# Webflow Marketplace submission — tidyAgent Designer Extension

Use this checklist when filling the Webflow app submission form.

## Artifacts to upload

| Field | File | How to build |
| --- | --- | --- |
| Designer Extension bundle | `tidyagent-webflow-extension.zip` | `npm run webflow:extension` |
| Source map artifact | `tidyagent-webflow-extension-sourcemaps.zip` | same command (writes both) |
| App Review Preflight receipt | `wfpre_…` code | Run **App Review Preflight** in the Designer on the **same** zip + source maps, then paste the receipt |

Build command (from repo root):

```bash
npm run webflow:extension
```

Outputs:

- `tidyagent-webflow-extension.zip` — `index.html`, `webflow.json`, minified `bundle.js`
- `tidyagent-webflow-extension-sourcemaps.zip` — private `bundle.js.map` for App Review only

Readable source lives in `webflow-extension/src/main.js`.

## App Review Preflight receipt (optional)

Webflow marks this field as **optional**. You can submit with only the extension zip + source maps if you prefer.

### How to install Preflight (this is the missing step)

It is **not** listed like a normal Marketplace search result. Install it with Webflow’s official OAuth link:

1. Open this link while logged into the **same Webflow Workspace** that owns tidyAgent:  
   https://webflow.com/oauth/authorize?response_type=code&client_id=0b5411e62233387925e082350666ef374377f81a9abba0dcc2542d6b5b1e4388&scope=authorized_user%3Aread
2. Approve / install **App Review Preflight** into that Workspace.
3. Open any site in the **Designer**.
4. Open apps / extensions in Designer and launch **App Review Preflight**.
5. In Preflight, choose:
   - Bundle: `tidyagent-webflow-extension.zip`
   - Source maps: `tidyagent-webflow-extension-sourcemaps.zip`
6. Run Preflight → copy the receipt (`wfpre_` + 32 hex characters).
7. Paste that receipt into the submission form.

Official note: [Submitting your app → Submission artifacts](https://developers.webflow.com/apps/docs/marketplace/submitting-your-app#submission-artifacts).

Do not rebuild between Preflight and submission — the receipt must match the attached artifacts.

## Features overview (paste up to 5)

Use these (or shorten as needed):

1. **AI employee for the live site** — Learns from the published Webflow site (pages, CMS, ecommerce when available) and answers visitors in the site’s brand.
2. **Designer Launch + hosted dashboard** — Opens tidyAgent from the Webflow Designer; onboarding, knowledge, and agent settings stay on the secure hosted app.
3. **Chat widget via custom code** — Injects a branded chat bubble site-wide; publish once so visitors see it on the live site.
4. **Evidence-based answers with human handoff** — Stays grounded in scanned site content; escalates to a human when needed (email / WhatsApp).
5. **Plan-scoped knowledge & automations** — Starter / Business / Pro unlock scan depth, agents, and automations without leaving Webflow billing for card checkout on Webflow seats.

## App home / URLs (reference)

- App home: `https://agent.tidyflowapp.com/webflow`
- OAuth callback: `https://agent.tidyflowapp.com/api/webflow/oauth/callback`

See also: [Publishing your app](https://developers.webflow.com/apps/docs/publishing-your-app).
