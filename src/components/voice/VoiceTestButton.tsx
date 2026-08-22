"use client";

import { useState } from "react";
import { Volume2 } from "lucide-react";
import { voicesByRegion } from "@/modules/voice/voices";

export function VoiceTestButton({
  voiceId,
  preview,
  compact,
  sample = "Hi, I’m your tidyAgent voice. If you can hear this, Google Text-to-Speech is working.",
}: {
  voiceId: string;
  preview?: boolean;
  compact?: boolean;
  sample?: string;
}) {
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  async function play() {
    setBusy(true);
    setMessage(null);
    try {
      if (preview) {
        const response = await fetch("/api/widget/tts", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ text: sample, preview: true, voiceId }),
        });
        if (!response.ok) {
          const data = (await response.json().catch(() => null)) as { error?: string } | null;
          throw new Error(data?.error || `Voice test failed (${response.status})`);
        }
        const blob = await response.blob();
        const url = URL.createObjectURL(blob);
        const audio = new Audio(url);
        await audio.play();
        audio.onended = () => URL.revokeObjectURL(url);
        setMessage(`Playing · ${response.headers.get("X-Tidyagent-Tts") || "google"}`);
        return;
      }

      const { testPlatformTts } = await import("@/app/actions/settings");
      const result = await testPlatformTts(voiceId, sample);
      if (!result.ok || !result.audio) {
        throw new Error(result.error || "Voice test failed");
      }
      const audio = new Audio(`data:${result.contentType};base64,${result.audio}`);
      await audio.play();
      setMessage(`Working · ${result.provider} · ${result.voice}`);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Could not play voice");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className={compact ? "shrink-0" : undefined}>
      <button
        type="button"
        className={compact ? "grid h-10 w-10 place-items-center rounded-full border border-white/10 bg-white/5" : "btn-secondary"}
        onClick={() => void play()}
        disabled={busy}
        title={busy ? "Playing…" : "Play this voice"}
        aria-label={busy ? "Playing…" : "Play this voice"}
      >
        <Volume2 className="h-4 w-4" />
        {compact ? null : busy ? "Playing…" : "Play test voice"}
      </button>
      {message && !compact ? <p className="mt-2 text-xs text-navy-300">{message}</p> : null}
    </div>
  );
}

export function VoiceSelect({
  value,
  onChange,
  compact,
}: {
  value: string;
  onChange: (id: string) => void;
  compact?: boolean;
}) {
  return (
    <select
      className={compact ? "field mt-0 py-2 text-xs" : "field mt-2"}
      value={value}
      onChange={(event) => onChange(event.target.value)}
    >
      {voicesByRegion().map((group) => (
        <optgroup key={group.region} label={group.region}>
          {group.voices.map((voice) => (
            <option key={voice.id} value={voice.id}>
              {voice.label} — {voice.note}
            </option>
          ))}
        </optgroup>
      ))}
    </select>
  );
}
