import { createHash, createHmac } from "node:crypto";
import { getEnv } from "@/lib/env";
import { getSetting } from "@/lib/security/settings";

export type SpokenAudio = {
  bytes: Buffer;
  contentType: "audio/mpeg";
  provider: "google" | "polly";
};

export async function synthesizeSpeech(text: string): Promise<SpokenAudio | null> {
  const spoken = text.replace(/\s+/g, " ").trim().slice(0, 800);
  if (!spoken) return null;

  const google = await speakWithGoogle(spoken);
  if (google) return google;

  return speakWithPolly(spoken);
}

async function ttsKeys() {
  const env = getEnv();
  const [googleKey, googleVoice, awsKey, awsSecret, awsRegion, pollyVoice] = await Promise.all([
    getSetting("google_tts_api_key", env.GOOGLE_TTS_API_KEY),
    getSetting("google_tts_voice", env.GOOGLE_TTS_VOICE),
    getSetting("aws_access_key_id", env.AWS_ACCESS_KEY_ID),
    getSetting("aws_secret_access_key", env.AWS_SECRET_ACCESS_KEY),
    getSetting("aws_region", env.AWS_REGION),
    getSetting("polly_voice", env.POLLY_VOICE),
  ]);
  return {
    googleKey,
    googleVoice: googleVoice || "en-US-Neural2-F",
    awsKey,
    awsSecret,
    awsRegion: awsRegion || "us-east-1",
    pollyVoice: pollyVoice || "Joanna",
  };
}

async function speakWithGoogle(text: string): Promise<SpokenAudio | null> {
  const { googleKey, googleVoice } = await ttsKeys();
  if (!googleKey) return null;
  try {
    const response = await fetch(`https://texttospeech.googleapis.com/v1/text:synthesize?key=${encodeURIComponent(googleKey)}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        input: { text },
        voice: { languageCode: "en-US", name: googleVoice },
        audioConfig: { audioEncoding: "MP3", speakingRate: 1.02 },
      }),
      signal: AbortSignal.timeout(15000),
    });
    if (!response.ok) return null;
    const data = (await response.json()) as { audioContent?: string };
    if (!data.audioContent) return null;
    return { bytes: Buffer.from(data.audioContent, "base64"), contentType: "audio/mpeg", provider: "google" };
  } catch {
    return null;
  }
}

async function speakWithPolly(text: string): Promise<SpokenAudio | null> {
  const { awsKey, awsSecret, awsRegion, pollyVoice } = await ttsKeys();
  if (!awsKey || !awsSecret) return null;
  for (const engine of ["neural", "standard"] as const) {
    try {
      const body = JSON.stringify({
        Text: text,
        OutputFormat: "mp3",
        VoiceId: pollyVoice,
        Engine: engine,
        TextType: "text",
      });
      const response = await awsSignedFetch({
        method: "POST",
        service: "polly",
        region: awsRegion,
        host: `polly.${awsRegion}.amazonaws.com`,
        path: "/v1/speech",
        body,
        accessKeyId: awsKey,
        secretAccessKey: awsSecret,
      });
      if (!response.ok) continue;
      const bytes = Buffer.from(await response.arrayBuffer());
      if (!bytes.length) continue;
      return { bytes, contentType: "audio/mpeg", provider: "polly" };
    } catch {
      /* try next engine */
    }
  }
  return null;
}

function hmac(key: Buffer | string, data: string) {
  return createHmac("sha256", key).update(data, "utf8").digest();
}

function sha256Hex(data: string) {
  return createHash("sha256").update(data, "utf8").digest("hex");
}

async function awsSignedFetch(input: {
  method: string;
  service: string;
  region: string;
  host: string;
  path: string;
  body: string;
  accessKeyId: string;
  secretAccessKey: string;
}) {
  const amzDate = new Date().toISOString().replace(/[:-]|\.\d{3}/g, "");
  const dateStamp = amzDate.slice(0, 8);
  const contentType = "application/json";
  const payloadHash = sha256Hex(input.body);
  const canonicalHeaders = `content-type:${contentType}\nhost:${input.host}\nx-amz-date:${amzDate}\n`;
  const signedHeaders = "content-type;host;x-amz-date";
  const canonicalRequest = [input.method, input.path, "", canonicalHeaders, signedHeaders, payloadHash].join("\n");
  const credentialScope = `${dateStamp}/${input.region}/${input.service}/aws4_request`;
  const stringToSign = ["AWS4-HMAC-SHA256", amzDate, credentialScope, sha256Hex(canonicalRequest)].join("\n");
  const kDate = hmac(`AWS4${input.secretAccessKey}`, dateStamp);
  const kRegion = hmac(kDate, input.region);
  const kService = hmac(kRegion, input.service);
  const kSigning = hmac(kService, "aws4_request");
  const signature = createHmac("sha256", kSigning).update(stringToSign, "utf8").digest("hex");
  const authorization = `AWS4-HMAC-SHA256 Credential=${input.accessKeyId}/${credentialScope}, SignedHeaders=${signedHeaders}, Signature=${signature}`;

  return fetch(`https://${input.host}${input.path}`, {
    method: input.method,
    headers: {
      "Content-Type": contentType,
      "X-Amz-Date": amzDate,
      Authorization: authorization,
    },
    body: input.body,
    signal: AbortSignal.timeout(15000),
  });
}
