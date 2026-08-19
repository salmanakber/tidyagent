import { createHash } from "node:crypto";
import { getCloudinaryConfig } from "@/lib/security/settings";

function sign(params: Record<string, string>, apiSecret: string) {
  const toSign = Object.keys(params)
    .filter((key) => params[key])
    .sort()
    .map((key) => `${key}=${params[key]}`)
    .join("&");
  return createHash("sha1")
    .update(toSign + apiSecret)
    .digest("hex");
}

export async function cloudinaryConfigured() {
  const config = await getCloudinaryConfig();
  return Boolean(config.cloudName && config.apiKey && config.apiSecret);
}

export async function uploadAvatarToCloudinary(file: {
  buffer: Buffer;
  mime: string;
  folderSuffix: string;
}) {
  const { cloudName, apiKey, apiSecret } = await getCloudinaryConfig();
  if (!cloudName || !apiKey || !apiSecret) {
    throw new Error("Cloudinary is not configured. Add cloud name, API key, and API secret in Platform admin → Settings.");
  }

  const timestamp = Math.floor(Date.now() / 1000).toString();
  const folder = `tidyagent/avatars/${file.folderSuffix}`;
  const transformation = "c_fill,g_face,w_400,h_400";
  const params = { folder, timestamp, transformation };
  const signature = sign(params, apiSecret);

  const body = new FormData();
  body.append("file", `data:${file.mime};base64,${file.buffer.toString("base64")}`);
  body.append("api_key", apiKey);
  body.append("timestamp", timestamp);
  body.append("signature", signature);
  body.append("folder", folder);
  body.append("transformation", transformation);

  const response = await fetch(`https://api.cloudinary.com/v1_1/${cloudName}/image/upload`, {
    method: "POST",
    body,
  });

  const data = (await response.json()) as { secure_url?: string; error?: { message?: string } };
  if (!response.ok || !data.secure_url) {
    throw new Error(data.error?.message || "Cloudinary upload failed");
  }
  return data.secure_url;
}
