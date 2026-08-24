"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { requireAdminSession, setImpersonationFlag } from "@/lib/security/admin-session";
import { getAIRuntimeConfig, getCloudinaryConfig, getSetting, setSetting, settingExists } from "@/lib/security/settings";
import { getAIProvider } from "@/modules/ai/factory";
import { hashPassword } from "@/lib/security/passwords";
import { getEnv } from "@/lib/env";
import { GEMINI_MODELS, GROQ_MODELS, OPENAI_MODELS } from "@/modules/ai/models";
import type { PlanKey } from "@prisma/client";
import { saveAllPlanScopes } from "@/modules/billing/plan-scope-store";
import type { PlanScopeConfig } from "@/modules/billing/plan-scopes";
import { ensureReviewerWorkspace, getReviewerConfig, signInReviewer } from "@/modules/auth/reviewer";
import { getMarketplaceAdapterConfig } from "@/modules/platforms/marketplace";

export async function getPlatformSettingsView() {
  await requireAdminSession("SUPER");
  const config = await getAIRuntimeConfig();
  const cloudinary = await getCloudinaryConfig();
  const [geminiSet, groqSet, openaiSet, googleIdSet, googleSecretSet, cloudNameSet, cloudKeySet, cloudSecretSet, googleTtsSet, awsKeySet, awsSecretSet, resendSet] = await Promise.all([
    settingExists("gemini_api_key"),
    settingExists("groq_api_key"),
    settingExists("openai_api_key"),
    settingExists("google_client_id"),
    settingExists("google_client_secret"),
    settingExists("cloudinary_cloud_name"),
    settingExists("cloudinary_api_key"),
    settingExists("cloudinary_api_secret"),
    settingExists("google_tts_api_key"),
    settingExists("aws_access_key_id"),
    settingExists("aws_secret_access_key"),
    settingExists("resend_api_key"),
  ]);
  const env = getEnv();
  const googleClientId = await getSetting("google_client_id");
  const cloudinaryCloudName = await getSetting("cloudinary_cloud_name", cloudinary.cloudName);
  const operatorEmail = await getSetting("platform_admin_email", env.PLATFORM_ADMIN_EMAIL);
  const extraEmails = await getSetting("platform_admin_emails", env.PLATFORM_ADMIN_EMAILS);
  const passwordSet = await settingExists("platform_admin_password_hash");
  const planPriceStarter = await getSetting("plan_price_starter");
  const planPriceBusiness = await getSetting("plan_price_business");
  const planPricePro = await getSetting("plan_price_pro");
  const planPriceCurrency = await getSetting("plan_price_currency", "USD");
  const planTrialDays = await getSetting("plan_trial_days", "7");
  const productFounder = await getSetting("product_founder");
  const googleTtsVoice = await getSetting("google_tts_voice", env.GOOGLE_TTS_VOICE);
  const reviewer = await getReviewerConfig();
  const reviewerPasswordSet = await settingExists("wix_reviewer_password");

  return {
    failoverEnabled: config.failoverEnabled,
    order: config.order.join(","),
    configured: {
      gemini: geminiSet || Boolean(config.keys.gemini),
      groq: groqSet || Boolean(config.keys.groq),
      openai: openaiSet || Boolean(config.keys.openai),
      googleClientId: googleIdSet || Boolean(googleClientId),
      googleClientSecret: googleSecretSet,
      cloudinaryCloudName: cloudNameSet || Boolean(cloudinary.cloudName),
      cloudinaryApiKey: cloudKeySet || Boolean(cloudinary.apiKey),
      cloudinaryApiSecret: cloudSecretSet || Boolean(cloudinary.apiSecret),
      adminPassword: passwordSet,
      googleTts: googleTtsSet || Boolean(env.GOOGLE_TTS_API_KEY),
      awsPolly: (awsKeySet && awsSecretSet) || Boolean(env.AWS_ACCESS_KEY_ID && env.AWS_SECRET_ACCESS_KEY),
      resend: resendSet,
    },
    googleClientId,
    cloudinaryCloudName,
    operatorEmail,
    extraEmails,
    models: config.models,
    modelOptions: {
      gemini: GEMINI_MODELS,
      groq: GROQ_MODELS,
      openai: OPENAI_MODELS,
    },
    planPriceStarter,
    planPriceBusiness,
    planPricePro,
    planPriceCurrency,
    planTrialDays,
    productFounder,
    googleTtsVoice: googleTtsVoice || "en-US-Neural2-F",
    reviewMode: reviewer.reviewMode,
    reviewerEmail: reviewer.emails[0] ?? env.WIX_REVIEWER_EMAIL,
    reviewerEmails: reviewer.emails.slice(1).join(", "),
    reviewerPasswordSet: reviewerPasswordSet || Boolean(env.WIX_REVIEWER_PASSWORD),
    resendFromEmail: await getSetting("resend_from_email"),
    marketplace: await getMarketplaceAdapterConfig(),
  };
}

export async function savePlatformSettings(_prev: { ok: boolean; error?: string } | null, formData: FormData) {
  try {
    await requireAdminSession("SUPER");

    const gemini = String(formData.get("gemini_api_key") ?? "").trim();
    const groq = String(formData.get("groq_api_key") ?? "").trim();
    const openai = String(formData.get("openai_api_key") ?? "").trim();
    const googleClientId = String(formData.get("google_client_id") ?? "").trim();
    const googleClientSecret = String(formData.get("google_client_secret") ?? "").trim();
    const cloudinaryCloudName = String(formData.get("cloudinary_cloud_name") ?? "").trim();
    const cloudinaryApiKey = String(formData.get("cloudinary_api_key") ?? "").trim();
    const cloudinaryApiSecret = String(formData.get("cloudinary_api_secret") ?? "").trim();
    const operatorEmail = String(formData.get("platform_admin_email") ?? "").trim().toLowerCase();
    const extraEmails = String(formData.get("platform_admin_emails") ?? "").trim().toLowerCase();
    const adminPassword = String(formData.get("platform_admin_password") ?? "");
    const adminPasswordConfirm = String(formData.get("platform_admin_password_confirm") ?? "");
    const order = String(formData.get("ai_provider_order") ?? "gemini,groq,openai").trim();
    const failover = formData.get("ai_failover_enabled") === "on" ? "true" : "false";
    const geminiModel = String(formData.get("gemini_model") ?? "").trim();
    const groqModel = String(formData.get("groq_model") ?? "").trim();
    const openaiModel = String(formData.get("openai_model") ?? "").trim();

    if (gemini) await setSetting("gemini_api_key", gemini);
    if (groq) await setSetting("groq_api_key", groq);
    if (openai) await setSetting("openai_api_key", openai);
    if (googleClientId) await setSetting("google_client_id", googleClientId);
    if (googleClientSecret) await setSetting("google_client_secret", googleClientSecret);
    if (cloudinaryCloudName) await setSetting("cloudinary_cloud_name", cloudinaryCloudName);
    if (cloudinaryApiKey) await setSetting("cloudinary_api_key", cloudinaryApiKey);
    if (cloudinaryApiSecret) await setSetting("cloudinary_api_secret", cloudinaryApiSecret);
    if (operatorEmail) await setSetting("platform_admin_email", operatorEmail);
    await setSetting("platform_admin_emails", extraEmails);
    if (adminPassword || adminPasswordConfirm) {
      if (adminPassword.length < 8) {
        return { ok: false, error: "Admin password must be at least 8 characters." };
      }
      if (adminPassword !== adminPasswordConfirm) {
        return { ok: false, error: "Admin passwords do not match." };
      }
      await setSetting("platform_admin_password_hash", await hashPassword(adminPassword));
    }
    await setSetting("ai_provider_order", order);
    await setSetting("ai_failover_enabled", failover);
    if (geminiModel) await setSetting("gemini_model", geminiModel);
    if (groqModel) await setSetting("groq_model", groqModel);
    if (openaiModel) await setSetting("openai_model", openaiModel);
    await setSetting("plan_price_starter", String(formData.get("plan_price_starter") ?? "").trim());
    await setSetting("plan_price_business", String(formData.get("plan_price_business") ?? "").trim());
    await setSetting("plan_price_pro", String(formData.get("plan_price_pro") ?? "").trim());
    await setSetting("plan_price_currency", String(formData.get("plan_price_currency") ?? "USD").trim() || "USD");
    await setSetting("plan_trial_days", String(formData.get("plan_trial_days") ?? "7").trim() || "7");
    await setSetting("product_founder", String(formData.get("product_founder") ?? "").trim());
    const googleTts = String(formData.get("google_tts_api_key") ?? "").trim();
    const googleTtsVoice = String(formData.get("google_tts_voice") ?? "").trim();
    const awsKey = String(formData.get("aws_access_key_id") ?? "").trim();
    const awsSecret = String(formData.get("aws_secret_access_key") ?? "").trim();
    const awsRegion = String(formData.get("aws_region") ?? "").trim();
    const pollyVoice = String(formData.get("polly_voice") ?? "").trim();
    if (googleTts) await setSetting("google_tts_api_key", googleTts);
    if (googleTtsVoice) await setSetting("google_tts_voice", googleTtsVoice);
    if (awsKey) await setSetting("aws_access_key_id", awsKey);
    if (awsSecret) await setSetting("aws_secret_access_key", awsSecret);
    if (awsRegion) await setSetting("aws_region", awsRegion);
    if (pollyVoice) await setSetting("polly_voice", pollyVoice);
    const resendKey = String(formData.get("resend_api_key") ?? "").trim();
    const resendFrom = String(formData.get("resend_from_email") ?? "").trim();
    if (resendKey) await setSetting("resend_api_key", resendKey);
    if (resendFrom) await setSetting("resend_from_email", resendFrom);

    const reviewMode = formData.get("wix_review_mode") === "on" ? "true" : "false";
    const reviewerEmail = String(formData.get("wix_reviewer_email") ?? "").trim().toLowerCase();
    const reviewerEmails = String(formData.get("wix_reviewer_emails") ?? "").trim().toLowerCase();
    const reviewerPassword = String(formData.get("wix_reviewer_password") ?? "");
    if (reviewerEmail) await setSetting("wix_reviewer_email", reviewerEmail);
    await setSetting("wix_reviewer_emails", reviewerEmails);
    if (reviewerPassword) {
      if (reviewerPassword.length < 8) {
        return { ok: false, error: "Reviewer password must be at least 8 characters." };
      }
      await setSetting("wix_reviewer_password", reviewerPassword);
    }
    await setSetting("wix_review_mode", reviewMode);
    if (reviewMode === "true") {
      try {
        await ensureReviewerWorkspace();
      } catch (error) {
        const message = error instanceof Error ? error.message : "Could not create the reviewer workspace.";
        return { ok: false, error: message };
      }
    }

    const webflowEnabled = formData.get("webflow_enabled") === "on" ? "true" : "false";
    const webflowClientId = String(formData.get("webflow_client_id") ?? "").trim();
    const webflowClientSecret = String(formData.get("webflow_client_secret") ?? "").trim();
    const shopifyEnabled = formData.get("shopify_enabled") === "on" ? "true" : "false";
    const shopifyApiKey = String(formData.get("shopify_api_key") ?? "").trim();
    const shopifyApiSecret = String(formData.get("shopify_api_secret") ?? "").trim();
    const marketplace = await getMarketplaceAdapterConfig();
    if (webflowEnabled === "true" && !webflowClientId && !marketplace.webflow.clientId) {
      return { ok: false, error: "Paste a Webflow client ID before enabling the Webflow adapter." };
    }
    if (webflowEnabled === "true" && !webflowClientSecret && !marketplace.webflow.clientSecretSet) {
      return { ok: false, error: "Paste a Webflow client secret before enabling the Webflow adapter." };
    }
    if (shopifyEnabled === "true" && !shopifyApiKey && !marketplace.shopify.apiKey) {
      return { ok: false, error: "Paste a Shopify API key before enabling the Shopify adapter." };
    }
    if (shopifyEnabled === "true" && !shopifyApiSecret && !marketplace.shopify.apiSecretSet) {
      return { ok: false, error: "Paste a Shopify API secret before enabling the Shopify adapter." };
    }
    await setSetting("webflow_enabled", webflowEnabled);
    if (webflowClientId) await setSetting("webflow_client_id", webflowClientId);
    if (webflowClientSecret) await setSetting("webflow_client_secret", webflowClientSecret);
    await setSetting("shopify_enabled", shopifyEnabled);
    if (shopifyApiKey) await setSetting("shopify_api_key", shopifyApiKey);
    if (shopifyApiSecret) await setSetting("shopify_api_secret", shopifyApiSecret);

    revalidatePath("/admin/settings");
    revalidatePath("/admin/access");
    revalidatePath("/pricing");
    revalidatePath("/dashboard");
    revalidatePath("/billing");
    return { ok: true };
  } catch (error) {
    const message = error instanceof Error ? error.message : "Could not save settings.";
    return { ok: false, error: message };
  }
}

export async function openReviewerDashboard() {
  const admin = await requireAdminSession("SUPER");
  const user = await ensureReviewerWorkspace();
  await signInReviewer(user);
  await setImpersonationFlag(admin.email);
  redirect("/dashboard");
}

export async function testAIProviders() {
  await requireAdminSession("SUPER");
  try {
    const ai = await getAIProvider();
    const result = await ai.generate({
      system: "Reply with the single word pong.",
      prompt: "ping",
      maxTokens: 8,
    });
    return { ok: true as const, provider: result.provider, model: result.model, text: result.text.slice(0, 80) };
  } catch (error) {
    return { ok: false as const, error: error instanceof Error ? error.message : "Test failed" };
  }
}

export async function testPlatformTts(voiceId?: string, text?: string) {
  await requireAdminSession("SUPER");
  const { synthesizeSpeechDetailed } = await import("@/modules/voice/tts");
  const sample = (text || "Hi, I’m your tidyAgent voice. If you can hear this, Google Text-to-Speech is working.").slice(0, 400);
  const result = await synthesizeSpeechDetailed(sample, voiceId);
  if (!result.ok) {
    return { ok: false as const, error: result.error };
  }
  return {
    ok: true as const,
    provider: result.provider,
    voice: result.voice,
    contentType: result.contentType,
    audio: result.bytes.toString("base64"),
  };
}

export async function savePlanScopesAction(input: Record<PlanKey, PlanScopeConfig>) {
  try {
    await requireAdminSession("SUPER");
    await saveAllPlanScopes(input);
    revalidatePath("/admin/plans");
    revalidatePath("/admin/settings");
    revalidatePath("/pricing");
    revalidatePath("/billing");
    revalidatePath("/agent");
    revalidatePath("/automations");
    revalidatePath("/knowledge");
    revalidatePath("/onboarding");
    return { ok: true as const };
  } catch (error) {
    const message = error instanceof Error ? error.message : "Could not save plan scopes.";
    return { ok: false as const, error: message };
  }
}
