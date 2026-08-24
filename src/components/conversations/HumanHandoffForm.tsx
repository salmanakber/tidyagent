"use client";

import { useState, useTransition } from "react";
import { saveHumanHandoff } from "@/app/actions/workspace";
import { AvatarPicker } from "@/components/agent/AvatarPicker";
import { WhatsAppNumberField } from "@/components/support/WhatsAppNumberField";

export function HumanHandoffForm({
  name,
  role,
  email,
  avatarUrl,
  whatsapp,
}: {
  name?: string | null;
  role?: string | null;
  email?: string | null;
  avatarUrl?: string | null;
  whatsapp?: string | null;
}) {
  const [personName, setPersonName] = useState(name || "");
  const [personRole, setPersonRole] = useState(role || "Team");
  const [personEmail, setPersonEmail] = useState(email || "");
  const [photo, setPhoto] = useState(avatarUrl || "");
  const [personWhatsapp, setPersonWhatsapp] = useState(whatsapp || "");
  const [whatsappCountry, setWhatsappCountry] = useState("");
  const [whatsappError, setWhatsappError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  return (
    <div className="panel overflow-hidden">
      <div className="border-b border-white/5 px-6 py-5">
        <h2 className="font-display text-xl text-white">Human handoff</h2>
        <p className="mt-2 max-w-2xl text-sm text-navy-300">
          This is a real person visitors wait for — photo, name, and role appear in the chat. Add WhatsApp so visitors can
          continue there if they prefer. If nobody takes over in about a minute, they can still leave a support request.
        </p>
      </div>
      <form
        className="grid gap-6 p-6 lg:grid-cols-[auto_1fr]"
        onSubmit={(event) => {
          event.preventDefault();
          setSaved(false);
          setError(null);
          if (whatsappError) {
            setError(whatsappError);
            return;
          }
          startTransition(async () => {
            const result = await saveHumanHandoff({
              name: personName,
              role: personRole,
              email: personEmail,
              avatarUrl: photo || undefined,
              whatsapp: personWhatsapp || null,
              whatsappCountry: whatsappCountry || null,
            });
            if (!result.ok) {
              setError(result.error);
              return;
            }
            setSaved(true);
          });
        }}
      >
        <AvatarPicker name={personName || "Team"} url={photo || null} onChange={(url) => setPhoto(url || "")} />
        <div className="grid gap-4 sm:grid-cols-2">
          <label className="text-sm text-navy-300 sm:col-span-2">
            Name
            <input className="field mt-2" value={personName} onChange={(event) => setPersonName(event.target.value)} required placeholder="e.g. Justin" />
          </label>
          <label className="text-sm text-navy-300">
            Role
            <input className="field mt-2" value={personRole} onChange={(event) => setPersonRole(event.target.value)} placeholder="e.g. Rentals" />
          </label>
          <label className="text-sm text-navy-300">
            Notify email
            <input className="field mt-2" value={personEmail} onChange={(event) => setPersonEmail(event.target.value)} placeholder="you@business.com" />
          </label>
          <WhatsAppNumberField
            value={whatsapp}
            disabled={pending}
            error={error && /whatsapp|number|country/i.test(error) ? error : null}
            onChange={(e164, meta) => {
              setPersonWhatsapp(e164 || "");
              setWhatsappCountry(meta.country);
              setWhatsappError(meta.error);
            }}
          />
          <div className="flex flex-wrap items-center gap-3 sm:col-span-2">
            <button className="btn-primary" disabled={pending || personName.trim().length < 2 || Boolean(whatsappError)}>
              {pending ? "Saving…" : "Save human contact"}
            </button>
            {saved ? <p className="text-sm text-emerald-300">Saved. Visitors will see this person on handoff.</p> : null}
            {error ? <p className="text-sm text-rose-300">{error}</p> : null}
          </div>
        </div>
      </form>
    </div>
  );
}
