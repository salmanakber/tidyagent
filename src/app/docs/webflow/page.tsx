import type { Metadata } from "next";
import Link from "next/link";
import { Logo } from "@/components/brand/Logo";
import { AuroraScene } from "@/components/brand/AuroraScene";
import { legalLinkClass } from "@/components/marketing/LegalShell";
import { legalHref } from "@/modules/legal/platform";

export const metadata: Metadata = {
  title: "Webflow app guide — tidyAgent",
  description:
    "How to install, configure, and use tidyAgent on Webflow: AI assistant, knowledge, WhatsApp, conversations, handoff, and disconnect.",
};

const TOC = [
  { id: "install", label: "Install" },
  { id: "ai-assistant", label: "AI assistant" },
  { id: "knowledge", label: "Business knowledge" },
  { id: "whatsapp", label: "WhatsApp support" },
  { id: "conversations", label: "Conversations" },
  { id: "handoff", label: "Human handoff" },
  { id: "behavior", label: "Support rules & behavior" },
  { id: "widget", label: "Chat widget (Custom Code)" },
  { id: "disconnect", label: "Disconnect & remove" },
  { id: "troubleshoot", label: "Troubleshoot" },
] as const;

export default function WebflowDocsPage() {
  return (
    <AuroraScene>
      <header className="sticky top-0 z-30 border-b border-white/10 bg-[#070B14]/55 backdrop-blur-xl">
        <div className="mx-auto flex max-w-3xl items-center justify-between px-5 py-3.5">
          <Logo href="/" />
          <div className="flex items-center gap-4 text-sm text-navy-200">
            <Link href="/install/webflow" className="transition hover:text-white">
              Permissions
            </Link>
            <Link href="/" className="transition hover:text-white">
              Home
            </Link>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-3xl px-5 pb-24 pt-12">
        <p className="text-[11px] font-medium uppercase tracking-[0.18em] text-amber-300">Webflow</p>
        <h1 className="mt-3 font-display text-4xl font-semibold tracking-tight text-white">
          tidyAgent user guide
        </h1>
        <p className="mt-4 text-[15px] leading-7 text-navy-200">
          tidyAgent is a <strong className="text-white">Hybrid Webflow App</strong>: a Designer Extension{" "}
          <strong className="text-white">Launch</strong> panel opens the hosted dashboard (it does not edit your
          canvas), and a Data Client connects your site. The AI answers visitors from{" "}
          <strong className="text-white">official Webflow Data APIs</strong> (pages, CMS, ecommerce when available)
          plus owner notes you add. It does <strong className="text-white">not</strong> crawl or scrape your published
          domain.
        </p>

        <nav className="mt-8 rounded-2xl border border-white/10 bg-white/5 p-5">
          <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-amber-300">On this page</p>
          <ul className="mt-3 grid gap-2 sm:grid-cols-2">
            {TOC.map((item) => (
              <li key={item.id}>
                <a href={`#${item.id}`} className={legalLinkClass}>
                  {item.label}
                </a>
              </li>
            ))}
          </ul>
        </nav>

        <div className="mt-14 space-y-14 text-[15px] leading-7 text-navy-200">
          <Section id="install" title="1. Install">
            <ol className="list-decimal space-y-2 pl-5">
              <li>Open tidyAgent from the Webflow Marketplace or the Designer Extension on your site.</li>
              <li>Approve the Data Client permissions (see the permissions list on{" "}
                <Link href="/install/webflow" className={legalLinkClass}>
                  /install/webflow
                </Link>
                ).
              </li>
              <li>Complete onboarding in the hosted dashboard at agent.tidyflowapp.com.</li>
              <li>Publish your Webflow site so the chat widget (Custom Code) is live for visitors.</li>
            </ol>
            <p className="mt-3">
              Reopen anytime from the Designer Extension (Launch) or{" "}
              <a href="https://agent.tidyflowapp.com/webflow" className={legalLinkClass}>
                agent.tidyflowapp.com/webflow
              </a>
              .
            </p>
          </Section>

          <Section id="ai-assistant" title="2. Configuring the AI assistant">
            <p>
              Go to <strong className="text-white">AI Agent</strong> in the dashboard sidebar.
            </p>
            <ul className="mt-3 list-disc space-y-2 pl-5">
              <li>
                <strong className="text-white">Name, photo, greeting</strong> — how the bubble introduces itself on the
                live site.
              </li>
              <li>
                <strong className="text-white">Colors &amp; position</strong> — widget primary color, optional gradient,
                text colors, bottom-left or bottom-right.
              </li>
              <li>
                <strong className="text-white">Personality &amp; focus</strong> — friendly / professional / casual, and
                whether the agent prioritizes support, sales, leads, products, or bookings.
              </li>
              <li>
                <strong className="text-white">Specialists</strong> (plan-dependent) — extra agents that only see the
                knowledge scopes you assign.
              </li>
              <li>
                <strong className="text-white">Voice</strong> — spoken replies when your plan includes voice.
              </li>
            </ul>
            <p className="mt-3">Use the live preview in Agent Studio before publishing style changes.</p>
          </Section>

          <Section id="knowledge" title="3. Managing business knowledge">
            <p>
              Open <strong className="text-white">Knowledge</strong>. tidyAgent builds answers from:
            </p>
            <ul className="mt-3 list-disc space-y-2 pl-5">
              <li>
                <strong className="text-white">Webflow Data APIs</strong> — site profile, pages metadata, CMS
                collections/items, and ecommerce products when your plan and site include them.
              </li>
              <li>
                <strong className="text-white">Owner notes</strong> — prices, exceptions, or private instructions you
                type; these sit above API knowledge and are never overwritten by a rescan.
              </li>
            </ul>
            <p className="mt-3">
              Click <strong className="text-white">Read site via Webflow APIs</strong> (or re-run the scanner) after you
              publish major content changes. Domain crawling / scraping of the published site is{" "}
              <strong className="text-white">not used</strong> for Webflow.
            </p>
          </Section>

          <Section id="whatsapp" title="4. Setting up WhatsApp support">
            <p>During onboarding (Your team) or later in Agent / settings for human support:</p>
            <ol className="mt-3 list-decimal space-y-2 pl-5">
              <li>Enter the team member’s WhatsApp number with the correct country code.</li>
              <li>Save. Visitors who choose WhatsApp open a handoff that continues the request on WhatsApp.</li>
              <li>You can also capture email when WhatsApp is not chosen (lead form in the widget).</li>
            </ol>
            <p className="mt-3">
              WhatsApp is optional. Without a number, visitors still get AI answers and can leave email for follow-up.
            </p>
          </Section>

          <Section id="conversations" title="5. Managing conversations">
            <p>
              Open <strong className="text-white">Inbox</strong> (or Conversations) in the dashboard.
            </p>
            <ul className="mt-3 list-disc space-y-2 pl-5">
              <li>See live and past visitor threads for this Webflow site only.</li>
              <li>Open a thread to read the full transcript and reply as a human when needed.</li>
              <li>Leads and WhatsApp handoffs appear in the same workspace so nothing is lost between channels.</li>
            </ul>
          </Section>

          <Section id="handoff" title="6. Configuring human handoff">
            <p>Handoff starts when the visitor asks for a person, or when the AI cannot answer confidently.</p>
            <ul className="mt-3 list-disc space-y-2 pl-5">
              <li>
                Set the <strong className="text-white">human team member</strong> name, role, email, photo, and optional
                WhatsApp in onboarding or Agent Studio.
              </li>
              <li>The widget shows a support choice (email / WhatsApp) instead of inventing an answer.</li>
              <li>Watch the Inbox for new handoffs and continue the conversation from there.</li>
            </ul>
          </Section>

          <Section id="behavior" title="7. Updating support rules and behavior">
            <ul className="list-disc space-y-2 pl-5">
              <li>
                <strong className="text-white">Owner notes</strong> (Knowledge) — highest priority rules, including
                private notes visitors never see.
              </li>
              <li>
                <strong className="text-white">Agent focus &amp; personality</strong> (AI Agent) — how the employee
                spends its time and tone.
              </li>
              <li>
                <strong className="text-white">Specialist scopes</strong> — limit what each specialist can see (products,
                policies, etc.).
              </li>
              <li>
                <strong className="text-white">Rescan</strong> after Webflow content changes so API knowledge stays
                current.
              </li>
            </ul>
          </Section>

          <Section id="widget" title="8. Chat widget (Custom Code)">
            <p>
              On install / open, tidyAgent registers a <strong className="text-white">site-wide JavaScript widget</strong>{" "}
              through Webflow’s Custom Code API and applies it at the site footer.
            </p>
            <ul className="mt-3 list-disc space-y-2 pl-5">
              <li>
                <strong className="text-white">What it does</strong> — shows the chat bubble and talks to tidyAgent’s
                hosted APIs for replies, leads, and handoff.
              </li>
              <li>
                <strong className="text-white">Where it runs</strong> — on your published Webflow site for visitors
                (after you publish).
              </li>
              <li>
                <strong className="text-white">Why it is required</strong> — without it, visitors have no chat UI on the
                live site.
              </li>
              <li>
                <strong className="text-white">Remote resources</strong> — the script loads hosted files from{" "}
                <code className="text-amber-300">https://agent.tidyflowapp.com/widget.js</code> (and related embed
                assets). It does not edit Designer canvas content.
              </li>
            </ul>
          </Section>

          <Section id="disconnect" title="9. Disconnecting the App and removing its widget">
            <ol className="list-decimal space-y-2 pl-5">
              <li>
                In tidyAgent <strong className="text-white">Settings</strong>, use Disconnect. While your Webflow token
                is still valid, tidyAgent removes <strong className="text-white">only</strong> its own site Custom Code
                / registered script and leaves unrelated scripts alone.
              </li>
              <li>
                In Webflow, uninstall tidyAgent from the site / Workspace apps so OAuth access is revoked.
              </li>
              <li>Publish the Webflow site so visitors no longer load a cached bubble.</li>
            </ol>
            <p className="mt-3 text-sm text-navy-400">
              After uninstall we delete or anonymize associated workspace data after a reasonable retention period. If a
              bubble remains, publish again or remove any leftover tidyAgent snippet under Site settings → Custom Code.
            </p>
          </Section>

          <Section id="troubleshoot" title="10. Troubleshoot">
            <ul className="list-disc space-y-2 pl-5">
              <li>
                <strong className="text-white">No bubble on the live site</strong> — finish onboarding, confirm Custom
                Code applied, then Publish the site.
              </li>
              <li>
                <strong className="text-white">Thin answers</strong> — re-run Knowledge via Webflow APIs; add owner notes
                for facts not in CMS/pages.
              </li>
              <li>
                <strong className="text-white">Permission errors</strong> — reconnect from Webflow and approve the same
                Data Client scopes listed on the install guide.
              </li>
              <li>
                <strong className="text-white">Billing</strong> — Webflow seats use card checkout in the tidyAgent
                billing page (not Wix/Shopify billing).
              </li>
            </ul>
          </Section>

          <p className="text-sm text-navy-400">
            Legal:{" "}
            <Link href={legalHref("/terms", "WEBFLOW")} className={legalLinkClass}>
              Terms
            </Link>
            {" · "}
            <Link href={legalHref("/privacy", "WEBFLOW")} className={legalLinkClass}>
              Privacy
            </Link>
            {" · "}
            <Link href="/install/webflow" className={legalLinkClass}>
              Permissions
            </Link>
            . Support: support@tidyflowapp.com
          </p>
        </div>
      </main>

      <footer className="border-t border-white/10">
        <div className="mx-auto flex max-w-3xl flex-wrap items-center justify-between gap-3 px-5 py-8 text-[12px] text-navy-400">
          <Logo compact href="/" />
          <div className="flex gap-5">
            <Link href="/docs/webflow" className="transition hover:text-white">
              Docs
            </Link>
            <Link href="/install/webflow" className="transition hover:text-white">
              Install
            </Link>
            <Link href={legalHref("/terms", "WEBFLOW")} className="transition hover:text-white">
              Terms
            </Link>
          </div>
        </div>
      </footer>
    </AuroraScene>
  );
}

function Section({ id, title, children }: { id: string; title: string; children: React.ReactNode }) {
  return (
    <section id={id} className="scroll-mt-24 space-y-3">
      <h2 className="font-display text-2xl text-white">{title}</h2>
      {children}
    </section>
  );
}
