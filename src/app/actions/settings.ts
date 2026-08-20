"use server";

import { revalidatePath } from "next/cache";
import { requireAdminSession } from "@/lib/security/admin-session";
import { getAIRuntimeConfig, getCloudinaryConfig, getSetting, setSetting, settingExists } from "@/lib/security/settings";
import { getAIProvider } from "@/modules/ai/factory";
import { hashPassword } from "@/lib/security/passwords";
import { getEnv } from "@/lib/env";
import { GEMINI_MODELS, GROQ_MODELS, OPENAI_MODELS } from "@/modules/ai/models";

export async function getPlatformSettingsView() {
  await requireAdminSession("SUPER");
  const config = await getAIRuntimeConfig();
  const cloudinary = await getCloudinaryConfig();
  const [geminiSet, groqSet, openaiSet, googleIdSet, googleSecretSet, cloudNameSet, cloudKeySet, cloudSecretSet, googleTtsSet, awsKeySet, awsSecretSet] = await Promise.all([
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
  const googleTtsVoice = await getSetting("google_tts_voice", env.GOOGLE_TTS_VOICE);

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
    googleTtsVoice: googleTtsVoice || "en-US-Neural2-F",
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

    revalidatePath("/admin/settings");
    revalidatePath("/admin/access");
    revalidatePath("/pricing");
    return { ok: true };
  } catch (error) {
    const message = error instanceof Error ? error.message : "Could not save settings.";
    return { ok: false, error: message };
  }
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
