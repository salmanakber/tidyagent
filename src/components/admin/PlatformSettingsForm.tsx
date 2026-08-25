"use client";

import { useActionState, useState, useTransition } from "react";
import { savePlatformSettings, testAIProviders, openReviewerDashboard } from "@/app/actions/settings";
import { VoiceSelect, VoiceTestButton } from "@/components/voice/VoiceTestButton";

export function PlatformSettingsForm({
  failoverEnabled,
  order,
  configured,
  googleClientId,
  cloudinaryCloudName,
  operatorEmail,
  extraEmails,
  models,
  modelOptions,
  planPriceStarter,
  planPriceBusiness,
  planPricePro,
  planPriceCurrency,
  planTrialDays,
  platformPrices,
  productFounder,
  googleTtsVoice,
  reviewMode,
  webflowReviewMode,
  shopifyReviewMode,
  reviewerEmail,
  reviewerEmails,
  reviewerPasswordSet,
  resendFromEmail,
  stripePublishableKey,
  stripeWebhookUrl,
  marketplace,
}: {
  failoverEnabled: boolean;
  order: string;
  configured: {
    gemini: boolean;
    groq: boolean;
    openai: boolean;
    googleClientId: boolean;
    googleClientSecret: boolean;
    cloudinaryCloudName: boolean;
    cloudinaryApiKey: boolean;
    cloudinaryApiSecret: boolean;
    adminPassword: boolean;
    googleTts: boolean;
    awsPolly: boolean;
    resend: boolean;
    stripeSecret: boolean;
    stripeWebhook: boolean;
  };
  googleClientId: string;
  cloudinaryCloudName: string;
  operatorEmail: string;
  extraEmails: string;
  models: { gemini: string; groq: string; openai: string };
  modelOptions: {
    gemini: { id: string; label: string; note: string }[];
    groq: { id: string; label: string; note: string }[];
    openai: { id: string; label: string; note: string }[];
  };
  planPriceStarter: string;
  planPriceBusiness: string;
  planPricePro: string;
  planPriceCurrency: string;
  planTrialDays: string;
  platformPrices: {
    wix: { starter: string; business: string; pro: string; currency: string };
    webflow: { starter: string; business: string; pro: string; currency: string };
    shopify: { starter: string; business: string; pro: string; currency: string };
  };
  productFounder: string;
  googleTtsVoice: string;
  reviewMode: boolean;
  webflowReviewMode: boolean;
  shopifyReviewMode: boolean;
  reviewerEmail: string;
  reviewerEmails: string;
  reviewerPasswordSet: boolean;
  resendFromEmail: string;
  stripePublishableKey: string;
  stripeWebhookUrl: string;
  marketplace: {
    origin: string;
    widgetSrc: string;
    webflow: {
      enabled: boolean;
      clientId: string;
      clientSecretSet: boolean;
      redirectUri: string;
      installPath: string;
      appHomeUrl: string;
    };
    shopify: {
      enabled: boolean;
      apiKey: string;
      apiSecretSet: boolean;
      redirectUri: string;
      installPath: string;
      appHomeUrl: string;
    };
  };
}) {
  const [state, formAction, saving] = useActionState(savePlatformSettings, null);
  const [pending, startTransition] = useTransition();
  const [testResult, setTestResult] = useState<string | null>(null);
  const [voiceId, setVoiceId] = useState(googleTtsVoice || "en-US-Neural2-F");

  return (
    <form action={formAction} className="space-y-6">
      {state?.ok ? (
        <p className="rounded-2xl bg-emerald-500/10 px-4 py-3 text-sm text-emerald-200">Settings saved.</p>
      ) : null}
      {state?.error ? (
        <p className="rounded-2xl bg-rose-500/10 px-4 py-3 text-sm text-rose-200">{state.error}</p>
      ) : null}

      <div className="panel p-6">
        <h2 className="font-display text-xl text-white">Platform login</h2>
        <p className="mt-2 text-sm text-navy-300">
          Operator email and password are stored in the database, not in <code className="text-amber-200">.env</code>.
          Leave the password blank to keep the current one.
        </p>
        <div className="mt-5 grid gap-4">
          <label className="text-sm text-navy-300">
            Operator email
            <input
              className="field mt-2"
              name="platform_admin_email"
              type="email"
              defaultValue={operatorEmail}
              placeholder="you@company.com"
              required
            />
          </label>
          <label className="text-sm text-navy-300">
            Extra operator emails
            <input
              className="field mt-2"
              name="platform_admin_emails"
              defaultValue={extraEmails}
              placeholder="ops@company.com, support@company.com"
            />
            <span className="mt-1 block text-xs text-navy-400">Comma-separated. These emails can also sign in with the same password.</span>
          </label>
          <label className="text-sm text-navy-300">
            New password {configured.adminPassword ? <span className="text-emerald-300">(saved)</span> : <span className="text-amber-300">(not set yet)</span>}
            <input className="field mt-2" name="platform_admin_password" type="password" autoComplete="new-password" />
          </label>
          <label className="text-sm text-navy-300">
            Confirm password
            <input className="field mt-2" name="platform_admin_password_confirm" type="password" autoComplete="new-password" />
          </label>
        </div>
      </div>

      <div className="panel p-6">
        <h2 className="font-display text-xl text-white">Marketplace testing</h2>
        <p className="mt-2 text-sm text-navy-300">
          Each marketplace has its own testing toggle. When a toggle is on, unpaid installs on that platform get a
          complimentary Pro seat and the owner dashboard shows Test AI. Turn a toggle off after that marketplace
          approves the app. Wix reviewer login credentials below only apply to Wix App Market review.
        </p>
        <div className="mt-5 grid gap-4">
          <label className="flex items-start gap-3 text-sm">
            <input type="checkbox" name="wix_review_mode" defaultChecked={reviewMode} className="mt-1" />
            <span>
              <span className="text-white">Enable Wix testing mode</span>
              <span className="mt-1 block text-xs text-navy-400">
                Test AI + complimentary Pro for Wix installs only. Does not require a .env restart.
              </span>
            </span>
          </label>
          <label className="flex items-start gap-3 text-sm">
            <input type="checkbox" name="webflow_review_mode" defaultChecked={webflowReviewMode} className="mt-1" />
            <span>
              <span className="text-white">Enable Webflow testing mode</span>
              <span className="mt-1 block text-xs text-navy-400">
                Test AI + complimentary Pro for Webflow installs only. Does not affect Wix or Shopify.
              </span>
            </span>
          </label>
          <label className="flex items-start gap-3 text-sm">
            <input type="checkbox" name="shopify_review_mode" defaultChecked={shopifyReviewMode} className="mt-1" />
            <span>
              <span className="text-white">Enable Shopify testing mode</span>
              <span className="mt-1 block text-xs text-navy-400">
                Test AI + complimentary Pro for Shopify installs only. Does not affect Wix or Webflow.
              </span>
            </span>
          </label>
          <label className="text-sm text-navy-300">
            Wix reviewer email
            <input
              className="field mt-2"
              name="wix_reviewer_email"
              type="email"
              defaultValue={reviewerEmail}
              placeholder="wix-reviewer@tidyflowapp.com"
            />
          </label>
          <label className="text-sm text-navy-300">
            Extra reviewer emails
            <input
              className="field mt-2"
              name="wix_reviewer_emails"
              defaultValue={reviewerEmails}
              placeholder="qa@wix.com"
            />
            <span className="mt-1 block text-xs text-navy-400">
              Comma-separated. These emails also get a Pro seat (any marketplace).
            </span>
          </label>
          <label className="text-sm text-navy-300">
            Wix reviewer password{" "}
            {reviewerPasswordSet ? <span className="text-emerald-300">(saved)</span> : <span className="text-amber-300">(not set yet)</span>}
            <input className="field mt-2" name="wix_reviewer_password" type="password" autoComplete="new-password" />
            <span className="mt-1 block text-xs text-navy-400">
              Leave blank to keep the current password. Required the first time you enable Wix testing mode.
            </span>
          </label>
          <button
            type="button"
            className="btn-secondary w-fit"
            disabled={saving || pending}
            onClick={() =>
              startTransition(async () => {
                await openReviewerDashboard();
              })
            }
          >
            Open Wix reviewer dashboard
          </button>
        </div>
      </div>

      <div className="panel p-6">
        <h2 className="font-display text-xl text-white">Webflow &amp; Shopify</h2>
        <p className="mt-2 text-sm text-navy-300">
          Credentials live here, encrypted in the database — not in <code className="text-amber-200">.env</code>.
          Wix installs are not affected. Leave an adapter off until you have finished the steps below.
        </p>

        <div className="mt-6 rounded-2xl border border-white/10 bg-white/5 p-4">
          <h3 className="text-sm font-medium text-white">Webflow setup</h3>
          <ol className="mt-3 list-decimal space-y-2 pl-5 text-sm leading-6 text-navy-300">
            <li>
              In Webflow: Workspace settings → Apps &amp; Integrations → Register app. Building blocks:{" "}
              <strong className="text-white">Data Client</strong> plus a{" "}
              <strong className="text-white">Designer Extension</strong> so site owners get Launch inside the
              Designer, not only Open app.
            </li>
            <li>
              Homepage / App home URL (Open app uses this — paste this, not the marketing site):
              <code className="mt-1 block break-all text-amber-200">{marketplace.webflow.appHomeUrl}</code>
            </li>
            <li>
              Redirect URL (paste this exactly):
              <code className="mt-1 block break-all text-amber-200">{marketplace.webflow.redirectUri}</code>
            </li>
            <li>
              Designer Extension development URL (Launch in Designer):
              <code className="mt-1 block break-all text-amber-200">{marketplace.webflow.appHomeUrl}</code>
              Upload the zip from <code className="text-amber-200">npm run webflow:extension</code> (
              <code className="text-amber-200">tidyagent-webflow-extension.zip</code>). For Marketplace
              submission also upload{" "}
              <code className="text-amber-200">tidyagent-webflow-extension-sourcemaps.zip</code> and the
              App Review Preflight <code className="text-amber-200">wfpre_</code> receipt — see{" "}
              <code className="text-amber-200">webflow-extension/SUBMISSION.md</code>.
            </li>
            <li>
              Data Client permissions — turn <strong className="text-white">on</strong>: Sites (read + write), Pages
              (read + write), Custom code (read + write), CMS (read), Ecommerce (read), Authorized user (read). Optional:
              Forms (read), Assets (read). Leave Comments, Components, Site activity, and Workspace write{" "}
              <strong className="text-white">off</strong>. After the app is published, new scopes need a Webflow app
              update, so add CMS and Ecommerce now even if a site has no shop yet.
            </li>
            <li>Copy Client ID and Client Secret into the fields below, then save.</li>
            <li>
              Tick <strong className="text-white">Enable Webflow</strong> only when you are ready to test OAuth.
              Site owners will later install from{" "}
              <code className="text-amber-200">{marketplace.webflow.installPath}</code>. After install, Open app
              should show the dashboard. Custom code is injected automatically; they still need to{" "}
              <strong className="text-white">Publish</strong> the Webflow site for the widget to appear.
            </li>
            <li>
              Widget script for Webflow Custom Code:
              <code className="mt-1 block break-all text-amber-200">{`<script src="${marketplace.widgetSrc}" async></script>`}</code>
            </li>
          </ol>
        </div>

        <div className="mt-5 grid gap-4">
          <label className="flex items-start gap-3 text-sm">
            <input type="checkbox" name="webflow_enabled" defaultChecked={marketplace.webflow.enabled} className="mt-1" />
            <span>
              <span className="text-white">Enable Webflow</span>
              <span className="mt-1 block text-xs text-navy-400">
                Off by default. Does not change Wix billing, embed, or App Market.
              </span>
            </span>
          </label>
          <label className="text-sm text-navy-300">
            Webflow client ID {marketplace.webflow.clientId ? <span className="text-emerald-300">(saved)</span> : null}
            <input
              className="field mt-2"
              name="webflow_client_id"
              defaultValue={marketplace.webflow.clientId}
              placeholder="Webflow client ID"
              autoComplete="off"
            />
          </label>
          <label className="text-sm text-navy-300">
            Webflow client secret{" "}
            {marketplace.webflow.clientSecretSet ? (
              <span className="text-emerald-300">(saved)</span>
            ) : (
              <span className="text-amber-300">(not set yet)</span>
            )}
            <input className="field mt-2" name="webflow_client_secret" type="password" autoComplete="off" />
          </label>
        </div>

        <div className="mt-8 rounded-2xl border border-white/10 bg-white/5 p-4">
          <h3 className="text-sm font-medium text-white">Shopify setup</h3>
          <ol className="mt-3 list-decimal space-y-2 pl-5 text-sm leading-6 text-navy-300">
            <li>
              In Shopify Partners → Apps → Create app. App URL / home:
              <code className="mt-1 block break-all text-amber-200">{marketplace.shopify.appHomeUrl}</code>
            </li>
            <li>
              Allowed redirection URL:
              <code className="mt-1 block break-all text-amber-200">{marketplace.shopify.redirectUri}</code>
            </li>
            <li>
              Privacy webhooks (required for App Store). Use the same URL in both places when applicable:
              <code className="mt-1 block break-all text-amber-200">{`${marketplace.origin}/api/shopify/webhooks`}</code>
              <span className="mt-2 block text-xs text-navy-400">
                Partner Dashboard: paste that HTTPS URL under GDPR / privacy webhooks. CLI / Dev Dashboard apps:
                also declare <code className="text-amber-200">compliance_topics</code> in{" "}
                <code className="text-amber-200">shopify.app.toml</code> at the repo root and run{" "}
                <code className="text-amber-200">shopify app deploy</code> — for those apps, TOML + deploy is
                required; pasting the URL alone is not enough. Topics: customers/data_request, customers/redact,
                shop/redact. Endpoint must return 401 on bad HMAC (already implemented).
              </span>
            </li>
            <li>
              Access scopes: products, orders, customers, content, themes, script tags (read + write), locales. The
              app injects <code className="text-amber-200">widget.js</code> as a ScriptTag. Publish is not needed;
              the storefront picks it up after inject.
            </li>
            <li>
              Billing uses Shopify&apos;s native app subscriptions (not card checkout). Set Shopify package prices in
              the pricing section. On development stores, charges run in test mode automatically until production.
            </li>
            <li>Copy API key and API secret into the fields below, then save.</li>
            <li>
              Tick <strong className="text-white">Enable Shopify</strong> when you are ready to test OAuth. Test
              installs start at{" "}
              <code className="text-amber-200">{marketplace.shopify.installPath}?shop=your-store.myshopify.com</code>.
            </li>
          </ol>
        </div>

        <div className="mt-5 grid gap-4">
          <label className="flex items-start gap-3 text-sm">
            <input type="checkbox" name="shopify_enabled" defaultChecked={marketplace.shopify.enabled} className="mt-1" />
            <span>
              <span className="text-white">Enable Shopify</span>
              <span className="mt-1 block text-xs text-navy-400">
                Off by default. Does not change Wix or Webflow billing, embed, or installs.
              </span>
            </span>
          </label>
          <label className="text-sm text-navy-300">
            Shopify API key {marketplace.shopify.apiKey ? <span className="text-emerald-300">(saved)</span> : null}
            <input
              className="field mt-2"
              name="shopify_api_key"
              defaultValue={marketplace.shopify.apiKey}
              placeholder="Shopify API key / client ID"
              autoComplete="off"
            />
          </label>
          <label className="text-sm text-navy-300">
            Shopify API secret{" "}
            {marketplace.shopify.apiSecretSet ? (
              <span className="text-emerald-300">(saved)</span>
            ) : (
              <span className="text-amber-300">(not set yet)</span>
            )}
            <input className="field mt-2" name="shopify_api_secret" type="password" autoComplete="off" />
          </label>
        </div>
      </div>

      <div className="panel p-6">
        <h2 className="font-display text-xl text-white">Card payments (Webflow only)</h2>
        <p className="mt-2 text-sm text-navy-300">
          Used for Webflow checkout only. Shopify uses Shopify Billing. Wix App Market billing is unchanged. Keys are
          stored encrypted — leave blank to keep the current value. Set Webflow package prices in the pricing section
          below.
        </p>
        <ol className="mt-4 list-decimal space-y-2 pl-5 text-sm leading-6 text-navy-300">
          <li>
            In Stripe Dashboard → Developers → API keys, copy the secret key (and optionally the publishable key).
          </li>
          <li>
            Add a webhook endpoint pointing at:
            <code className="mt-1 block break-all text-amber-200">{stripeWebhookUrl}</code>
            Events: <code className="text-amber-200">checkout.session.completed</code>,{" "}
            <code className="text-amber-200">customer.subscription.*</code>,{" "}
            <code className="text-amber-200">invoice.paid</code>,{" "}
            <code className="text-amber-200">invoice.payment_failed</code>.
          </li>
          <li>Paste the webhook signing secret (<code className="text-amber-200">whsec_…</code>) below and save.</li>
          <li>Enable Customer Portal in Stripe for plan changes and cancellations.</li>
        </ol>
        <div className="mt-5 grid gap-4">
          <label className="text-sm text-navy-300">
            Stripe secret key{" "}
            {configured.stripeSecret ? (
              <span className="text-emerald-300">(saved)</span>
            ) : (
              <span className="text-amber-300">(not set yet)</span>
            )}
            <input
              className="field mt-2"
              name="stripe_secret_key"
              type="password"
              placeholder="sk_live_… or sk_test_…"
              autoComplete="off"
            />
          </label>
          <label className="text-sm text-navy-300">
            Stripe webhook secret{" "}
            {configured.stripeWebhook ? (
              <span className="text-emerald-300">(saved)</span>
            ) : (
              <span className="text-amber-300">(not set yet)</span>
            )}
            <input
              className="field mt-2"
              name="stripe_webhook_secret"
              type="password"
              placeholder="whsec_…"
              autoComplete="off"
            />
          </label>
          <label className="text-sm text-navy-300">
            Stripe publishable key (optional)
            <input
              className="field mt-2"
              name="stripe_publishable_key"
              defaultValue={stripePublishableKey}
              placeholder="pk_live_… or pk_test_…"
              autoComplete="off"
            />
          </label>
        </div>
      </div>

      <div className="panel p-6">
        <h2 className="font-display text-xl text-white">AI providers</h2>
        <p className="mt-2 text-sm text-navy-300">
          Keys are stored encrypted in the database. Leave a field blank to keep the current key. If the first
          provider fails, the next one in the order is tried automatically.
        </p>
        <div className="mt-5 grid gap-4">
          <label className="text-sm text-navy-300">
            Gemini API key {configured.gemini ? <span className="text-emerald-300">(saved)</span> : null}
            <input className="field mt-2" name="gemini_api_key" type="password" placeholder="AIza…" autoComplete="off" />
          </label>
          <label className="text-sm text-navy-300">
            Groq API key {configured.groq ? <span className="text-emerald-300">(saved)</span> : null}
            <input className="field mt-2" name="groq_api_key" type="password" placeholder="gsk_…" autoComplete="off" />
          </label>
          <label className="text-sm text-navy-300">
            OpenAI API key {configured.openai ? <span className="text-emerald-300">(saved)</span> : null}
            <input className="field mt-2" name="openai_api_key" type="password" placeholder="sk-…" autoComplete="off" />
          </label>
          <div className="grid gap-4 sm:grid-cols-3">
            <label className="text-sm text-navy-300">
              Gemini model
              <select className="field mt-2" name="gemini_model" defaultValue={models.gemini}>
                {modelOptions.gemini.map((option) => (
                  <option key={option.id} value={option.id}>
                    {option.label} — {option.note}
                  </option>
                ))}
              </select>
            </label>
            <label className="text-sm text-navy-300">
              Groq model
              <select className="field mt-2" name="groq_model" defaultValue={models.groq}>
                {modelOptions.groq.map((option) => (
                  <option key={option.id} value={option.id}>
                    {option.label} — {option.note}
                  </option>
                ))}
              </select>
            </label>
            <label className="text-sm text-navy-300">
              OpenAI model
              <select className="field mt-2" name="openai_model" defaultValue={models.openai}>
                {modelOptions.openai.map((option) => (
                  <option key={option.id} value={option.id}>
                    {option.label} — {option.note}
                  </option>
                ))}
              </select>
            </label>
          </div>
          <p className="text-xs text-navy-400">
            Defaults are free-tier models. If a model returns 404, the next free model on that provider is tried automatically.
          </p>
          <label className="text-sm text-navy-300">
            Failover order
            <input className="field mt-2" name="ai_provider_order" defaultValue={order} />
            <span className="mt-1 block text-xs text-navy-400">Comma-separated. Example: gemini,groq,openai</span>
          </label>
          <label className="flex items-center gap-3 text-sm">
            <input type="checkbox" name="ai_failover_enabled" defaultChecked={failoverEnabled} />
            If one provider fails, try the next
          </label>
        </div>
      </div>

      <div className="panel p-6">
        <h2 className="font-display text-xl text-white">Google login</h2>
        <p className="mt-2 text-sm text-navy-300">
          Used for owner signup/sign-in. Redirect URI:{" "}
          <code className="text-amber-200">/api/auth/google/callback</code>
        </p>
        <div className="mt-5 grid gap-4">
          <label className="text-sm text-navy-300">
            Google client ID {configured.googleClientId ? <span className="text-emerald-300">(saved)</span> : null}
            <input
              className="field mt-2"
              name="google_client_id"
              defaultValue={googleClientId}
              placeholder="….apps.googleusercontent.com"
            />
          </label>
          <label className="text-sm text-navy-300">
            Google client secret {configured.googleClientSecret ? <span className="text-emerald-300">(saved)</span> : null}
            <input className="field mt-2" name="google_client_secret" type="password" autoComplete="off" />
          </label>
        </div>
      </div>

      <div className="panel p-6">
        <h2 className="font-display text-xl text-white">Cloudinary</h2>
        <p className="mt-2 text-sm text-navy-300">
          Used for agent and chat-widget profile photos. Create a free Cloudinary account, then paste the cloud
          name, API key, and API secret from the dashboard.
        </p>
        <div className="mt-5 grid gap-4">
          <label className="text-sm text-navy-300">
            Cloud name {configured.cloudinaryCloudName ? <span className="text-emerald-300">(saved)</span> : null}
            <input className="field mt-2" name="cloudinary_cloud_name" defaultValue={cloudinaryCloudName} placeholder="your-cloud" />
          </label>
          <label className="text-sm text-navy-300">
            API key {configured.cloudinaryApiKey ? <span className="text-emerald-300">(saved)</span> : null}
            <input className="field mt-2" name="cloudinary_api_key" type="password" autoComplete="off" />
          </label>
          <label className="text-sm text-navy-300">
            API secret {configured.cloudinaryApiSecret ? <span className="text-emerald-300">(saved)</span> : null}
            <input className="field mt-2" name="cloudinary_api_secret" type="password" autoComplete="off" />
          </label>
        </div>
      </div>

      <div className="panel p-6">
        <h2 className="font-display text-xl text-white">Resend email</h2>
        <p className="mt-2 text-sm text-navy-300">
          Used to email the site owner when a visitor waits for a person, and again when they leave a lead. Create a
          Resend API key and a verified from-address.
        </p>
        <div className="mt-5 grid gap-4 sm:grid-cols-2">
          <label className="text-sm text-navy-300">
            API key {configured.resend ? <span className="text-emerald-300">(saved)</span> : null}
            <input className="field mt-2" name="resend_api_key" type="password" autoComplete="off" placeholder="re_…" />
          </label>
          <label className="text-sm text-navy-300">
            From email
            <input className="field mt-2" name="resend_from_email" defaultValue={resendFromEmail} placeholder="Chat &lt;hello@yourdomain.com&gt;" />
          </label>
        </div>
      </div>

      <div className="panel p-6">
        <h2 className="font-display text-xl text-white">Spoken voice (Pro)</h2>
        <p className="mt-2 text-sm text-navy-300">
          Save the Google API key first, then press Play test voice. You should hear a sample. If Google is not enabled
          or the key is restricted, the error message appears here instead of failing silently. Amazon Polly is only used
          if Google fails.
        </p>
        <div className="mt-5 grid gap-4">
          <label className="text-sm text-navy-300">
            Google TTS API key {configured.googleTts ? <span className="text-emerald-300">(saved)</span> : null}
            <input className="field mt-2" name="google_tts_api_key" type="password" placeholder="AIza…" autoComplete="off" />
          </label>
          <label className="text-sm text-navy-300">
            Default voice
            <input type="hidden" name="google_tts_voice" value={voiceId} />
            <VoiceSelect value={voiceId} onChange={setVoiceId} />
          </label>
          <VoiceTestButton voiceId={voiceId} />
          <div className="grid gap-4 sm:grid-cols-2">
            <label className="text-sm text-navy-300">
              AWS access key {configured.awsPolly ? <span className="text-emerald-300">(saved)</span> : null}
              <input className="field mt-2" name="aws_access_key_id" type="password" autoComplete="off" />
            </label>
            <label className="text-sm text-navy-300">
              AWS secret key
              <input className="field mt-2" name="aws_secret_access_key" type="password" autoComplete="off" />
            </label>
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <label className="text-sm text-navy-300">
              AWS region
              <input className="field mt-2" name="aws_region" placeholder="us-east-1" />
            </label>
            <label className="text-sm text-navy-300">
              Polly voice
              <input className="field mt-2" name="polly_voice" placeholder="Joanna" />
            </label>
          </div>
        </div>
      </div>

      <div className="panel p-6">
        <h2 className="font-display text-xl text-white">Plan prices by platform</h2>
        <p className="mt-2 text-sm text-navy-300">
          Each marketplace can show its own Starter / Business / Pro price. Wix still prefers live App Plans amounts
          when those exist. Webflow and Shopify tenants only see the prices in their column — never another
          marketplace.
        </p>
        <div className="mt-6 grid gap-6 lg:grid-cols-3">
          <PriceColumn
            title="Wix"
            prefix="wix"
            hint="Fallback if live Wix App Plans do not return amounts"
            values={platformPrices.wix}
          />
          <PriceColumn
            title="Webflow"
            prefix="webflow"
            hint="Shown only on Webflow billing"
            values={platformPrices.webflow}
          />
          <PriceColumn
            title="Shopify"
            prefix="shopify"
            hint="Shown only on Shopify billing"
            values={platformPrices.shopify}
          />
        </div>
        <label className="mt-5 block text-sm text-navy-300">
          Trial days
          <input className="field mt-2 max-w-xs" name="plan_trial_days" defaultValue={planTrialDays} placeholder="7" />
        </label>
        <label className="mt-5 block text-sm text-navy-300">
          Founder / who built tidyAgent
          <input
            className="field mt-2"
            name="product_founder"
            defaultValue={productFounder}
            placeholder="The tidyFlow team"
          />
          <span className="mt-1 block text-xs text-navy-400">
            Used when a visitor asks who founded tidyAgent. Chat quotes the price list for that visitor’s platform.
          </span>
        </label>
      </div>

      <div className="flex flex-wrap gap-2">
        <button className="btn-primary" disabled={saving || pending}>
          {saving ? "Saving…" : "Save settings"}
        </button>
        <button
          type="button"
          className="btn-secondary"
          disabled={saving || pending}
          onClick={() =>
            startTransition(async () => {
              try {
                const result = await testAIProviders();
                if (result.ok) {
                  setTestResult(`Working: ${result.provider} (${result.model}) → ${result.text}`);
                } else {
                  setTestResult(result.error);
                }
              } catch (error) {
                setTestResult(error instanceof Error ? error.message : "Test failed");
              }
            })
          }
        >
          Test failover now
        </button>
      </div>
      {testResult ? <p className="text-sm text-navy-200">{testResult}</p> : null}
    </form>
  );
}

function PriceColumn({
  title,
  prefix,
  hint,
  values,
}: {
  title: string;
  prefix: "wix" | "webflow" | "shopify";
  hint: string;
  values: { starter: string; business: string; pro: string; currency: string };
}) {
  return (
    <div className="rounded-2xl border border-white/10 bg-white/5 p-4">
      <h3 className="text-sm font-medium text-white">{title}</h3>
      <p className="mt-1 text-xs leading-5 text-navy-400">{hint}</p>
      <label className="mt-4 block text-sm text-navy-300">
        Starter / month
        <input className="field mt-2" name={`plan_price_${prefix}_starter`} defaultValue={values.starter} placeholder="19" />
      </label>
      <label className="mt-3 block text-sm text-navy-300">
        Business / month
        <input className="field mt-2" name={`plan_price_${prefix}_business`} defaultValue={values.business} placeholder="49" />
      </label>
      <label className="mt-3 block text-sm text-navy-300">
        Pro / month
        <input className="field mt-2" name={`plan_price_${prefix}_pro`} defaultValue={values.pro} placeholder="99" />
      </label>
      <label className="mt-3 block text-sm text-navy-300">
        Currency
        <input className="field mt-2" name={`plan_price_${prefix}_currency`} defaultValue={values.currency} placeholder="USD" />
      </label>
    </div>
  );
}
