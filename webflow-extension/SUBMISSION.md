# Webflow Marketplace submission — tidyAgent (Data Client)

Use this checklist when filling the Webflow app submission form.

## Architecture (must match everywhere)

Architecture: Data Client only.

Do not enable a Designer Extension building block. Every submission field, production surface, and user-facing document must say Data Client — not Hybrid App, not Designer Extension.

## Permission mapping

Use the exact table in SCOPE_MAPPING.md.

## Custom Code (critical)

Production registers and applies one versioned hosted executable:

- URL: https://agent.tidyflowapp.com/widget/embed.js
- API: POST /v2/sites/{site_id}/registered_scripts/hosted with sha384 integrityHash
- Apply: PUT /v2/sites/{site_id}/custom_code (footer)
- No inline nested loader, no widget.js chain, no second remote executable

## Uninstall lifecycle

1. Settings → Uninstall & remove widget
2. DELETE /v2/sites/{site_id}/custom_code (App-applied scripts only; unrelated scripts preserved)
3. Confirmation page prompts merchant to Publish the Webflow site
4. Docs: https://agent.tidyflowapp.com/docs/webflow#disconnect

Do not instruct reviewers to manually delete leftover snippets after a successful Settings uninstall.

## Features overview (paste up to 5)

1. AI employee for the live site — Learns from Webflow Data APIs (site profile, page metadata, CMS, ecommerce when available) plus owner notes. Does not crawl the published domain or read page DOM content.
2. Hosted dashboard after Marketplace install — Opens tidyAgent from Webflow OAuth; onboarding, knowledge, and agent settings stay on the secure hosted app.
3. Chat widget via hosted Custom Code — Registers versioned embed.js with integrity hash and applies it site-wide; publish once so visitors see it on the live site.
4. Evidence-based answers with human handoff — Stays grounded in scanned API knowledge; escalates to a human when needed (email / WhatsApp).
5. Plan-scoped knowledge and automations — Starter / Business / Pro unlock scan depth, agents, and automations via card checkout on Webflow seats.

## App home / URLs (reference)

- App home: https://agent.tidyflowapp.com/webflow
- OAuth callback: https://agent.tidyflowapp.com/api/webflow/oauth/callback
- Documentation: https://agent.tidyflowapp.com/docs/webflow
- Exact scope mapping: webflow-extension/SCOPE_MAPPING.md
- Install and permissions: https://agent.tidyflowapp.com/install/webflow
- Terms: https://agent.tidyflowapp.com/terms?platform=webflow
- Privacy: https://agent.tidyflowapp.com/privacy?platform=webflow

Form: Architecture = Data Client. Knowledge = Webflow Data APIs only (page metadata + CMS + ecommerce; no domain crawl; no Get Page Content).

See also: https://developers.webflow.com/apps/docs/marketplace/listing-your-app
