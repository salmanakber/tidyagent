"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Check } from "lucide-react";
import { addCustomKnowledge, advanceOnboarding, saveSetupPeople, updateAgent } from "@/app/actions/workspace";
import { ChatWidget } from "@/components/widget/ChatWidget";
import { SiteScanPanel } from "@/components/knowledge/SiteScanPanel";
import { AvatarPicker } from "@/components/agent/AvatarPicker";
import { WhatsAppNumberField } from "@/components/support/WhatsAppNumberField";
import { OwnerNoteFields, composeOwnerNote, emptyNoteField, type NoteField } from "@/components/knowledge/OwnerNoteFields";
import { cn } from "@/lib/utils";
import { publicSupportChannels } from "@/modules/support/channels";
import type { ScanResult, SiteUnderstanding } from "@/modules/knowledge/types";

const STEPS = ["Connected", "Scan", "Business", "Your team", "Owner notes", "Style", "Test", "Go live"];

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
  humanName,
  humanRole,
  humanEmail,
  humanAvatarUrl,
  humanWhatsapp,
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
  humanName?: string | null;
  humanRole?: string | null;
  humanEmail?: string | null;
  humanAvatarUrl?: string | null;
  humanWhatsapp?: string | null;
}) {
  const [step, setStep] = useState(1);
  const [scan, setScan] = useState<ScanResult | null>(null);
  const [focus, setFocus] = useState<string[]>(["everything"]);
  const [personality, setPersonality] = useState<"friendly" | "professional" | "casual">("friendly");
  const [embed, setEmbed] = useState<"AUTO" | "MANUAL">("AUTO");
  const [aiName, setAiName] = useState(agentName);
  const [personName, setPersonName] = useState(humanName || "");
  const [personRole, setPersonRole] = useState(humanRole || "Team");
  const [personEmail, setPersonEmail] = useState(humanEmail || "");
  const [personPhoto, setPersonPhoto] = useState(humanAvatarUrl || "");
  const [personWhatsapp, setPersonWhatsapp] = useState(humanWhatsapp || "");
  const [whatsappCountry, setWhatsappCountry] = useState("");
  const [whatsappError, setWhatsappError] = useState<string | null>(null);
  const [teamError, setTeamError] = useState<string | null>(null);
  const [noteTitle, setNoteTitle] = useState("");
  const [noteFields, setNoteFields] = useState<NoteField[]>([emptyNoteField()]);
  const [notePriority, setNotePriority] = useState(true);
  const [noteSensitive, setNoteSensitive] = useState(false);
  const [pending, startTransition] = useTransition();
  const router = useRouter();

  const understanding = scan?.understanding ?? existingUnderstanding ?? null;
  const teamReady = personName.trim().length >= 2 && aiName.trim().length >= 1;

  function next() {
    if (step === 2 && !scan?.ok && !existingUnderstanding) return;
    if (step === 4 && !teamReady) return;
    if (step === 4 && whatsappError) {
      setTeamError(whatsappError);
      return;
    }
    startTransition(async () => {
      try {
      setTeamError(null);
      if (step === 2) await advanceOnboarding("ANALYZING");
      if (step === 4) {
        const result = await saveSetupPeople({
          agentName: aiName.trim(),
          humanName: personName.trim(),
          humanRole: personRole.trim() || "Team",
          humanEmail: personEmail.trim() && personEmail.includes("@") ? personEmail.trim() : undefined,
          humanAvatarUrl: personPhoto || undefined,
          humanWhatsapp: personWhatsapp || null,
          humanWhatsappCountry: whatsappCountry || null,
        });
        if (!result.ok) {
          setTeamError(result.error);
          return;
        }
        await advanceOnboarding("QUESTIONS");
      }
      if (step === 5 && noteTitle.trim().length >= 2 && composeOwnerNote(noteFields).length >= 2) {
        await addCustomKnowledge(noteTitle.trim(), composeOwnerNote(noteFields), {
          priority: notePriority,
          sensitive: noteSensitive,
        });
      }
      if (step === 6) {
        await updateAgent({ personality, focus, widgetEmbedMode: embed, name: aiName.trim() });
        await advanceOnboarding("CONFIGURED");
      }
      if (step === 7) {
        await advanceOnboarding("PUBLISHED");
        router.push("/dashboard");
        return;
      }
      setStep((value) => Math.min(value + 1, STEPS.length - 1));
      } catch {
        /* keep the wizard on this step */
      }
    });
  }

  const last = step >= STEPS.length - 1;

  return (
    <div className="mx-auto max-w-5xl">
      <div className="mb-8 overflow-x-auto">
        <div className="flex min-w-[720px] gap-2">
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
            <SiteScanPanel planLabel={planLabel} scopeNote={scopeNote} siteUrl={siteUrl} onComplete={setScan} />
          </Step>
        )}

        {step === 3 && (
          <Step
            title="What we understand about this business"
            body="This profile is built from pages the scanner actually read. If something is thin, add owner notes in the next steps rather than inventing it."
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
              </div>
            ) : (
              <p className="text-sm text-navy-300">Run the scanner first so this is based on the live site.</p>
            )}
          </Step>
        )}

        {step === 4 && (
          <Step
            title="Name the AI and the real person"
            body="The chat employee is AI. When it cannot verify an answer, visitors are connected to a real human — with this name, not another AI."
          >
            <div className="grid gap-5 lg:grid-cols-[auto_1fr]">
              <AvatarPicker compact name={personName || "Team"} url={personPhoto || null} onChange={(url) => setPersonPhoto(url || "")} />
              <div className="grid gap-4 sm:grid-cols-2">
              <label className="text-sm text-navy-300">
                AI employee name
                <input className="field mt-2" value={aiName} onChange={(event) => setAiName(event.target.value)} />
              </label>
              <label className="text-sm text-navy-300">
                Real team member name
                <input
                  className="field mt-2"
                  placeholder="e.g. Maria"
                  value={personName}
                  onChange={(event) => setPersonName(event.target.value)}
                />
              </label>
              <label className="text-sm text-navy-300">
                Their role
                <input className="field mt-2" value={personRole} onChange={(event) => setPersonRole(event.target.value)} />
              </label>
              <label className="text-sm text-navy-300">
                Email (optional)
                <input className="field mt-2" value={personEmail} onChange={(event) => setPersonEmail(event.target.value)} />
              </label>
              <WhatsAppNumberField
                value={humanWhatsapp}
                error={teamError && /whatsapp|number|country/i.test(teamError) ? teamError : null}
                onChange={(e164, meta) => {
                  setPersonWhatsapp(e164 || "");
                  setWhatsappCountry(meta.country);
                  setWhatsappError(meta.error);
                }}
              />
              </div>
            </div>
            {teamError ? <p className="mt-3 text-sm text-rose-300">{teamError}</p> : null}
            <p className="mt-4 text-xs text-navy-400">
              Visitors will see a “Connecting you with {personName.trim() || "your name"}” bubble. That person is not generated by AI.
              A WhatsApp number lets them continue the same request in WhatsApp instead of only leaving a form.
            </p>
          </Step>
        )}

        {step === 5 && (
          <Step
            title="Owner notes the AI must follow"
            body="Add prices, exceptions, or sensitive instructions the website does not spell out. These sit above crawled pages. You can skip this and add more later in Knowledge."
          >
            <div className="grid gap-3">
              <input className="field" placeholder="Title (e.g. Weekend rates)" value={noteTitle} onChange={(event) => setNoteTitle(event.target.value)} />
              <OwnerNoteFields fields={noteFields} onChange={setNoteFields} />
              <label className="flex items-center gap-2 text-sm text-navy-200">
                <input type="checkbox" checked={notePriority} onChange={(event) => setNotePriority(event.target.checked)} />
                Use as priority over the website
              </label>
              <label className="flex items-center gap-2 text-sm text-navy-200">
                <input type="checkbox" checked={noteSensitive} onChange={(event) => setNoteSensitive(event.target.checked)} />
                Keep private — the employee uses this, visitors never see the note
              </label>
            </div>
          </Step>
        )}

        {step === 6 && (
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

        {step === 7 && (
          <div className="grid gap-6 lg:grid-cols-[1fr_360px]">
            <Step
              title="Test the employee"
              body="Ask a product question if you have a catalog — matching items show as cards. Ask something unknown to see the human handoff bubble."
            >
              <ul className="space-y-2 text-sm">
                {[
                  `${aiName} answers from the live site`,
                  `Unknown questions connect to ${personName.trim() || "your team member"}`,
                  "Matching products show as photo cards",
                  "Owner notes sit above crawled pages",
                ].map((item) => (
                  <li key={item} className="flex items-center gap-2">
                    <Check className="h-4 w-4 text-amber-400" /> {item}
                  </li>
                ))}
              </ul>
            </Step>
            <ChatWidget
              name={aiName}
              greeting={greeting.replace(agentName, aiName)}
              primaryColor={color}
              avatarUrl={avatarUrl}
              preview
              startOpen
              whatsappDigits={publicSupportChannels(personWhatsapp).whatsapp?.digits}
            />
          </div>
        )}

        <div className="mt-8 flex justify-end">
          <button
            className="btn-primary"
            onClick={next}
            disabled={
              pending ||
              (step === 2 && !scan?.ok && !existingUnderstanding) ||
              (step === 4 && !teamReady) ||
              (step === 4 && Boolean(whatsappError))
            }
          >
            {last ? "Publish and open dashboard" : pending ? "Working…" : step === 2 && !scan?.ok && !existingUnderstanding ? "Scan required" : step === 4 && !teamReady ? "Name the real person" : step === 4 && whatsappError ? "Fix WhatsApp number" : "Continue"}
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
