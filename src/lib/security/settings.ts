import { createCipheriv, createDecipheriv, createHash, randomBytes } from "node:crypto";
import { prisma } from "@/lib/prisma";
import { getEnv } from "@/lib/env";
import { DEFAULT_MODELS, type AIProviderId } from "@/modules/ai/models";

export type { AIProviderId };

const SECRET_KEYS = new Set([
  "gemini_api_key",
  "groq_api_key",
  "openai_api_key",
  "google_client_secret",
  "cloudinary_api_key",
  "cloudinary_api_secret",
  "google_tts_api_key",
  "aws_access_key_id",
  "aws_secret_access_key",
  "wix_reviewer_password",
]);

function keyMaterial() {
  return createHash("sha256").update(getEnv().SESSION_SECRET).digest();
}

export function encryptSecret(plain: string) {
  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", keyMaterial(), iv);
  const encrypted = Buffer.concat([cipher.update(plain, "utf8"), cipher.final()]);
  const tag = cipher.getAuthTag();
  return `enc:${iv.toString("hex")}:${tag.toString("hex")}:${encrypted.toString("hex")}`;
}

export function decryptSecret(value: string) {
  if (!value.startsWith("enc:")) return value;
  const [, ivHex, tagHex, dataHex] = value.split(":");
  if (!ivHex || !tagHex || !dataHex) return "";
  try {
    const decipher = createDecipheriv("aes-256-gcm", keyMaterial(), Buffer.from(ivHex, "hex"));
    decipher.setAuthTag(Buffer.from(tagHex, "hex"));
    return Buffer.concat([decipher.update(Buffer.from(dataHex, "hex")), decipher.final()]).toString("utf8");
  } catch {
    /* SESSION_SECRET changed, or the stored blob is corrupt */
    return "";
  }
}

export async function getSetting(key: string, fallback = "") {
  const row = await prisma.platformSetting.findUnique({ where: { key } });
  if (!row?.value) return fallback;
  if (!row.secret) return row.value;
  const plain = decryptSecret(row.value);
  if (plain) return plain;
  if (row.value.startsWith("enc:")) {
    console.error(`Could not decrypt platform setting "${key}". SESSION_SECRET may have changed. Re-save the key in Admin → Settings.`);
  }
  return fallback;
}

export async function setSetting(key: string, value: string) {
  const secret = SECRET_KEYS.has(key);
  const stored = secret && value ? encryptSecret(value) : value;
  try {
    await prisma.platformSetting.upsert({
      where: { key },
      update: { value: stored, secret },
      create: { key, value: stored, secret },
    });
  } catch (error) {
    const code = typeof error === "object" && error && "code" in error ? String((error as { code: string }).code) : "";
    if (code === "P2021" || (error instanceof Error && /does not exist/i.test(error.message))) {
      throw new Error("Settings table is missing. Run `npx prisma db push` and try again.");
    }
    throw error;
  }
}

export async function settingExists(key: string) {
  const row = await prisma.platformSetting.findUnique({ where: { key } });
  return Boolean(row?.value);
}

export async function getAIRuntimeConfig() {
  const env = getEnv();
  const [gemini, groq, openai, failover, order, geminiModel, groqModel, openaiModel] = await Promise.all([
    getSetting("gemini_api_key", env.GEMINI_API_KEY),
    getSetting("groq_api_key", env.GROQ_API_KEY),
    getSetting("openai_api_key", env.OPENAI_API_KEY ?? ""),
    getSetting("ai_failover_enabled", "true"),
    getSetting("ai_provider_order", env.AI_PROVIDER || "gemini,groq,openai"),
    getSetting("gemini_model", DEFAULT_MODELS.gemini),
    getSetting("groq_model", DEFAULT_MODELS.groq),
    getSetting("openai_model", DEFAULT_MODELS.openai),
  ]);

  const parsedOrder = order
    .split(",")
    .map((item) => item.trim().toLowerCase())
    .filter((item): item is AIProviderId => item === "gemini" || item === "groq" || item === "openai");

  return {
    keys: { gemini, groq, openai },
    models: {
      gemini: geminiModel || DEFAULT_MODELS.gemini,
      groq: groqModel || DEFAULT_MODELS.groq,
      openai: openaiModel || DEFAULT_MODELS.openai,
    },
    failoverEnabled: failover !== "false",
    order: parsedOrder.length ? parsedOrder : (["gemini", "groq", "openai"] as AIProviderId[]),
  };
}

export async function getGoogleOAuthConfig() {
  const env = getEnv();
  const clientId = await getSetting("google_client_id", env.GOOGLE_CLIENT_ID ?? "");
  const clientSecret = await getSetting("google_client_secret", env.GOOGLE_CLIENT_SECRET ?? "");
  const redirectUri = `${env.APP_URL.replace(/\/$/, "")}/api/auth/google/callback`;
  return { clientId, clientSecret, redirectUri };
}

export async function getCloudinaryConfig() {
  const env = getEnv();
  const [cloudName, apiKey, apiSecret] = await Promise.all([
    getSetting("cloudinary_cloud_name", env.CLOUDINARY_CLOUD_NAME ?? ""),
    getSetting("cloudinary_api_key", env.CLOUDINARY_API_KEY ?? ""),
    getSetting("cloudinary_api_secret", env.CLOUDINARY_API_SECRET ?? ""),
  ]);
  return { cloudName, apiKey, apiSecret };
}
