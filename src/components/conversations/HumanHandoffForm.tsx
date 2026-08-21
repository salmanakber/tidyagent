"use client";

import { useState, useTransition } from "react";
import { saveHumanHandoff } from "@/app/actions/workspace";

export function HumanHandoffForm({
  name,
  role,
  email,
}: {
  name?: string | null;
  role?: string | null;
  email?: string | null;
}) {
  const [personName, setPersonName] = useState(name || "");
  const [personRole, setPersonRole] = useState(role || "Team");
  const [personEmail, setPersonEmail] = useState(email || "");
  const [saved, setSaved] = useState(false);
  const [pending, startTransition] = useTransition();

  return (
    <div className="panel p-6">
      <h2 className="font-display text-xl text-white">Human handoff</h2>
      <p className="mt-2 text-sm text-navy-300">
        This is a real person, not an AI specialist. When the employee cannot verify an answer, the chat connects here.
      </p>
      <form
        className="mt-5 grid gap-3 sm:grid-cols-3"
        onSubmit={(event) => {
          event.preventDefault();
          setSaved(false);
          startTransition(async () => {
            await saveHumanHandoff({ name: personName, role: personRole, email: personEmail });
            setSaved(true);
          });
        }}
      >
        <label className="text-sm text-navy-300">
          Name
          <input className="field mt-2" value={personName} onChange={(event) => setPersonName(event.target.value)} required />
        </label>
        <label className="text-sm text-navy-300">
          Role
          <input className="field mt-2" value={personRole} onChange={(event) => setPersonRole(event.target.value)} />
        </label>
        <label className="text-sm text-navy-300">
          Email (optional)
          <input className="field mt-2" value={personEmail} onChange={(event) => setPersonEmail(event.target.value)} />
        </label>
        <div className="flex items-end gap-3 sm:col-span-3">
          <button className="btn-primary" disabled={pending || personName.trim().length < 2}>
            {pending ? "Saving…" : "Save human contact"}
          </button>
          {saved ? <p className="text-sm text-emerald-300">Saved. Visitors will see this name on the handoff bubble.</p> : null}
        </div>
      </form>
    </div>
  );
}
