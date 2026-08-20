# Wix App Market submission — tidyAgent

Follow this file when you fill the Wix Developers dashboard and click **Submit & Publish**.  
Paste the listing copy as-is unless Wix’s field counter is shorter than the text (trim from the end).

Live product: `https://agent.tidyflowapp.com`  
Legal pages (required URLs):

| Field | URL |
| --- | --- |
| Terms of Use | https://agent.tidyflowapp.com/terms |
| Privacy Policy | https://agent.tidyflowapp.com/privacy |
| Open App / Dashboard iframe | https://agent.tidyflowapp.com/wix/open |
| Webhooks | https://agent.tidyflowapp.com/api/wix/webhooks |
| Widget script | https://agent.tidyflowapp.com/widget.js |

Wix listing rules that reject apps: **do not write “Wix” in the teaser, features, or full description.** Do not put prices in the app name. Do not send users to a non-Wix checkout.

Technical companion: [README.md](./README.md) in this folder.

---

## 1. Paste into App Profile → App Info

### App name
```
tidyAgent
```
Title case. Do not add “for Wix”, prices, or “best/fast/secure”.

### Teaser (short promotional line)
```
Hire an AI employee that learns your site and helps visitors 24/7.
```
(67 characters. Speaks to the user. No company name, no “Wix”.)

### Overview / features

Wix asks for the best features first, then a full description. Paste these four:

**Feature 1**
```
Learns from your live website
```
```
Reads pages, policies, catalog, and bookings so answers match the business — not a generic script.
```

**Feature 2**
```
Stays on verified facts
```
```
If it cannot confirm an answer from your content, it says so and offers a human instead of guessing.
```

**Feature 3**
```
Hands off with full context
```
```
When a visitor needs a person, the chat passes the conversation so your team does not start from zero.
```

**Feature 4**
```
Looks and sounds like your brand
```
```
Match widget colors, photos, voices, and specialists to how your team already talks to customers.
```

### Full description

Paste as one paragraph. No bullets. No “Wix”. No unverifiable stats. (~455 characters; Wix hides text after about 500 behind “Read more”.)

```
tidyAgent is an AI employee for your website. Connect the site, answer a few simple questions, and it learns from your live pages, policies, catalog, and bookings. Visitors get answers in your brand, in chat or with optional spoken voice, and can be passed to a specialist or a person when the question should not be guessed. Start with a 7-day trial. Checkout stays in your site dashboard. Widget colors, greeting, and basic setup are included on paid plans.
```

### Terms of Use URL
```
https://agent.tidyflowapp.com/terms
```
Shown in the install consent flow.

### Demo site URL (recommended)

Publish a real Wix site with tidyAgent installed and the widget visible on the live site (Editor preview often does **not** inject embedded scripts). Paste that published URL here.

---

## 2. Company Info

| Field | Value |
| --- | --- |
| Company name (max 23 chars) | tidyAgent |
| Company website | https://agent.tidyflowapp.com |
| Privacy policy | https://agent.tidyflowapp.com/privacy |
| Support email (must be monitored) | support@tidyflowapp.com |
| Company logo | Square PNG/JPG — use `public/images/logo-icon.png` |

**Company description** (max 1,200 characters):

```
tidyAgent builds an AI customer-service employee for websites. Site owners connect their site, answer a few questions, and go live with a chat widget that uses the business’s own pages, policies, and catalog. We host the dashboard and the widget. Billing for paid plans is handled in the site dashboard. Support: support@tidyflowapp.com
```

Fill **company address** with your legal address.

---

## 3. Get Found

**Category:** Communication

**Search keywords** (max 5, no trademarks, no other app names):

1. chat
2. AI
3. customer service
4. live chat
5. chatbot

---

## 4. Media (App Profile → Media)

| Asset | Spec | What to show |
| --- | --- | --- |
| App icon | **1000 × 1000 px**, 24-bit PNG, sRGB, solid background, little or no text | Export from `public/images/logo-icon.png`. Do not use a screenshot. |
| Listing images | **At least 3**, ideally 5–6. Min **1200 × 900** (4:3), JPG or PNG | Same background family (navy/amber). |
| Main image | Name + tagline + product shot | “tidyAgent” + “An employee who never clocks out.” |
| Extra images | Dashboard + live widget | 1) widget on a published site, 2) agent studio / brand colors, 3) automations or team of agents, 4) knowledge scan, 5) mobile widget. |
| Video | YouTube URL, short promo (not a long tutorial) | Optional but helps review. |
| Promo banner | 540 × 360 JPG | Colorful, **no** app name/logo/text (Wix puts those under the banner). |

Do not put sale badges, “50% off”, or other-platform logos in images.

---

## 5. Pricing (must be Wix Billing only)

In **Pricing**, create three paid plans that match the app:

| Wix plan name | Maps to | Typical story |
| --- | --- | --- |
| Starter | `WIX_VENDOR_PRODUCT_STARTER` | 1 agent, site pages/CMS, greeting + handoff |
| Business | `WIX_VENDOR_PRODUCT_BUSINESS` | Up to 4 agents, catalog, extra automations |
| Pro | `WIX_VENDOR_PRODUCT_PRO` | Up to 8 agents, voice, highest limits |

Then:

1. Copy each plan’s vendor product ID into production `.env`.
2. Confirm **7-day free trial** on Wix if that is what `/pricing` shows.
3. Upgrade URL inside the app is already `https://www.wix.com/apps/upgrade/{APP_ID}?appInstanceId={instanceId}` — do not add Stripe or an external paywall.
4. Basic widget look (color, greeting, position) stays on paid plans and is not a separate SKU.
5. Do **not** offer a dashboard downgrade button that bypasses Wix (cancel + repurchase is how Wix expects plan changes).

Limits can be tuned later in **Platform admin → Plans**. Listing copy above matches the shipped defaults.

---

## 6. Extensions & URLs (blockers if missing)

### Dashboard Page
- Type: self-hosted iframe  
- URL: `https://agent.tidyflowapp.com/wix/open`  
- Sidebar name: `tidyAgent`  
- Same URL as **Open App**

### Embedded Script
- Type: **Essential**, placement **Body**  
- **Uncheck** “uses frontend modules from the Wix JavaScript SDK”  
- HTML:

```html
<script src="https://agent.tidyflowapp.com/widget.js" data-instance="{{instanceId}}" async></script>
```

- Dynamic parameter name: exactly `instanceId`  
- Release a **new app version**, update the test site, **publish** the Wix site  
- If you have several scripts, set `WIX_EMBEDDED_SCRIPT_COMPONENT_ID`

### Webhooks (all → same URL)

`https://agent.tidyflowapp.com/api/wix/webhooks`

- App Instance Installed  
- App Instance Removed  
- Paid Plan Purchased  
- Paid Plan Changed  
- Paid Plan Auto Renewal Cancelled  

Return HTTP 200. Use **Trigger test** in the dashboard.

### Permissions (minimum needed)

Ask only for what the product uses:

- Manage Your App  
- Manage Embedded Scripts  
- Read Site Owner Email  
- Read site, business, and email details (site properties)  
- Wix Data: Read collections and items  
- Stores: Read Products, Read Orders (Business / Pro knowledge)  

Do not add unused “manage” scopes.

---

## 7. Reviewer demo (Wix will ask)

Keep this live for as long as the app is in the Market:

1. A **published** Wix premium/dev site with tidyAgent installed and the chat bubble visible.
2. Reviewer login below — **Pro is already granted**. They do not need to buy a plan.
3. While `WIX_REVIEW_MODE=true` on production, anyone who installs from Wix during review also gets a complimentary Pro seat (so iframe review is not stuck on billing). Turn that flag off after approval.

4. App Review notes (paste into the submit form):

```
tidyAgent is a self-hosted dashboard + site widget. Open it from the Wix dashboard (sidebar: tidyAgent); the instance query param signs the owner in.

Test site: [PASTE PUBLISHED SITE URL]
Dashboard: https://agent.tidyflowapp.com/login
Reviewer email: wix-reviewer@tidyflowapp.com
Reviewer password: WixReview-tidyAgent-2026

This login is a complimentary Pro seat. Reviewers do not need to purchase a plan or enter a card.

If you install tidyAgent on a Wix site instead, open Dashboard → tidyAgent. During App Market review, unpaid installs are unlocked at Pro so you can test onboarding, the widget, specialists, and voice without checkout.

Widget: publish the site; Editor preview often hides the embedded script.
Plans: Starter / Business / Pro via Wix checkout for real customers.
Voice (Pro): spoken replies in the widget. Specialists (Business+): add a team member on AI Agent.
Terms: https://agent.tidyflowapp.com/terms
Privacy: https://agent.tidyflowapp.com/privacy
```

---

## 8. Pre-submit test checklist

Work through this on a **premium test site**, Chrome + Safari, desktop and phone.

- [ ] Install from **Test your app** → consent screen shows permissions + terms link  
- [ ] Dashboard iframe loads ` /wix/open` (not localhost)  
- [ ] Closing and reopening **Manage Apps → tidyAgent** stays signed in for that `instanceId`  
- [ ] Second Wix site is a **separate** workspace (do not reuse the first site’s data)  
- [ ] After paid plan / trial, onboarding scan runs and widget appears on the **published** site  
- [ ] Finish onboarding on a **production** install so Wix receives `APP_SETUP_FINISHED` (clears the “Add BI events” recommendation)  
- [ ] Widget uses **owner** colors, not tidyAgent amber, on the live site  
- [ ] Each plan’s Wix checkout matches names/prices in the listing  
- [ ] Cancel at period end keeps access until the period ends  
- [ ] Uninstall webhook is received; widget can be paused from Wix Manage Apps  
- [ ] Duplicate site: if Wix sends `originInstanceId`, user can finish setup again  
- [ ] Support email receives a test message  
- [ ] Terms and Privacy URLs open without login  
- [ ] No “powered by”, ads, or native JS `alert()` in the widget  
- [ ] `npm test` passes on the backend before you ship the version you submit  

---

## 9. Security & privacy disclaimer (Wix form)

Click these unless you know a fact that contradicts them. Do not invent a DPO or a clean history.

### Security Disclaimer

| Question | Answer | Why |
| --- | --- | --- |
| Is access to Wix user data through your networks, operating systems and databases configured to prevent unauthorised access and changes? | **Yes** | HTTPS only. Signed Wix `instance` / session cookies. Every query is scoped to `organizationId`. Passwords are hashed. Widget tokens are site-scoped. API keys in settings are encrypted. |
| Is Wix user data either fully pseudonymised, anonymised, encrypted, or a combination of these methods, both in transit and at rest? | **Yes** *if* the production disk/volume (or Postgres) is encrypted at rest | In transit: TLS on `agent.tidyflowapp.com` and all Wix/API calls. At rest: password hashes + AES-256-GCM for secrets. Site content and chats sit in Postgres — that counts as encrypted at rest only if the VPS volume/database has encryption enabled. Turn that on if it is not already, then answer Yes. |
| Does your company or any of its subcontractors use cloud computing (including cloud hosting) to receive, process, host or access Wix user data? | **Yes** | The app is hosted in the cloud. Subprocessors include AI providers (Gemini / Groq / OpenAI), Cloudinary (photos), and Google TTS / Amazon Polly (voice). |

If the database disk is **not** encrypted, answer **No** on the second question rather than guessing. Wix can ask how you encrypt at rest.

### Privacy Disclaimer

| Question | Answer | Why |
| --- | --- | --- |
| Do you sell consumer personal data? | **No** | Privacy Policy: chats and owner lists are not sold. |
| Did your company receive any complaints, claims or notifications from any third parties with regard to your respective privacy compliance requirements? | **No** | Only if that is actually true for you. If you have had a complaint, click Yes. |
| Did your company have a personal data breach or been investigated and/or fined by any data protection authority or been involved in litigation or claims relating to privacy or data protection? | **No** | Only if that is actually true. If there was a breach or investigation, click Yes. |
| Is there a designated organizational structure or function responsible for data privacy or data protection (e.g. a DPO)? | **No** unless you have named a person | Support inbox is not automatically a DPO. If you appoint someone (even a founder) as privacy contact and they handle `/privacy` requests, you may click **Yes**. Otherwise **No**. |

---

## 10. Submit

1. Fix every **blocker** in the app dashboard (listing, HTTPS, extensions, pricing).  
2. Release the version that is on production (`agent.tidyflowapp.com`).  
3. **Submit & Publish**.  
4. If AI review adds new blockers, fix **only those**, submit again (new AI blockers clear only after another submit).  
5. Keep the demo site and reviewer login active after approval.

Official docs:

- [Add app info](https://dev.wix.com/docs/build-apps/launch-your-app/market-listing/add-your-app-info.md)  
- [App Market guidelines](https://dev.wix.com/docs/build-apps/launch-your-app/app-distribution/app-market-guidelines.md)  
- [Testing guide](https://dev.wix.com/docs/build-apps/launch-your-app/app-distribution/test-your-app/app-checks-and-testing-guide.md)  
- [Submit a version](https://dev.wix.com/docs/build-apps/launch-your-app/app-distribution/submit-your-first-app-version.md)  
