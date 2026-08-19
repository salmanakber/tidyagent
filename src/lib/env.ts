import { z } from "zod";

const envSchema = z.object({
  NODE_ENV: z.enum(["development", "test", "production"]).default("development"),
  APP_URL: z.string().default("http://localhost:3000"),
  SESSION_SECRET: z.string().min(16),
  WIDGET_TOKEN_SECRET: z.string().min(16),
  DATABASE_URL: z.string().optional(),
  WIX_APP_ID: z.string().optional().default(""),
  WIX_APP_SECRET: z.string().optional().default(""),
  WIX_APP_PUBLIC_KEY: z.string().optional().default(""),
  WIX_VENDOR_PRODUCT_STARTER: z.string().optional().default(""),
  WIX_VENDOR_PRODUCT_GROWTH: z.string().optional().default(""),
  WIX_VENDOR_PRODUCT_PRO: z.string().optional().default(""),
  TIDYAGENT_DEV_MODE: z.string().optional().default("false"),
  PLATFORM_ADMIN_EMAIL: z.string().optional().default("owner@tidyagent.local"),
  PLATFORM_ADMIN_PASSWORD: z.string().optional().default(""),
  PLATFORM_ADMIN_EMAILS: z.string().optional().default(""),
  GEMINI_API_KEY: z.string().optional().default(""),
  GROQ_API_KEY: z.string().optional().default(""),
  OPENAI_API_KEY: z.string().optional().default(""),
  AI_PROVIDER: z.string().optional().default("gemini"),
  GOOGLE_CLIENT_ID: z.string().optional().default(""),
  GOOGLE_CLIENT_SECRET: z.string().optional().default(""),
  CLOUDINARY_CLOUD_NAME: z.string().optional().default(""),
  CLOUDINARY_API_KEY: z.string().optional().default(""),
  CLOUDINARY_API_SECRET: z.string().optional().default(""),
  REDIS_URL: z.string().optional().default(""),
});

export type AppEnv = z.infer<typeof envSchema>;

export function getEnv(): AppEnv {
  const parsed = envSchema.safeParse(process.env);
  if (!parsed.success) {
    throw new Error(`Invalid environment: ${parsed.error.message}`);
  }
  return parsed.data;
}

export function getAppOrigin() {
  return getEnv().APP_URL.replace(/\/$/, "");
}

export function isDevMode() {
  return getEnv().TIDYAGENT_DEV_MODE === "true";
}
