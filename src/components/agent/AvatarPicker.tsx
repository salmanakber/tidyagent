"use client";

import { useRef, useState } from "react";
import { Camera, Trash2 } from "lucide-react";
import { initials } from "@/lib/utils";

export function AvatarPicker({
  name,
  url,
  onChange,
  compact = false,
}: {
  name: string;
  url?: string | null;
  onChange: (url: string | null) => Promise<void> | void;
  compact?: boolean;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function onFile(file: File) {
    setError(null);
    setBusy(true);
    try {
      const body = new FormData();
      body.append("file", file);
      const response = await fetch("/api/uploads/avatar", { method: "POST", body });
      const data = (await response.json()) as { url?: string; error?: string };
      if (!response.ok || !data.url) {
        throw new Error(data.error || "Upload failed");
      }
      await onChange(data.url);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Upload failed");
    } finally {
      setBusy(false);
      if (inputRef.current) inputRef.current.value = "";
    }
  }

  return (
    <div>
      {compact ? null : (
        <>
          <p className="text-sm text-navy-300">Profile photo</p>
          <p className="mt-1 text-xs text-navy-400">Used for the agent in your dashboard and the live chat widget.</p>
        </>
      )}
      <div className={compact ? "flex items-center gap-3" : "mt-3 flex items-center gap-4"}>
        <button
          type="button"
          onClick={() => inputRef.current?.click()}
          disabled={busy}
          className={`relative overflow-hidden rounded-full ring-1 ring-white/10 transition hover:ring-amber-400/40 disabled:opacity-60 ${compact ? "h-12 w-12" : "h-20 w-20"}`}
          title={busy ? "Uploading…" : url ? "Change photo" : "Add photo"}
        >
          {url ? (
            <img src={url} alt="" className="h-full w-full object-cover" />
          ) : (
            <span className={`flex h-full w-full items-center justify-center bg-amber-500/15 font-display text-amber-200 ${compact ? "text-sm" : "text-lg"}`}>
              {initials(name) || "AI"}
            </span>
          )}
          {compact ? null : (
            <span className="absolute inset-x-0 bottom-0 flex items-center justify-center bg-navy-950/70 py-1">
              <Camera className="h-3.5 w-3.5 text-white" />
            </span>
          )}
        </button>
        {compact ? null : (
        <div className="flex flex-col gap-2">
          <button type="button" className="btn-secondary py-2 text-xs" onClick={() => inputRef.current?.click()} disabled={busy}>
            {busy ? "Uploading…" : url ? "Change photo" : "Upload photo"}
          </button>
          {url ? (
            <button
              type="button"
              className="inline-flex items-center gap-1.5 text-xs text-navy-400 transition hover:text-rose-200"
              disabled={busy}
              onClick={() => void onChange(null)}
            >
              <Trash2 className="h-3 w-3" />
              Remove
            </button>
          ) : null}
        </div>
        )}
        <input
          ref={inputRef}
          type="file"
          accept="image/jpeg,image/png,image/webp,image/gif"
          className="hidden"
          onChange={(event) => {
            const file = event.target.files?.[0];
            if (file) void onFile(file);
          }}
        />
      </div>
      {error ? <p className="mt-2 text-xs text-rose-300">{error}</p> : null}
    </div>
  );
}
