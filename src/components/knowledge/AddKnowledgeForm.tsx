"use client";

import { useState, useTransition } from "react";
import { addCustomKnowledge } from "@/app/actions/workspace";
import { OwnerNoteFields, composeOwnerNote, emptyNoteField, type NoteField } from "@/components/knowledge/OwnerNoteFields";

export function AddKnowledgeForm({
  lastSynced,
  notes = [],
}: {
  lastSynced: string | null;
  notes?: { id: string; title: string; content: string; priority: boolean; sensitive: boolean }[];
}) {
  const [title, setTitle] = useState("");
  const [fields, setFields] = useState<NoteField[]>([emptyNoteField()]);
  const [priority, setPriority] = useState(true);
  const [sensitive, setSensitive] = useState(false);
  const [pending, startTransition] = useTransition();

  return (
    <div className="panel p-6">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h2 className="font-display text-xl text-white">Owner notes (priority)</h2>
          <p className="text-sm text-navy-300">
            Add as many labeled facts as you need. The employee uses these first, before crawled pages.
          </p>
        </div>
        <p className="text-xs text-navy-400">Last synced: {lastSynced ? new Date(lastSynced).toLocaleString() : "Not yet"}</p>
      </div>
      {notes.length ? (
        <ul className="mt-5 space-y-2">
          {notes.map((note) => (
            <li key={note.id} className="rounded-2xl bg-navy-950/40 px-4 py-3">
              <div className="flex flex-wrap items-center gap-2">
                <p className="text-sm font-medium text-white">{note.title}</p>
                {note.priority ? <span className="rounded-full bg-amber-500/15 px-2 py-0.5 text-[10px] uppercase tracking-wide text-amber-200">Priority</span> : null}
                {note.sensitive ? <span className="rounded-full bg-rose-500/15 px-2 py-0.5 text-[10px] uppercase tracking-wide text-rose-200">Private</span> : null}
              </div>
              <p className="mt-1 whitespace-pre-wrap text-sm text-navy-300">{note.sensitive ? "Private instruction — used, not shown to visitors." : note.content}</p>
            </li>
          ))}
        </ul>
      ) : null}
      <form
        className="mt-6 grid gap-3"
        onSubmit={(event) => {
          event.preventDefault();
          const content = composeOwnerNote(fields);
          startTransition(async () => {
            await addCustomKnowledge(title, content, { priority, sensitive });
            setTitle("");
            setFields([emptyNoteField()]);
          });
        }}
      >
        <input className="field" placeholder="Title (e.g. Seasonal rates)" value={title} onChange={(event) => setTitle(event.target.value)} />
        <OwnerNoteFields fields={fields} onChange={setFields} />
        <label className="flex items-center gap-2 text-sm text-navy-200">
          <input type="checkbox" checked={priority} onChange={(event) => setPriority(event.target.checked)} />
          Use as priority over crawled pages
        </label>
        <label className="flex items-center gap-2 text-sm text-navy-200">
          <input type="checkbox" checked={sensitive} onChange={(event) => setSensitive(event.target.checked)} />
          Keep private — visitor never sees this text
        </label>
        <button className="btn-primary w-fit" disabled={pending || title.trim().length < 2 || composeOwnerNote(fields).length < 2}>
          {pending ? "Adding…" : "Add owner note"}
        </button>
      </form>
    </div>
  );
}
