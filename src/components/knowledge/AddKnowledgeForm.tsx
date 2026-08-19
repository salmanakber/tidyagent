"use client";

import { useState, useTransition } from "react";
import { addCustomKnowledge } from "@/app/actions/workspace";

export function AddKnowledgeForm({ lastSynced }: { lastSynced: string | null }) {
  const [title, setTitle] = useState("");
  const [content, setContent] = useState("");
  const [pending, startTransition] = useTransition();

  return (
    <div className="panel p-6">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h2 className="font-display text-xl text-white">Custom knowledge</h2>
          <p className="text-sm text-navy-300">Add facts the website doesn’t cover. Owner-verified information sits at the top of the authority stack.</p>
        </div>
        <p className="text-xs text-navy-400">Last synced: {lastSynced ? new Date(lastSynced).toLocaleString() : "Not yet"}</p>
      </div>
      <form
        className="mt-6 grid gap-3"
        onSubmit={(event) => {
          event.preventDefault();
          startTransition(async () => {
            await addCustomKnowledge(title, content);
            setTitle("");
            setContent("");
          });
        }}
      >
        <input className="field" placeholder="Title" value={title} onChange={(event) => setTitle(event.target.value)} />
        <textarea className="field min-h-32" placeholder="Verified business information" value={content} onChange={(event) => setContent(event.target.value)} />
        <button className="btn-primary w-fit" disabled={pending}>
          {pending ? "Adding…" : "Add knowledge"}
        </button>
      </form>
    </div>
  );
}
