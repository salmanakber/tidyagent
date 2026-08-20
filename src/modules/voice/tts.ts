import { createHash, createHmac } from "node:crypto";
import { getEnv } from "@/lib/env";
import { getSetting } from "@/lib/security/settings";
import { languageCodeFromVoice, resolveVoice } from "@/modules/voice/voices";

export type SpokenAudio = {
  bytes: Buffer;
  contentType: "audio/mpeg";
  provider: "google" | "polly";
};

export type TtsAttempt =
  | { ok: true; bytes: Buffer; contentType: "audio/mpeg"; provider: "google" | "polly"; voice: string }
  | { ok: false; error: string };

export async function synthesizeSpeech(text: string, voiceId?: string | null): Promise<SpokenAudio | null> {
  const result = await synthesizeSpeechDetailed(text, voiceId);
  if (!result.ok) return null;
  return { bytes: result.bytes, contentType: result.contentType, provider: result.provider };
}

export async function synthesizeSpeechDetailed(text: string, voiceId?: string | null): Promise<TtsAttempt> {
  const spoken = text.replace(/\s+/g, " ").trim().slice(0, 800);
  if (!spoken) return { ok: false, error: "Nothing to speak." };

  const google = await speakWithGoogle(spoken, voiceId);
  if (google.ok) return google;

  const polly = await speakWithPolly(spoken, voiceId);
  if (polly.ok) return polly;

  return { ok: false, error: google.error || polly.error || "No TTS provider is configured." };
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

function googleFallbacks(preferred: string) {
  const letter = preferred.split("-").pop() || "F";
  const lang = languageCodeFromVoice(preferred);
  return Array.from(new Set([preferred, `${lang}-Wavenet-${letter}`, `${lang}-Standard-${letter}`]));
}

async function speakWithGoogle(text: string, voiceId?: string | null): Promise<TtsAttempt> {
  const { googleKey, googleVoice } = await ttsKeys();
  if (!googleKey) return { ok: false, error: "Google TTS API key is not set." };

  const preferred = voiceId || googleVoice;
  let lastError = "Google TTS did not return audio.";
  for (const name of googleFallbacks(preferred)) {
    try {
      const response = await fetch(`https://texttospeech.googleapis.com/v1/text:synthesize?key=${encodeURIComponent(googleKey)}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          input: { text },
          voice: { languageCode: languageCodeFromVoice(name), name },
          audioConfig: { audioEncoding: "MP3", speakingRate: 1.02 },
        }),
        signal: AbortSignal.timeout(15000),
      });
      const data = (await response.json()) as { audioContent?: string; error?: { message?: string } };
      if (!response.ok || !data.audioContent) {
        lastError = data.error?.message || `Google TTS HTTP ${response.status}`;
        continue;
      }
      return {
        ok: true,
        bytes: Buffer.from(data.audioContent, "base64"),
        contentType: "audio/mpeg",
        provider: "google",
        voice: name,
      };
    } catch (error) {
      lastError = error instanceof Error ? error.message : "Google TTS request failed.";
    }
  }
  return { ok: false, error: lastError };
}

async function speakWithPolly(text: string, voiceId?: string | null): Promise<TtsAttempt> {
  const { awsKey, awsSecret, awsRegion, pollyVoice } = await ttsKeys();
  if (!awsKey || !awsSecret) return { ok: false, error: "Amazon Polly keys are not set." };
  const voice = resolveVoice(voiceId).polly || pollyVoice;
  for (const engine of ["neural", "standard"] as const) {
    try {
      const body = JSON.stringify({
        Text: text,
        OutputFormat: "mp3",
        VoiceId: voice,
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
      if (!response.ok) {
        const detail = await response.text();
        if (engine === "standard") {
          return { ok: false, error: `Amazon Polly HTTP ${response.status}${detail ? `: ${detail.slice(0, 180)}` : ""}` };
        }
        continue;
      }
      const bytes = Buffer.from(await response.arrayBuffer());
      if (!bytes.length) continue;
      return { ok: true, bytes, contentType: "audio/mpeg", provider: "polly", voice };
    } catch (error) {
      if (engine === "standard") {
        return { ok: false, error: error instanceof Error ? error.message : "Amazon Polly request failed." };
      }
    }
  }
  return { ok: false, error: "Amazon Polly did not return audio." };
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
