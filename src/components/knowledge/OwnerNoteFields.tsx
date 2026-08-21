"use client";

import { Plus, Trash2 } from "lucide-react";

export type NoteField = { id: string; label: string; value: string };

export function emptyNoteField(): NoteField {
  return { id: globalThis.crypto?.randomUUID?.() || `f-${Math.random().toString(36).slice(2)}`, label: "", value: "" };
}

export function composeOwnerNote(fields: NoteField[]) {
  return fields
    .map((field) => {
      const label = field.label.trim();
      const value = field.value.trim();
      if (!label && !value) return "";
      return label && value ? `${label}: ${value}` : label || value;
    })
    .filter(Boolean)
    .join("\n\n");
}

export function OwnerNoteFields({
  fields,
  onChange,
}: {
  fields: NoteField[];
  onChange: (fields: NoteField[]) => void;
}) {
  function update(id: string, patch: Partial<NoteField>) {
    onChange(fields.map((field) => (field.id === id ? { ...field, ...patch } : field)));
  }

  return (
    <div className="space-y-3">
      {fields.map((field, index) => (
        <div key={field.id} className="rounded-2xl border border-white/10 bg-navy-950/30 p-3">
          <div className="mb-2 flex items-center justify-between">
            <p className="text-[11px] uppercase tracking-[0.14em] text-navy-400">Field {index + 1}</p>
            {fields.length > 1 ? (
              <button
                type="button"
                className="text-navy-400 transition hover:text-rose-200"
                onClick={() => onChange(fields.filter((item) => item.id !== field.id))}
                aria-label="Remove field"
              >
                <Trash2 className="h-3.5 w-3.5" />
              </button>
            ) : null}
          </div>
          <input
            className="field"
            placeholder="Label (e.g. Weekend rate)"
            value={field.label}
            onChange={(event) => update(field.id, { label: event.target.value })}
          />
          <textarea
            className="field mt-2 min-h-20"
            placeholder="Value"
            value={field.value}
            onChange={(event) => update(field.id, { value: event.target.value })}
          />
        </div>
      ))}
      <button
        type="button"
        className="inline-flex items-center gap-2 text-sm text-amber-200"
        onClick={() => onChange([...fields, emptyNoteField()])}
      >
        <Plus className="h-4 w-4" />
        Add another field
      </button>
    </div>
  );
}
