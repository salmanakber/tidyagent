"use client";

import { useState, useTransition } from "react";
import type { PlanKey } from "@prisma/client";
import { savePlanScopesAction } from "@/app/actions/settings";
import {
  DEFAULT_PLAN_SCOPES,
  PLAN_KEYS,
  cloneAllPlanScopes,
  planScopeEditorMeta,
  type PlanScopeConfig,
} from "@/modules/billing/plan-scopes";

const META = planScopeEditorMeta();

export function PlanScopesForm({ initial }: { initial: Record<PlanKey, PlanScopeConfig> }) {
  const [plans, setPlans] = useState(() => cloneAllPlanScopes(initial));
  const [pending, startTransition] = useTransition();
  const [message, setMessage] = useState<{ ok: boolean; text: string } | null>(null);

  function patch(key: PlanKey, next: PlanScopeConfig) {
    setPlans((current) => ({ ...current, [key]: next }));
  }

  return (
    <div className="space-y-6">
      {message ? (
        <p
          className={`rounded-2xl px-4 py-3 text-sm ${
            message.ok ? "bg-emerald-500/10 text-emerald-200" : "bg-rose-500/10 text-rose-200"
          }`}
        >
          {message.text}
        </p>
      ) : null}

      <div className="grid gap-4 xl:grid-cols-2">
        {PLAN_KEYS.map((key) => (
          <PlanCard
            key={key}
            planKey={key}
            label={META.plans.find((item) => item.key === key)?.label ?? key}
            value={plans[key]}
            onChange={(next) => patch(key, next)}
          />
        ))}
      </div>

      <div className="flex flex-wrap items-center gap-3">
        <button
          className="btn-primary"
          disabled={pending}
          onClick={() =>
            startTransition(async () => {
              const result = await savePlanScopesAction(plans);
              setMessage(
                result.ok
                  ? { ok: true, text: "Plan scopes saved. Live workspaces pick this up on the next request." }
                  : { ok: false, text: result.error ?? "Could not save." },
              );
            })
          }
        >
          {pending ? "Saving…" : "Save all plans"}
        </button>
        <button
          className="btn-secondary"
          type="button"
          disabled={pending}
          onClick={() => {
            setPlans(cloneAllPlanScopes(DEFAULT_PLAN_SCOPES));
            setMessage({ ok: true, text: "Restored shipped defaults in this form. Click Save to apply." });
          }}
        >
          Reset form to defaults
        </button>
      </div>
    </div>
  );
}

function PlanCard({
  planKey,
  label,
  value,
  onChange,
}: {
  planKey: PlanKey;
  label: string;
  value: PlanScopeConfig;
  onChange: (next: PlanScopeConfig) => void;
}) {
  return (
    <section className="panel space-y-5 p-6">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-[11px] uppercase tracking-[0.16em] text-navy-300">{planKey}</p>
          <h2 className="mt-1 font-display text-2xl text-white">{label}</h2>
        </div>
        <button
          type="button"
          className="btn-secondary px-3 py-1.5 text-xs"
          onClick={() => onChange(cloneAllPlanScopes(DEFAULT_PLAN_SCOPES)[planKey])}
        >
          Reset plan
        </button>
      </div>

      <div className="grid gap-3 sm:grid-cols-3">
        <NumberField
          label="Agents"
          value={value.maxAgents}
          min={1}
          onChange={(maxAgents) => onChange({ ...value, maxAgents })}
        />
        <NumberField
          label="Conversations / month"
          value={value.conversationLimit}
          onChange={(conversationLimit) => onChange({ ...value, conversationLimit })}
        />
        <NumberField
          label="Knowledge pages"
          value={value.knowledgeLimit}
          onChange={(knowledgeLimit) => onChange({ ...value, knowledgeLimit })}
        />
      </div>

      <fieldset className="space-y-2">
        <legend className="text-sm text-navy-300">Features</legend>
        <Check label="Voice replies" checked={value.voiceEnabled} onChange={(voiceEnabled) => onChange({ ...value, voiceEnabled })} />
        <Check
          label="All widget looks"
          checked={value.allTemplates}
          onChange={(allTemplates) => onChange({ ...value, allTemplates })}
        />
        <Check
          label="Store catalog (advanced tools)"
          checked={value.advancedToolsEnabled}
          onChange={(advancedToolsEnabled) => onChange({ ...value, advancedToolsEnabled })}
        />
        <Check
          label="Automations master switch"
          checked={value.automationEnabled}
          onChange={(automationEnabled) => onChange({ ...value, automationEnabled })}
        />
      </fieldset>

      <fieldset className="space-y-2">
        <legend className="text-sm text-navy-300">Automations on this plan</legend>
        {META.automations.map((item) => (
          <Check
            key={item.key}
            label={item.label}
            hint={item.blurb}
            checked={value.automations[item.key]}
            onChange={(on) =>
              onChange({
                ...value,
                automations: { ...value.automations, [item.key]: on },
              })
            }
          />
        ))}
      </fieldset>

      <fieldset className="space-y-3">
        <legend className="text-sm text-navy-300">Site scan scope</legend>
        <div className="grid gap-3 sm:grid-cols-2">
          <NumberField
            label="Max pages"
            value={value.scan.maxPages}
            onChange={(maxPages) => onChange({ ...value, scan: { ...value.scan, maxPages } })}
          />
          <NumberField
            label="Max products"
            value={value.scan.maxProducts}
            onChange={(maxProducts) => onChange({ ...value, scan: { ...value.scan, maxProducts } })}
          />
          <NumberField
            label="Chars per page"
            value={value.scan.maxCharsPerPage}
            onChange={(maxCharsPerPage) => onChange({ ...value, scan: { ...value.scan, maxCharsPerPage } })}
          />
          <NumberField
            label="CMS collections"
            value={value.scan.maxCmsCollections}
            onChange={(maxCmsCollections) => onChange({ ...value, scan: { ...value.scan, maxCmsCollections } })}
          />
        </div>
        <Check
          label="Site profile"
          checked={value.scan.includeSiteProperties}
          onChange={(includeSiteProperties) => onChange({ ...value, scan: { ...value.scan, includeSiteProperties } })}
        />
        <Check
          label="CMS"
          checked={value.scan.includeCms}
          onChange={(includeCms) => onChange({ ...value, scan: { ...value.scan, includeCms } })}
        />
        <Check
          label="Wix Stores catalog"
          checked={value.scan.includeStores}
          onChange={(includeStores) => onChange({ ...value, scan: { ...value.scan, includeStores } })}
        />
        <Check
          label="Wix Bookings"
          checked={value.scan.includeBookings}
          onChange={(includeBookings) => onChange({ ...value, scan: { ...value.scan, includeBookings } })}
        />
        <Check
          label="Domain crawl"
          checked={value.scan.includeDomainCrawl}
          onChange={(includeDomainCrawl) => onChange({ ...value, scan: { ...value.scan, includeDomainCrawl } })}
        />
        <label className="block text-sm text-navy-300">
          Scan note shown to the site owner
          <textarea
            className="field mt-2 min-h-[88px]"
            value={value.scan.depthNote}
            onChange={(event) => onChange({ ...value, scan: { ...value.scan, depthNote: event.target.value } })}
          />
        </label>
      </fieldset>
    </section>
  );
}

function NumberField({
  label,
  value,
  min = 0,
  onChange,
}: {
  label: string;
  value: number;
  min?: number;
  onChange: (value: number) => void;
}) {
  return (
    <label className="text-sm text-navy-300">
      {label}
      <input
        className="field mt-2"
        type="number"
        min={min}
        value={value}
        onChange={(event) => onChange(Math.max(min, Number(event.target.value) || 0))}
      />
    </label>
  );
}

function Check({
  label,
  hint,
  checked,
  onChange,
}: {
  label: string;
  hint?: string;
  checked: boolean;
  onChange: (value: boolean) => void;
}) {
  return (
    <label className="flex items-start gap-3 text-sm text-navy-100">
      <input
        type="checkbox"
        className="mt-0.5 h-4 w-4"
        checked={checked}
        onChange={(event) => onChange(event.target.checked)}
      />
      <span>
        <span className="block text-white">{label}</span>
        {hint ? <span className="mt-0.5 block text-xs leading-5 text-navy-400">{hint}</span> : null}
      </span>
    </label>
  );
}
