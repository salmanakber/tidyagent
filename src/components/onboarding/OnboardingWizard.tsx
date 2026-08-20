"use client";

import { useState, useTransition } from "react";
import { Check } from "lucide-react";
import { advanceOnboarding, updateAgent } from "@/app/actions/workspace";
import { ChatWidget } from "@/components/widget/ChatWidget";
import { SiteScanPanel } from "@/components/knowledge/SiteScanPanel";
import { cn } from "@/lib/utils";
import type { ScanResult, SiteUnderstanding } from "@/modules/knowledge/types";

const STEPS = ["Connected", "Scan", "Understanding", "Capabilities", "Focus", "Configure", "Test", "Publish"];

const FOCUS_OPTIONS = [
  { key: "customer_support", label: "Customer support" },
  { key: "sales", label: "Sales" },
  { key: "lead_generation", label: "Lead generation" },
  { key: "product_recommendations", label: "Product recommendations" },
  { key: "bookings", label: "Bookings" },
  { key: "everything", label: "Everything recommended" },
];

export function OnboardingWizard({
  siteName,
  siteUrl,
  planLabel,
  scopeNote,
  capabilities,
  agentName,
  greeting,
  color,
  avatarUrl,
  existingUnderstanding,
}: {
  siteName: string;
  siteUrl?: string | null;
  planLabel: string;
  scopeNote: string;
  capabilities: { key: string; label: string; available: boolean }[];
  agentName: string;
  greeting: string;
  color: string;
  avatarUrl?: string | null;
  existingUnderstanding?: SiteUnderstanding | null;
}) {
  const [step, setStep] = useState(1);
  const [scan, setScan] = useState<ScanResult | null>(null);
  const [focus, setFocus] = useState<string[]>(["everything"]);
  const [personality, setPersonality] = useState<"friendly" | "professional" | "casual">("friendly");
  const [embed, setEmbed] = useState<"AUTO" | "MANUAL">("AUTO");
  const [pending, startTransition] = useTransition();

  const understanding = scan?.understanding ?? existingUnderstanding ?? null;

  function next() {
    if (step === 2 && !scan?.ok && !existingUnderstanding) return;
    startTransition(async () => {
      if (step === 2) await advanceOnboarding("ANALYZING");
      if (step === 4) await advanceOnboarding("QUESTIONS");
      if (step === 5) {
        await updateAgent({ personality, focus, widgetEmbedMode: embed });
        await advanceOnboarding("CONFIGURED");
      }
      if (step === 6) await advanceOnboarding("TESTED");
      if (step === 7) await advanceOnboarding("PUBLISHED");
      setStep((value) => Math.min(value + 1, STEPS.length - 1));
    });
  }

  return (
    <div className="mx-auto max-w-5xl">
      <div className="mb-8 overflow-x-auto">
        <div className="flex min-w-[640px] gap-2">
          {STEPS.map((label, index) => (
            <div key={label} className="flex-1">
              <div className={cn("h-1.5 rounded-full", index <= step ? "bg-amber-500" : "bg-white/10")} />
              <p className="mt-2 text-[11px] uppercase tracking-[0.14em] text-navy-300">{label}</p>
            </div>
          ))}
        </div>
      </div>

      <div className="panel p-6 sm:p-8">
        {step === 1 && (
          <Step
            title="Website connected"
            body={`${siteName} is identified through Wix. The next step is a real read of the live site — scoped to ${planLabel} — so the employee learns this business, not a generic script.`}
          >
            <div className="grid gap-3 sm:grid-cols-2">
              <Info label="Site" value={siteName} />
              <Info label="Public URL" value={siteUrl || "Unpublished"} />
              <Info label="Plan" value={planLabel} />
              <Info label="Scan depth" value={scopeNote} />
            </div>
          </Step>
        )}

        {step === 2 && (
          <Step
            title="Read and understand the website"
            body="This pulls pages, policies, and (on Business/Pro) catalog data from the live site. Re-run it whenever the site changes."
          >
            <SiteScanPanel
              planLabel={planLabel}
              scopeNote={scopeNote}
              siteUrl={siteUrl}
              onComplete={setScan}
            />
          </Step>
        )}

        {step === 3 && (
          <Step
            title="What we understand about this business"
            body="This profile is built from pages the scanner actually read. If something is thin, add knowledge later rather than inventing it."
          >
            {understanding ? (
              <div className="space-y-4">
                <div className="grid gap-3 sm:grid-cols-2">
                  <Info label="Business" value={understanding.name} />
                  <Info label="Industry" value={understanding.industry} />
                  <Info label="Model" value={understanding.businessModel} />
                  <Info label="Audience" value={understanding.audience} />
                </div>
                <p className="text-sm leading-6 text-navy-200">{understanding.summary}</p>
                {understanding.offerings.length ? (
                  <div>
                    <p className="text-[11px] uppercase tracking-[0.16em] text-navy-400">Offerings</p>
                    <div className="mt-2 flex flex-wrap gap-2">
                      {understanding.offerings.slice(0, 10).map((item) => (
                        <span key={item} className="rounded-full bg-white/5 px-3 py-1 text-xs text-navy-100">
                          {item}
                        </span>
                      ))}
                    </div>
                  </div>
                ) : null}
                <p className="text-xs text-navy-400">Confidence: {understanding.confidence}</p>
              </div>
            ) : (
              <p className="text-sm text-navy-300">Run the scanner first so this is based on the live site.</p>
            )}
          </Step>
        )}

        {step === 4 && (
          <Step title="Detected Wix capabilities" body="Tools stay limited to apps this site actually has, and to what the current plan is allowed to use.">
            <div className="grid gap-2 sm:grid-cols-2">
              {capabilities.map((capability) => (
                <div key={capability.key} className="flex items-center justify-between rounded-2xl bg-navy-950/40 px-4 py-3 text-sm">
                  <span>{capability.label}</span>
                  <span className={capability.available ? "text-emerald-300" : "text-navy-400"}>
                    {capability.available ? "Available" : "Not found"}
                  </span>
                </div>
              ))}
            </div>
          </Step>
        )}

        {step === 5 && (
          <Step title="How should the employee spend its time?" body="We’ll recommend the rest from the site scan. You can change this later in Agent Studio.">
            <div className="grid gap-2 sm:grid-cols-2">
              {FOCUS_OPTIONS.filter((option) => {
                if (option.key === "product_recommendations") {
                  return capabilities.some((item) => item.key === "products" || item.key === "product_search");
                }
                if (option.key === "bookings") {
                  return capabilities.some((item) => item.key === "bookings");
                }
                return true;
              }).map((option) => {
                const selected = focus.includes(option.key);
                return (
                  <button
                    key={option.key}
                    onClick={() =>
                      setFocus((current) =>
                        current.includes(option.key) ? current.filter((key) => key !== option.key) : [...current, option.key],
                      )
                    }
                    className={cn("rounded-2xl border px-4 py-3 text-left text-sm", selected ? "border-amber-400/40 bg-amber-500/10" : "border-white/10")}
                  >
                    {option.label}
                  </button>
                );
              })}
            </div>
            <div className="mt-6 flex flex-wrap gap-2">
              {(["friendly", "professional", "casual"] as const).map((item) => (
                <button
                  key={item}
                  onClick={() => setPersonality(item)}
                  className={cn("rounded-full px-4 py-2 text-sm capitalize", personality === item ? "bg-amber-500 text-navy-950" : "bg-white/5")}
                >
                  {item}
                </button>
              ))}
            </div>
            <div className="mt-6 space-y-3">
              <p className="text-sm font-medium">Add tidyAgent to your site</p>
              <label className="flex cursor-pointer items-start gap-3 rounded-2xl border border-white/10 p-4">
                <input type="radio" checked={embed === "AUTO"} onChange={() => setEmbed("AUTO")} />
                <span>
                  <span className="block text-sm font-medium">Auto-install (recommended)</span>
                  <span className="text-sm text-navy-300">Adds the widget to every published page.</span>
                </span>
              </label>
              <label className="flex cursor-pointer items-start gap-3 rounded-2xl border border-white/10 p-4">
                <input type="radio" checked={embed === "MANUAL"} onChange={() => setEmbed("MANUAL")} />
                <span>
                  <span className="block text-sm font-medium">Manual placement</span>
                  <span className="text-sm text-navy-300">Place the widget only where you want it in the Wix Editor.</span>
                </span>
              </label>
            </div>
          </Step>
        )}

        {step === 6 && (
          <Step
            title={`${agentName} is ready for this business`}
            body={
              understanding
                ? `Trained on ${understanding.name}. Answers will stay inside what was read from the site and any knowledge you add.`
                : "Publish after a successful scan so the employee is not guessing."
            }
          >
            <ul className="space-y-2 text-sm">
              {[
                "Answers from scanned site content",
                "Human handoff when evidence is missing",
                "Owner-branded widget, not tidyAgent colors",
                scan?.counts.products ? "Catalog-aware replies in plan scope" : "Page and policy knowledge",
              ].map((item) => (
                <li key={item} className="flex items-center gap-2">
                  <Check className="h-4 w-4 text-amber-400" /> {item}
                </li>
              ))}
            </ul>
          </Step>
        )}

        {step === 7 && (
          <div className="grid gap-6 lg:grid-cols-[1fr_360px]">
            <Step
              title="Test the employee"
              body="This is the same launcher customers will see — avatar, greeting animation, and your position setting."
            />
            <ChatWidget
              name={agentName}
              greeting={greeting}
              primaryColor={color}
              avatarUrl={avatarUrl}
              preview
            />
          </div>
        )}

        <div className="mt-8 flex justify-end">
          <button
            className="btn-primary"
            onClick={next}
            disabled={pending || (step === 2 && !scan?.ok && !existingUnderstanding)}
          >
            {step >= 7 ? "Publish AI employee" : pending ? "Working…" : step === 2 && !scan?.ok && !existingUnderstanding ? "Scan required" : "Continue"}
          </button>
        </div>
      </div>
    </div>
  );
}

function Step({ title, body, children }: { title: string; body: string; children?: React.ReactNode }) {
  return (
    <div>
      <h2 className="font-display text-3xl font-semibold text-white">{title}</h2>
      <p className="mt-2 max-w-2xl text-sm leading-6 text-navy-300">{body}</p>
      {children ? <div className="mt-6">{children}</div> : null}
    </div>
  );
}

function Info({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-2xl bg-navy-950/40 p-4">
      <p className="text-[11px] uppercase tracking-[0.16em] text-navy-400">{label}</p>
      <p className="mt-1 text-sm text-white">{value}</p>
    </div>
  );
}
