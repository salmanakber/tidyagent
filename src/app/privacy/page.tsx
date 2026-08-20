import type { Metadata } from "next";
import { LegalH, LegalShell, LEGAL_CONTACT, LEGAL_SITE } from "@/components/marketing/LegalShell";

export const metadata: Metadata = {
  title: "Privacy Policy — tidyAgent",
  description: "How tidyAgent collects, uses, and stores data for Wix site owners and their visitors.",
};

export default function PrivacyPage() {
  return (
    <LegalShell eyebrow="Legal" title="Privacy Policy">
      <p>
        This Privacy Policy explains how tidyAgent (“we”, “us”) handles personal data when you install the app,
        use the dashboard at {LEGAL_SITE}, or when a visitor chats with the widget on a connected Wix site.
      </p>
      <p>
        Contact:{" "}
        <a className="text-amber-300 hover:underline" href={`mailto:${LEGAL_CONTACT}`}>
          {LEGAL_CONTACT}
        </a>
        .
      </p>

      <section className="space-y-3">
        <LegalH>1. Who is responsible</LegalH>
        <p>
          For site-owner accounts (email, login, billing status, agent settings), tidyAgent is the controller.
          For visitor chat content on your live site, you are typically the controller and tidyAgent is the
          processor acting on your instructions to provide the Service. Wix is a separate controller for App
          Market billing and the Wix account.
        </p>
      </section>

      <section className="space-y-3">
        <LegalH>2. Data we collect</LegalH>
        <p>
          <strong className="text-white">Site owners.</strong> Name, email, password hash (or Google login identifiers),
          workspace settings, agent names and photos you upload, plan entitlements reported by Wix (instance id,
          package, trial/paid status), and support messages you send us.
        </p>
        <p>
          <strong className="text-white">Connected site.</strong> Site display name, URL, locale, currency, installed
          Wix apps, and content we are allowed to read under your plan (pages, CMS, catalog, bookings, and similar
          public or API-accessible business information).
        </p>
        <p>
          <strong className="text-white">Visitors.</strong> Chat messages, optional email if lead capture is on,
          timestamps, and technical identifiers needed to keep a conversation (for example a visitor id in the
          widget). We do not ask visitors for payment cards through tidyAgent.
        </p>
        <p>
          <strong className="text-white">Logs.</strong> Standard server logs (IP, user agent, request path) for
          security and debugging, retained for a short period.
        </p>
      </section>

      <section className="space-y-3">
        <LegalH>3. How we use data</LegalH>
        <ul className="list-disc space-y-2 pl-5">
          <li>to authenticate you and isolate each Wix site’s workspace;</li>
          <li>to scan and index site knowledge so the AI can answer visitors;</li>
          <li>to generate replies, spoken audio (if enabled), and specialist handoffs;</li>
          <li>to show you conversations, analytics, and leads in the dashboard;</li>
          <li>to enforce plan limits and investigate abuse;</li>
          <li>to send operational email (login, security, service notices) — not unrelated marketing unless you opt in.</li>
        </ul>
      </section>

      <section className="space-y-3">
        <LegalH>4. Processors and sharing</LegalH>
        <p>We share data only as needed to run the Service:</p>
        <ul className="list-disc space-y-2 pl-5">
          <li>Wix — install, permissions, site APIs, and App Market billing;</li>
          <li>AI model providers (for example Google Gemini, Groq, OpenAI) — prompts built from your knowledge and the visitor message, to generate a reply;</li>
          <li>speech providers (Google Cloud Text-to-Speech and, if configured, Amazon Polly) — text of replies you enable for voice;</li>
          <li>image hosting (Cloudinary, if configured) — agent photos you upload;</li>
          <li>hosting and database providers that store the application and PostgreSQL data.</li>
        </ul>
        <p>
          We do not sell visitor chats or site-owner lists. We do not use CRM or order data to build a marketing
          database for ourselves.
        </p>
      </section>

      <section className="space-y-3">
        <LegalH>5. Cookies and similar tech</LegalH>
        <p>
          The dashboard uses a session cookie after you sign in. The public widget uses a signed init token scoped
          to one site — not a client-supplied organization id. On the live Wix site, you are responsible for cookie
          banners and visitor consent tools required by your audience (including GDPR/ePrivacy where they apply).
        </p>
      </section>

      <section className="space-y-3">
        <LegalH>6. Retention</LegalH>
        <p>
          Account and knowledge data are kept while the app is installed and the workspace is active. After uninstall
          or a deletion request, we delete or anonymize personal data within a reasonable period unless we must keep
          a record for security, billing disputes, or law. Conversation logs follow the same rule unless you export
          or delete them sooner from the dashboard where that control exists.
        </p>
      </section>

      <section className="space-y-3">
        <LegalH>7. Security</LegalH>
        <p>
          Traffic is served over HTTPS. Passwords are stored as hashes, not plaintext. Tenant queries are bound to
          the verified organization for the session. You still need a strong password and should revoke access if a
          teammate leaves.
        </p>
      </section>

      <section className="space-y-3">
        <LegalH>8. Your rights</LegalH>
        <p>
          Depending on where you live, you may have rights to access, correct, delete, or export personal data, or
          to object to certain processing. Site owners can start with the dashboard and{" "}
          <a className="text-amber-300 hover:underline" href={`mailto:${LEGAL_CONTACT}`}>
            {LEGAL_CONTACT}
          </a>
          . Visitors should contact the site owner first; we will assist the owner as processor.
        </p>
        <p>
          If you are in the EEA/UK, you may also complain to a supervisory authority. We process owner-account data
          to perform the contract (provide the app) and, where needed, for legitimate interests such as securing the
          Service.
        </p>
      </section>

      <section className="space-y-3">
        <LegalH>9. Children</LegalH>
        <p>
          The Service is for business site owners, not for children. Do not use tidyAgent to target visitors you know
          are under 16 (or the age required in your country) with personal data collection.
        </p>
      </section>

      <section className="space-y-3">
        <LegalH>10. International transfers</LegalH>
        <p>
          Data may be processed in the country where our hosts and AI providers operate. If we transfer personal data
          out of the EEA/UK, we rely on appropriate safeguards such as standard contractual clauses where required.
        </p>
      </section>

      <section className="space-y-3">
        <LegalH>11. Changes</LegalH>
        <p>
          We may update this policy. The “Last updated” date will change. Continued use after an update means you
          accept the new policy.
        </p>
      </section>

      <section className="space-y-3">
        <LegalH>12. Related terms</LegalH>
        <p>
          Use of the Service is also governed by the{" "}
          <a className="text-amber-300 hover:underline" href="/terms">
            Terms of Use
          </a>
          .
        </p>
      </section>
    </LegalShell>
  );
}
