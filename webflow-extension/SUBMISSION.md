# Webflow Marketplace submission — tidyAgent (Data Client)

Use this checklist when filling the Webflow app submission form.

## Architecture (must match everywhere)

Architecture: Data Client only.

Do not enable a Designer Extension building block. Every submission field, production surface, and user-facing document must say Data Client — not Hybrid App, not Designer Extension.

## Permission mapping

Use the exact table in SCOPE_MAPPING.md (inline widget.js path — not hosted embed.js).

## Custom Code (critical)

Production uses one code-delivery path only:

- Executable: https://agent.tidyflowapp.com/widget.js
- Register: POST /v2/sites/{site_id}/registered_scripts/inline (loader that loads widget.js)
- Apply: PUT /v2/sites/{site_id}/custom_code (footer)
- No hosted script registration
- No embed.js registration
- No alternative production code-delivery path

## Uninstall lifecycle

1. Settings → Uninstall & remove widget
2. DELETE /v2/sites/{site_id}/custom_code (App-applied scripts only; unrelated scripts preserved)
3. Confirmation page prompts merchant to Publish the Webflow site
4. Docs: https://agent.tidyflowapp.com/docs/webflow#disconnect

Do not instruct reviewers to manually delete leftover snippets after a successful Settings uninstall.

## Short description (paste)

AI employee for your Webflow site. Learns from Webflow Data APIs and owner notes, then answers visitors 24/7 with a chat widget.

## Long description (paste)

tidyAgent is an AI customer-service employee for Webflow sites. After Marketplace install, it connects as a Data Client and teaches itself from official Webflow Data APIs — site profile, page metadata (title, SEO description, published path), CMS items, and ecommerce products when available — plus priority owner notes you add in the dashboard. It does not crawl or scrape your published domain and does not read page DOM content.

Visitors get a chat bubble on the live site through Webflow Custom Code: an inline-registered loader that loads https://agent.tidyflowapp.com/widget.js at the site footer. Publish once so the widget appears. Answers stay grounded in your site knowledge; when the AI cannot verify something, visitors can reach a real human (email / WhatsApp). Plans unlock deeper knowledge scans, specialists, and automations via card checkout on the hosted dashboard at agent.tidyflowapp.com.

## Features overview (paste up to 5)

1. AI employee for the live site — Learns from Webflow Data APIs (site profile, page metadata, CMS, ecommerce when available) plus owner notes. Does not crawl the published domain or read page DOM content.
2. Hosted dashboard after Marketplace install — Opens tidyAgent from Webflow OAuth; onboarding, knowledge, and agent settings stay on the secure hosted app.
3. Chat widget via inline Custom Code — Registers an inline loader that loads widget.js and applies it site-wide; publish once so visitors see it on the live site.
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

Form: Architecture = Data Client. Knowledge = Webflow Data APIs only (page metadata + CMS + ecommerce; no domain crawl; no Get Page Content). Custom Code = inline → widget.js only.

See also: https://developers.webflow.com/apps/docs/marketplace/listing-your-app
