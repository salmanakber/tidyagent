# Wix CLI app (companion)

tidyAgent’s intelligence lives in the Next.js app at the repo root. The Wix CLI app is the install surface: dashboard entry, webhooks, and later the lazy-loaded site widget.

Do **not** use Wix Blocks/Velo as the primary backend. This product is an externally hosted Next.js + Postgres service.

## Scaffold (run when you have Wix CLI credentials)

```bash
npm create @wix/app@latest
```

Choose the **Wix CLI** app framework. Then:

1. Point the app’s **Open App / Dashboard URL** at `https://<tidyagent-host>/wix/open`.
2. Register webhook `App Instance Installed` → `https://<tidyagent-host>/api/wix/webhooks`.
3. Also subscribe to **Paid Plan Purchased**, **Paid Plan Changed**, and **Paid Plan Auto Renewal Cancelled**.
3. For auto-install of the chat widget, add an **Embedded Script** extension that injects:

```html
<script src="https://<tidyagent-host>/widget.js" data-token="WIDGET_INIT_TOKEN" async></script>
```

The script idle-loads and must not block the host page.

Manual placement can come later as a site widget extension. Branding (color, avatar, position, greeting) is stored on the Agent in Postgres and served from `/api/widget/config?token=...`.
