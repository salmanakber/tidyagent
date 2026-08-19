"use client";

import { useState, useTransition } from "react";
import { Check, Sparkles } from "lucide-react";
import { advanceOnboarding, updateAgent } from "@/app/actions/workspace";
import { ChatWidget } from "@/components/widget/ChatWidget";
import { cn } from "@/lib/utils";

const STEPS = [
  "Connected",
  "Analyze",
  "Understand",
  "Capabilities",
  "Questions",
  "Configure",
  "Test",
  "Publish",
];

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
  capabilities,
  agentName,
  greeting,
  color,
}: {
  siteName: string;
  capabilities: { key: string; label: string; available: boolean }[];
  agentName: string;
  greeting: string;
  color: string;
}) {
  const [step, setStep] = useState(1);
  const [focus, setFocus] = useState<string[]>(["everything"]);
  const [personality, setPersonality] = useState<"friendly" | "professional" | "casual">("friendly");
  const [embed, setEmbed] = useState<"AUTO" | "MANUAL">("AUTO");
  const [pending, startTransition] = useTransition();

  function next() {
    startTransition(async () => {
      if (step === 1) await advanceOnboarding("ANALYZING");
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
          <Step title="Website connected" body={`${siteName} is securely identified. Next we’ll understand the business — not just copy the site text.`}>
            <div className="rounded-2xl bg-navy-950/50 p-4 text-sm text-navy-200">Wix site identity synced. Tenant created. Subscription state stored server-side.</div>
          </Step>
        )}
        {step === 2 && (
          <Step title="Analyzing your website" body="Collecting pages, products, policies, and calls to action. Raw HTML is never sent straight to the model.">
            <div className="space-y-3">
              {["Homepage & about", "Products and pricing", "Policies & FAQ", "Contact and hours"].map((item) => (
                <div key={item} className="flex items-center gap-3 text-sm">
                  <span className="flex h-6 w-6 items-center justify-center rounded-full bg-amber-500/15 text-amber-300">
                    <Sparkles className="h-3.5 w-3.5 animate-pulse-soft" />
                  </span>
                  {item}
                </div>
              ))}
            </div>
          </Step>
        )}
        {step === 3 && (
          <Step title="We think we understand the business" body="Online fashion and product catalog signals are strongest, so we’ll prove the AI employee on ecommerce first.">
            <div className="grid gap-3 sm:grid-cols-2">
              <Info label="Business" value="Online fashion store" />
              <Info label="Model" value="Ecommerce catalog + cart" />
              <Info label="Customers" value="Shoppers choosing products" />
              <Info label="AI focus" value="Support + guided shopping" />
            </div>
          </Step>
        )}
        {step === 4 && (
          <Step title="Detected Wix capabilities" body="The agent will only get tools that this site actually supports.">
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
          <Step title="A few simple questions" body="What should your AI employee focus on? We’ll recommend the rest.">
            <div className="grid gap-2 sm:grid-cols-2">
              {FOCUS_OPTIONS.map((option) => {
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
                  <span className="text-sm text-navy-300">Adds the widget to every page. No manual setup.</span>
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
          <Step title="Your AI employee is configured" body={`${agentName} is ready with support, shopping help, lead capture, and human handoff.`}>
            <ul className="space-y-2 text-sm">
              {["Customer support", "Product recommendations", "Cart assistance", "Order support", "Lead generation"].map((item) => (
                <li key={item} className="flex items-center gap-2">
                  <Check className="h-4 w-4 text-amber-400" /> {item}
                </li>
              ))}
            </ul>
          </Step>
        )}
        {step === 7 && (
          <div className="grid gap-6 lg:grid-cols-[1fr_360px]">
            <Step title="Test your AI employee" body="This preview uses the same widget customers will see. Brand colors are yours, not tidyAgent’s." />
            <ChatWidget name={agentName} greeting={greeting} primaryColor={color} preview />
          </div>
        )}

        <div className="mt-8 flex justify-end">
          <button className="btn-primary" onClick={next} disabled={pending}>
            {step >= 7 ? "Publish AI employee" : pending ? "Working…" : "Continue"}
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
