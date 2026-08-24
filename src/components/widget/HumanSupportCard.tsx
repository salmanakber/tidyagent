"use client";

import { useMemo, useState } from "react";
import { Check, ChevronRight, Loader2, Mail, MessageSquareText } from "lucide-react";
import { cn } from "@/lib/utils";

export function WhatsAppMark({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true" className={className} fill="currentColor">
      <path d="M12.04 2C6.5 2 2.01 6.48 2.01 12.02c0 1.77.46 3.45 1.28 4.91L2 22l5.2-1.26A9.96 9.96 0 0 0 12.04 22C17.57 22 22 17.52 22 11.98 22 6.48 17.57 2 12.04 2zm5.46 14.56c-.23.64-1.33 1.18-1.84 1.26-.47.07-1.06.1-1.71-.11-.4-.12-.9-.3-1.55-.58-2.73-1.18-4.5-3.94-4.64-4.12-.13-.18-1.1-1.46-1.1-2.79 0-1.32.69-1.97.94-2.24.24-.26.53-.33.7-.33h.51c.16 0 .38-.06.6.46.23.54.78 1.87.85 2 .07.13.11.28.02.46-.09.18-.13.28-.26.44-.13.15-.27.34-.39.46-.13.13-.26.26-.11.51.15.26.67 1.1 1.44 1.78 1 .88 1.83 1.16 2.09 1.29.26.13.41.11.56-.07.16-.18.66-.77.84-1.03.18-.26.35-.22.6-.13.24.09 1.54.73 1.8.86.27.13.44.2.51.31.07.13.07.73-.16 1.37z" />
    </svg>
  );
}

export function WhatsAppStrip({
  busy,
  onClick,
}: {
  busy?: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={busy}
      className="flex shrink-0 items-center gap-2.5 bg-gradient-to-r from-[#25D366] to-[#1EBE57] px-3 py-2 text-left text-white shadow-[inset_0_1px_0_rgba(255,255,255,.2)] transition hover:from-[#22c55e] hover:to-[#16a34a] disabled:opacity-70"
      aria-label="Chat on WhatsApp"
    >
      <span className="grid h-8 w-8 shrink-0 place-items-center rounded-full bg-white text-[#25D366] shadow-sm">
        <WhatsAppMark className="h-[18px] w-[18px]" />
      </span>
      <span className="min-w-0 flex-1">
        <span className="block text-[12px] font-semibold leading-4">Chat on WhatsApp</span>
        <span className="mt-0.5 block text-[10px] leading-3 text-white/90">Message the team directly</span>
      </span>
      <span className="shrink-0 rounded-full bg-white/20 px-2.5 py-1 text-[10px] font-semibold tracking-wide">
        {busy ? "Opening…" : "Open"}
      </span>
    </button>
  );
}

export function SupportChoiceCard({
  onChooseForm,
  onChooseWhatsApp,
  busy,
  error,
}: {
  brandStyle?: React.CSSProperties;
  onChooseForm: () => void;
  onChooseWhatsApp: () => void;
  busy?: boolean;
  error?: string | null;
}) {
  return (
    <div className="overflow-hidden rounded-3xl bg-white shadow-sm ring-1 ring-black/5">
      <div className="px-3.5 pb-3.5 pt-4">
        <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-slate-400">Human support</p>
        <h3 className="mt-1 text-[15px] font-semibold leading-5 text-slate-900">How would you like to get help from our team?</h3>
        <p className="mt-1.5 text-[12px] leading-5 text-slate-500">
          Choose how you’d like a teammate to pick this up. Your chat here stays saved.
        </p>
        <div className="mt-3 grid gap-2.5">
          <button
            type="button"
            disabled={busy}
            onClick={onChooseForm}
            className="flex items-center gap-3 rounded-2xl border border-slate-200 bg-slate-50 px-3 py-3 text-left transition hover:border-slate-300 hover:bg-white disabled:opacity-60"
          >
            <span className="grid h-10 w-10 shrink-0 place-items-center rounded-2xl bg-white text-slate-600 shadow-sm ring-1 ring-slate-200">
              <Mail className="h-4 w-4" />
            </span>
            <span className="min-w-0 flex-1">
              <span className="block text-[13px] font-semibold text-slate-900">Submit a support request</span>
              <span className="mt-0.5 block text-[11px] leading-4 text-slate-500">Leave your details. The team will follow up by email.</span>
            </span>
            <ChevronRight className="h-4 w-4 shrink-0 text-slate-300" />
          </button>
          <button
            type="button"
            disabled={busy}
            onClick={onChooseWhatsApp}
            className="flex items-center gap-3 rounded-2xl bg-gradient-to-r from-[#25D366] to-[#128C7E] px-3 py-3 text-left text-white shadow-[0_8px_20px_rgba(37,211,102,.28)] transition hover:brightness-105 disabled:opacity-60"
          >
            <span className="grid h-10 w-10 shrink-0 place-items-center rounded-2xl bg-white text-[#25D366] shadow-sm">
              {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <WhatsAppMark className="h-5 w-5" />}
            </span>
            <span className="min-w-0 flex-1">
              <span className="block text-[13px] font-semibold">Continue on WhatsApp</span>
              <span className="mt-0.5 block text-[11px] leading-4 text-white/85">
                Opens WhatsApp with a short summary. You review and send it.
              </span>
            </span>
            <ChevronRight className="h-4 w-4 shrink-0 text-white/80" />
          </button>
        </div>
        {error ? <p className="mt-2 text-[12px] text-rose-600">{error}</p> : null}
      </div>
    </div>
  );
}

export function LeadCaptureCard({
  conversationId,
  preview,
  brandStyle,
  onBack,
  onDismiss,
}: {
  conversationId: string | null;
  preview: boolean;
  brandStyle: React.CSSProperties;
  onBack?: () => void;
  onDismiss: () => void;
}) {
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [note, setNote] = useState("");
  const [sent, setSent] = useState(false);
  const [busy, setBusy] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [errors, setErrors] = useState<Record<string, string>>({});

  const fieldClass =
    "w-full rounded-2xl border border-slate-200 bg-slate-50 px-3 py-2.5 text-[13px] text-slate-800 outline-none transition placeholder:text-slate-400 focus:border-slate-400 focus:bg-white";

  const validation = useMemo(() => validateLead({ name, email, phone, note }), [name, email, phone, note]);

  if (sent) {
    return (
      <div className="overflow-hidden rounded-3xl bg-white px-4 py-5 text-center shadow-sm ring-1 ring-black/5">
        <span className="mx-auto grid h-12 w-12 place-items-center rounded-full text-white" style={brandStyle}>
          <Check className="h-6 w-6" strokeWidth={2.5} />
        </span>
        <h3 className="mt-3 text-[15px] font-semibold text-slate-900">Request received</h3>
        <p className="mt-1.5 text-[13px] leading-5 text-slate-600">
          Your support request was submitted. The team has your details and will follow up by email.
        </p>
        <p className="mt-2 text-[12px] leading-5 text-slate-500">You can keep chatting here if you have more to add.</p>
        <button
          type="button"
          className="mt-4 w-full rounded-full py-2.5 text-[13px] font-semibold text-white"
          style={brandStyle}
          onClick={onDismiss}
        >
          Continue chatting
        </button>
      </div>
    );
  }

  return (
    <form
      className="overflow-hidden rounded-3xl bg-white shadow-sm ring-1 ring-black/5"
      onSubmit={async (event) => {
        event.preventDefault();
        if (!conversationId || busy) return;
        const nextErrors = validation;
        setErrors(nextErrors);
        setFormError(null);
        if (Object.keys(nextErrors).length) return;
        setBusy(true);
        try {
          const response = await fetch("/api/widget/lead", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ conversationId, name, email, phone, note, preview }),
          });
          const data = (await response.json().catch(() => ({}))) as { error?: string };
          if (response.ok) {
            setSent(true);
            return;
          }
          setFormError(data.error || "Check the highlighted fields and try again.");
        } catch {
          setFormError("Could not send just then. Please try again.");
        } finally {
          setBusy(false);
        }
      }}
    >
      <div className="flex items-start gap-3 border-b border-slate-100 px-4 py-3.5">
        <span className="mt-0.5 grid h-8 w-8 shrink-0 place-items-center rounded-2xl text-white" style={brandStyle}>
          <MessageSquareText className="h-4 w-4" />
        </span>
        <div className="min-w-0">
          <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-slate-400">Support request</p>
          <h3 className="mt-0.5 text-[14px] font-semibold text-slate-900">Send a note to the team</h3>
          <p className="mt-0.5 text-[12px] leading-4 text-slate-500">We’ll follow up using the details you leave here.</p>
        </div>
      </div>
      <div className="grid gap-3 px-4 py-3.5">
        <Field
          label="Name"
          error={errors.name}
          className={fieldClass}
          value={name}
          onChange={setName}
          placeholder="Your name"
          disabled={busy}
        />
        <Field
          label="Email"
          error={errors.email}
          className={fieldClass}
          value={email}
          onChange={setEmail}
          placeholder="you@email.com"
          type="email"
          disabled={busy}
        />
        <Field
          label="Phone (optional)"
          error={errors.phone}
          className={fieldClass}
          value={phone}
          onChange={setPhone}
          placeholder="Mobile number"
          disabled={busy}
        />
        <label className="block text-left">
          <span className="mb-1.5 block text-[11px] font-semibold uppercase tracking-[0.12em] text-slate-500">
            How can we help?
          </span>
          <textarea
            className={cn(fieldClass, "min-h-[4.5rem] resize-none", errors.note ? "border-rose-300 bg-rose-50" : "")}
            placeholder="A short note about what you need"
            value={note}
            rows={3}
            maxLength={800}
            disabled={busy}
            onChange={(event) => setNote(event.target.value)}
          />
          {errors.note ? <span className="mt-1 block text-[11px] text-rose-600">{errors.note}</span> : null}
        </label>
        {formError ? <p className="text-[12px] text-rose-600">{formError}</p> : null}
        <button
          type="submit"
          className="w-full rounded-full py-2.5 text-[13px] font-semibold disabled:opacity-60"
          style={brandStyle}
          disabled={busy || !conversationId}
        >
          {busy ? (
            <span className="inline-flex items-center gap-2">
              <Loader2 className="h-4 w-4 animate-spin" /> Sending…
            </span>
          ) : (
            "Send to the team"
          )}
        </button>
        {onBack ? (
          <button type="button" className="text-[12px] font-medium text-slate-500" onClick={onBack} disabled={busy}>
            ← Back to options
          </button>
        ) : null}
      </div>
    </form>
  );
}

export function WhatsAppOpenedCard({ onDismiss }: { brandStyle?: React.CSSProperties; onDismiss: () => void }) {
  return (
    <div className="overflow-hidden rounded-3xl bg-white px-4 py-5 text-center shadow-sm ring-1 ring-black/5">
      <span className="mx-auto grid h-12 w-12 place-items-center rounded-full bg-gradient-to-br from-[#25D366] to-[#128C7E] text-white shadow-[0_8px_20px_rgba(37,211,102,.28)]">
        <WhatsAppMark className="h-6 w-6" />
      </span>
      <h3 className="mt-3 text-[15px] font-semibold text-slate-900">WhatsApp is ready</h3>
      <p className="mt-1.5 text-[13px] leading-5 text-slate-600">
        A short summary of this chat is pre-filled. Review it, then send it yourself. This website conversation stays here.
      </p>
      <button type="button" className="mt-4 w-full rounded-full bg-gradient-to-r from-[#25D366] to-[#1EBE57] py-2.5 text-[13px] font-semibold text-white" onClick={onDismiss}>
        Back to chat
      </button>
    </div>
  );
}

function Field({
  label,
  value,
  onChange,
  placeholder,
  type = "text",
  required,
  disabled,
  error,
  className,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  placeholder: string;
  type?: string;
  required?: boolean;
  disabled?: boolean;
  error?: string;
  className: string;
}) {
  return (
    <label className="block text-left">
      <span className="mb-1.5 block text-[11px] font-semibold uppercase tracking-[0.12em] text-slate-500">{label}</span>
      <input
        className={cn(className, error ? "border-rose-300 bg-rose-50" : "")}
        value={value}
        type={type}
        placeholder={placeholder}
        required={required}
        disabled={disabled}
        onChange={(event) => onChange(event.target.value)}
      />
      {error ? <span className="mt-1 block text-[11px] text-rose-600">{error}</span> : null}
    </label>
  );
}

function validateLead(input: { name: string; email: string; phone: string; note: string }) {
  const errors: Record<string, string> = {};
  if (input.name.trim().length < 2) errors.name = "Please enter your name.";
  if (input.name.trim().length > 80) errors.name = "Name is too long.";
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(input.email.trim()) || input.email.trim().length > 120) {
    errors.email = "Enter a valid email address.";
  }
  if (input.phone.trim().length > 40) errors.phone = "Phone number is too long.";
  if (input.note.trim().length > 800) errors.note = "Please keep this under 800 characters.";
  return errors;
}
