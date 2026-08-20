# tidyAgent

AI customer service employee for **Wix** websites.

Connect a Wix site → answer a few simple questions → the system understands the business → the AI employee helps customers 24/7.

This repository is the self-hosted Next.js backend + responsive admin dashboard. Wix remains the billing source of truth. tidyAgent stores entitlements, knowledge, conversations, and tenant-isolated agent config.

## Current phase

**Phase 1 — Wix foundation** (from the product spec):

- Wix install / signed instance authentication
- Tenant provisioning into Postgres
- Responsive admin dashboard (desktop, tablet, mobile)
- Site identity + subscription entitlements on the server
- Widget branding stored on the Agent (owner colors, never forced amber/navy on the live site)

AI RAG, live Wix Stores tools, and voice come in later phases. Ecommerce is the first vertical we will prove end-to-end.

## Stack

- Next.js + TypeScript
- PostgreSQL + Prisma + pgvector
- Wix JavaScript SDK (`AppStrategy`) for self-hosted app calls
- Amber / deep navy dashboard brand

## Local setup

```bash
cp .env.example .env
docker compose up -d
npx prisma generate
npx prisma db push
npm run db:seed
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) and use **Open demo workspace**.

Platform owner console: [http://localhost:3000/admin/login](http://localhost:3000/admin/login)

- Email: `owner@tidyagent.local`
- Password: `change-me-platform-admin` (from `.env`)

The operator console lists every connected Wix site, Wix billing seats, reports, and access controls (suspend / restore / open owner workspace). It is separate from a customer dashboard.

## Wix subscriptions

Wix is the billing source of truth. tidyAgent never charges through Stripe.

| Wix event | What we do |
| --- | --- |
| App Instance Installed | Provision tenant on Free. Paid features stay off. |
| Paid Plan Purchased | Paid seat. Also fires on free-trial signup. |
| Trial → first charge | **No webhook.** Refresh via Get App Instance (`Refresh from Wix`). |
| Paid Plan Changed | Map `vendorProductId` to Starter / Growth / Pro. |
| Auto Renewal Cancelled | Keep paid access until period end. Do **not** drop to Free immediately. |
| `isFree: false` after expiry date | Billing issue — still treated as paid. |

Map each Wix Pricing plan ID:

```
WIX_VENDOR_PRODUCT_STARTER=
WIX_VENDOR_PRODUCT_GROWTH=
WIX_VENDOR_PRODUCT_PRO=
```

Webhooks: `POST /api/wix/webhooks`
Upgrade CTA: `https://www.wix.com/apps/upgrade/{APP_ID}?appInstanceId={instanceId}`

App Market listing text, Terms/Privacy URLs, and the submit checklist: [wix-app/MARKETPLACE_SUBMISSION.md](wix-app/MARKETPLACE_SUBMISSION.md)


Dev mode (`TIDYAGENT_DEV_MODE=true`) signs a session for the seeded Atelier Noir tenant. It does **not** skip tenant checks.

## Wix app connection

1. Create a Wix app in the Wix Developers Center (CLI app, not Blocks/Velo).
2. Set the dashboard/open URL to `https://<your-host>/wix/open`.
3. Subscribe to **App Instance Installed** (and billing) webhooks at `/api/wix/webhooks`.
4. Put `WIX_APP_ID`, `WIX_APP_SECRET`, and `WIX_APP_PUBLIC_KEY` in `.env`.
5. Permissions to request later: Manage Your App, Read Site Owner Email, Stores (when ecommerce tools ship).

Wix sends a signed `instance` query parameter. The backend verifies HMAC with the app secret. Plain `instanceId` values from the browser are rejected.

## Tests

```bash
npm test
```

Tenant isolation is a release gate. After seeding, the integration test asserts Tenant B cannot read Tenant A knowledge or conversations.

## Architecture

```
src/
  app/           # Next.js routes, dashboard, APIs
  modules/       # domain logic (wix, billing, agents, organizations, ai)
  services/      # Wix client, retrieval helpers
  lib/security/  # session, instance HMAC, widget tokens
```

Every tenant query is bound to `session.organizationId` from a verified cookie. Widget requests use a signed init token scoped to one site — never a client-supplied org ID.
