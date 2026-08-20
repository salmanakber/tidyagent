"use client";

import { useActionState, useState, useTransition } from "react";
import { savePlatformSettings, testAIProviders } from "@/app/actions/settings";

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
}) {
  const [state, formAction, saving] = useActionState(savePlatformSettings, null);
  const [pending, startTransition] = useTransition();
  const [testResult, setTestResult] = useState<string | null>(null);

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
        <h2 className="font-display text-xl text-white">Spoken voice (Pro)</h2>
        <p className="mt-2 text-sm text-navy-300">
          Google Cloud Text-to-Speech is used first. Amazon Polly is the fallback if Google is missing or fails.
          Leave a field blank to keep the current value.
        </p>
        <div className="mt-5 grid gap-4">
          <label className="text-sm text-navy-300">
            Google TTS API key {configured.googleTts ? <span className="text-emerald-300">(saved)</span> : null}
            <input className="field mt-2" name="google_tts_api_key" type="password" placeholder="AIza…" autoComplete="off" />
          </label>
          <label className="text-sm text-navy-300">
            Google voice name
            <input className="field mt-2" name="google_tts_voice" placeholder="en-US-Neural2-F" />
          </label>
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
        <h2 className="font-display text-xl text-white">Displayed plan prices</h2>
        <p className="mt-2 text-sm text-navy-300">
          The public pricing page first loads live Wix App Plans prices. These fields are the fallback if Wix does not
          return amounts.
        </p>
        <div className="mt-5 grid gap-4 sm:grid-cols-2 lg:grid-cols-5">
          <label className="text-sm text-navy-300">
            Starter / month
            <input className="field mt-2" name="plan_price_starter" defaultValue={planPriceStarter} placeholder="19" />
          </label>
          <label className="text-sm text-navy-300">
            Business / month
            <input className="field mt-2" name="plan_price_business" defaultValue={planPriceBusiness} placeholder="49" />
          </label>
          <label className="text-sm text-navy-300">
            Pro / month
            <input className="field mt-2" name="plan_price_pro" defaultValue={planPricePro} placeholder="99" />
          </label>
          <label className="text-sm text-navy-300">
            Currency
            <input className="field mt-2" name="plan_price_currency" defaultValue={planPriceCurrency} placeholder="USD" />
          </label>
          <label className="text-sm text-navy-300">
            Trial days
            <input className="field mt-2" name="plan_trial_days" defaultValue={planTrialDays} placeholder="7" />
          </label>
        </div>
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
