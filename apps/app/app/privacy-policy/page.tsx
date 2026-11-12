import type { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = {
  title: "Privacy Policy | StickySites CRM",
  description:
    "Privacy policy for the StickySites CRM platform, including Google Ads API usage.",
};

export default function PrivacyPolicyPage() {
  return (
    <main className="min-h-screen bg-background text-foreground">
      <div className="mx-auto max-w-3xl px-6 py-12">
        <p className="mb-8 text-sm text-muted-foreground">
          <Link href="/" className="hover:text-foreground underline-offset-4 hover:underline">
            ← Back to home
          </Link>
        </p>

        <h1 className="text-3xl font-bold tracking-tight">Privacy Policy</h1>
        <p className="mt-2 text-sm text-muted-foreground">Last updated: 24 May 2026</p>

        <div className="mt-10 space-y-8 text-sm leading-relaxed text-foreground/90">
          <section>
            <h2 className="text-lg font-semibold text-foreground">1. Introduction</h2>
            <p className="mt-3">
              This Privacy Policy describes how Stky (&quot;we&quot;, &quot;us&quot;, or
              &quot;our&quot;) collects, uses, and protects information when you use the
              StickySites CRM platform (the &quot;Service&quot;). The Service is operated for
              internal StickySites use and for authorised staff and client portal users.
            </p>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-foreground">2. Who this applies to</h2>
            <p className="mt-3">This policy applies to:</p>
            <ul className="mt-3 list-disc space-y-2 pl-6">
              <li>Agency staff who sign in to the staff dashboard</li>
              <li>Client portal users who access their account via magic-link sign-in</li>
              <li>Visitors to public pages of this application</li>
            </ul>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-foreground">3. Information we collect</h2>
            <p className="mt-3">Depending on how you use the Service, we may process:</p>
            <ul className="mt-3 list-disc space-y-2 pl-6">
              <li>
                <strong>Account information</strong> — name, email address, and authentication
                data for staff and portal users
              </li>
              <li>
                <strong>CRM and business data</strong> — client records, leads, pipeline
                information, tasks, notes, and related metadata entered by authorised users
              </li>
              <li>
                <strong>Integration data</strong> — identifiers and configuration for connected
                services (for example Google Ads customer IDs, analytics property IDs, and API
                connection settings)
              </li>
              <li>
                <strong>Google Ads data</strong> — when Google Ads is connected, we access Google
                Ads account information and reporting data via the Google Ads API on behalf of
                authorised agency users. This may include account names, campaign performance
                metrics, keywords, and related advertising data
              </li>
              <li>
                <strong>Technical data</strong> — server logs, IP addresses, request timestamps,
                and error diagnostics used for security and reliability
              </li>
            </ul>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-foreground">4. How we use information</h2>
            <p className="mt-3">We use collected information to:</p>
            <ul className="mt-3 list-disc space-y-2 pl-6">
              <li>Provide, operate, and maintain the CRM and client portal</li>
              <li>Authenticate users and enforce access controls</li>
              <li>Display Google Ads performance and related reporting inside the dashboard</li>
              <li>Support agency workflows such as lead management, client records, and automations</li>
              <li>Monitor security, prevent abuse, and troubleshoot errors</li>
              <li>Comply with legal obligations</li>
            </ul>
            <p className="mt-3">
              We do not sell personal information. We do not use Google user data for advertising,
              retargeting, or building user profiles unrelated to providing the Service.
            </p>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-foreground">
              5. Google API Services and Limited Use
            </h2>
            <p className="mt-3">
              The Service&apos;s use of information received from Google APIs adheres to the{" "}
              <a
                href="https://developers.google.com/terms/api-services-user-data-policy"
                className="text-primary underline-offset-4 hover:underline"
                rel="noopener noreferrer"
                target="_blank"
              >
                Google API Services User Data Policy
              </a>
              , including the Limited Use requirements.
            </p>
            <p className="mt-3">In particular, Google user data accessed via the Service is:</p>
            <ul className="mt-3 list-disc space-y-2 pl-6">
              <li>Used only to provide agency CRM and reporting features you request</li>
              <li>
                Not transferred to third parties except as needed to operate the Service (for
                example hosting or infrastructure providers), or as required by law
              </li>
              <li>Not used for serving ads</li>
              <li>
                Not used to train generalised AI or machine-learning models unrelated to the
                Service
              </li>
            </ul>
            <p className="mt-3">
              Human access to Google user data is limited to authorised agency personnel who need
              it to support client accounts and platform operations.
            </p>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-foreground">6. Sharing of information</h2>
            <p className="mt-3">We may share information with:</p>
            <ul className="mt-3 list-disc space-y-2 pl-6">
              <li>
                <strong>Infrastructure providers</strong> — such as hosting, database, and email
                delivery services that process data on our behalf under contractual safeguards
              </li>
              <li>
                <strong>Google</strong> — when you connect Google Ads or other Google services,
                data is exchanged according to Google&apos;s terms and your authorisation
              </li>
              <li>
                <strong>Legal and safety</strong> — when required by law or to protect rights,
                security, and integrity of the Service
              </li>
            </ul>
            <p className="mt-3">
              We do not share Google user data with third parties for their own marketing
              purposes.
            </p>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-foreground">7. Data retention</h2>
            <p className="mt-3">
              We retain information for as long as needed to provide the Service, meet contractual
              obligations with clients, resolve disputes, and comply with legal requirements.
              Retention periods may vary by data type and business need. When data is no longer
              required, we delete or anonymise it where practicable.
            </p>
            <p className="mt-3">
              Support requests: when you raise a request with us (through a website form, the client
              portal or email) we keep your name, email address and the details you give us so we can
              reply and fix the problem. We keep request summaries and outcomes for as long as we
              work with you, and you can ask us to delete your requests at any time.
            </p>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-foreground">8. Security</h2>
            <p className="mt-3">
              We use reasonable technical and organisational measures to protect information,
              including access controls, encrypted transport (HTTPS), and hashed storage for
              sensitive credentials such as API keys. No method of transmission or storage is
              completely secure; we cannot guarantee absolute security.
            </p>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-foreground">9. Your rights</h2>
            <p className="mt-3">
              Depending on your location, you may have rights to access, correct, delete, or
              restrict processing of your personal information, or to object to certain processing.
              Portal users and client contacts should contact their agency account manager. Staff
              users may contact the platform administrator.
            </p>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-foreground">10. Changes to this policy</h2>
            <p className="mt-3">
              We may update this Privacy Policy from time to time. The &quot;Last updated&quot;
              date at the top of this page will reflect the most recent revision. Continued use of
              the Service after changes become effective constitutes acceptance of the updated
              policy where permitted by law.
            </p>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-foreground">11. Contact</h2>
            <p className="mt-3">
              For privacy-related questions about this Service, contact the platform administrator
              at{" "}
              <a
                href="mailto:rhyse@stkysites.com"
                className="text-primary underline-offset-4 hover:underline"
              >
                rhyse@stkysites.com
              </a>
              .
            </p>
          </section>
        </div>
      </div>
    </main>
  );
}
