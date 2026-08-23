import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Terms of Service | X-Talent',
  description:
    'X-Talent Terms of Service — the rules and conditions for using the X-Talent mentorship platform.',
  alternates: { canonical: '/terms' },
  openGraph: {
    title: 'Terms of Service | X-Talent',
    description:
      'X-Talent Terms of Service — the rules and conditions for using the X-Talent mentorship platform.',
    url: '/terms',
  },
};

export default function TermsOfServicePage() {
  return (
    <main className="mx-auto max-w-3xl px-6 py-16 md:px-8 md:py-20">
      <h1 className="text-navy text-3xl font-bold md:text-4xl">
        Terms of Service
      </h1>
      <p className="text-text-tertiary mt-3 text-sm">
        Last updated: May 25, 2026
      </p>

      <div className="text-text-secondary mt-8 space-y-4 text-base leading-relaxed">
        <p>
          Welcome to X-Talent. X-Talent is a mentorship platform operated by
          XChange that connects mentors and mentees and helps users schedule
          mentorship sessions.
        </p>
        <p>
          By accessing or using X-Talent, you agree to these Terms of Service.
          If you do not agree to these Terms, please do not use the platform.
        </p>

        <h2 className="text-text-primary pt-4 text-xl font-bold">
          1. Use of the Platform
        </h2>
        <p>
          X-Talent provides tools for users to create accounts, manage profiles,
          discover mentorship opportunities, communicate about mentorship
          sessions, and schedule meetings between mentors and mentees.
        </p>
        <p>
          You agree to use X-Talent only for lawful purposes and in accordance
          with these Terms.
        </p>

        <h2 className="text-text-primary pt-4 text-xl font-bold">
          2. Account Registration and Responsibility
        </h2>
        <p>
          To use certain features, you may need to create an account or sign in
          using Google OAuth.
        </p>
        <p>
          You are responsible for maintaining the accuracy of your account
          information and for all activities that occur under your account.
        </p>
        <p>You agree not to:</p>
        <ul className="list-disc space-y-1 pl-6">
          <li>Provide false, misleading, or inaccurate information.</li>
          <li>Use another person&rsquo;s account without permission.</li>
          <li>
            Attempt to access data, accounts, or systems that you are not
            authorized to access.
          </li>
          <li>
            Interfere with or disrupt the operation or security of the platform.
          </li>
        </ul>

        <h2 className="text-text-primary pt-4 text-xl font-bold">
          3. Google Sign-In and Google Calendar Integration
        </h2>
        <p>
          X-Talent may allow users to sign in with Google and, with user
          authorization, create Google Calendar events and Google Meet links for
          agreed mentorship sessions.
        </p>
        <p>
          Google integration is used only to support account authentication and
          mentorship session scheduling. Your use of Google services is also
          subject to Google&rsquo;s applicable terms and policies.
        </p>
        <p>
          More information about how X-Talent accesses, uses, stores, shares,
          and deletes Google user data is available in our{' '}
          <a href="/privacy" className="text-brand-500 underline">
            Privacy Policy
          </a>
          .
        </p>

        <h2 className="text-text-primary pt-4 text-xl font-bold">
          4. Mentorship Sessions and Scheduling
        </h2>
        <p>
          X-Talent may help mentors and mentees coordinate and schedule
          mentorship sessions.
        </p>
        <p>
          A mentorship session is scheduled only after the relevant participants
          agree to the session time or complete the required booking flow.
        </p>
        <p>
          X-Talent may create or update calendar invitations, meeting links, and
          related session information based on the scheduling actions taken by
          users.
        </p>
        <p>
          Users are responsible for attending scheduled sessions on time and for
          communicating with each other regarding changes, cancellations, or
          other session-related matters.
        </p>

        <h2 className="text-text-primary pt-4 text-xl font-bold">
          5. User Content and Conduct
        </h2>
        <p>
          Users may provide profile information, messages, booking details, or
          other content through the platform.
        </p>
        <p>
          You are responsible for the content you submit and agree not to submit
          content that:
        </p>
        <ul className="list-disc space-y-1 pl-6">
          <li>
            Is unlawful, harmful, abusive, discriminatory, defamatory, or
            misleading.
          </li>
          <li>Infringes the rights of others.</li>
          <li>Contains malware, spam, or unauthorized advertising.</li>
          <li>Violates applicable laws or regulations.</li>
        </ul>
        <p>
          X-Talent may remove content or restrict access to the platform if we
          reasonably believe a user has violated these Terms or applicable law.
        </p>

        <h2 className="text-text-primary pt-4 text-xl font-bold">
          6. Fees and Payments
        </h2>
        <p>
          Some X-Talent services may be free, while others may require payment.
        </p>
        <p>
          If paid services are introduced or used, the applicable pricing,
          payment terms, cancellation terms, and refund rules will be provided
          before purchase or booking.
        </p>
        <p>
          Unless otherwise stated, users are responsible for any taxes, fees, or
          charges associated with their use of paid services.
        </p>

        <h2 className="text-text-primary pt-4 text-xl font-bold">
          7. Cancellations and Changes
        </h2>
        <p>
          Mentorship sessions may be cancelled or rescheduled according to the
          rules displayed on the platform or agreed by the relevant mentor and
          mentee.
        </p>
        <p>
          X-Talent is not responsible for losses caused by a user&rsquo;s
          failure to attend, late arrival, cancellation, or inaccurate
          scheduling information, except where required by applicable law.
        </p>

        <h2 className="text-text-primary pt-4 text-xl font-bold">
          8. Intellectual Property
        </h2>
        <p>
          X-Talent, including its software, design, branding, logos, text,
          graphics, and platform features, is owned by XChange or its licensors
          and is protected by applicable intellectual property laws.
        </p>
        <p>
          You may not copy, modify, distribute, reverse engineer, or create
          derivative works based on X-Talent unless expressly permitted by
          XChange or applicable law.
        </p>
        <p>
          You retain ownership of content you submit to the platform, but you
          grant X-Talent a limited permission to use that content as necessary
          to operate, provide, improve, and maintain the platform.
        </p>

        <h2 className="text-text-primary pt-4 text-xl font-bold">
          9. Third-Party Services
        </h2>
        <p>
          X-Talent may integrate with third-party services, including Google
          OAuth, Google Calendar, Google Meet, cloud hosting providers, email
          services, analytics tools, or other service providers.
        </p>
        <p>
          X-Talent is not responsible for the availability, content, security,
          or practices of third-party services. Your use of third-party services
          may be subject to their own terms and policies.
        </p>

        <h2 className="text-text-primary pt-4 text-xl font-bold">
          10. Service Availability and Changes
        </h2>
        <p>
          X-Talent may modify, suspend, or discontinue parts of the platform at
          any time, including for maintenance, security, technical, business, or
          legal reasons.
        </p>
        <p>
          We will make reasonable efforts to maintain platform availability, but
          we do not guarantee that the platform will be uninterrupted,
          error-free, or available at all times.
        </p>

        <h2 className="text-text-primary pt-4 text-xl font-bold">
          11. Disclaimer
        </h2>
        <p>
          X-Talent is provided on an &ldquo;as is&rdquo; and &ldquo;as
          available&rdquo; basis.
        </p>
        <p>
          To the maximum extent permitted by law, X-Talent disclaims all
          warranties, whether express or implied, including warranties of
          merchantability, fitness for a particular purpose, non-infringement,
          and availability.
        </p>
        <p>
          X-Talent does not guarantee the quality, outcome, availability,
          conduct, or performance of any mentor, mentee, session, advice,
          opportunity, or interaction arranged through the platform.
        </p>

        <h2 className="text-text-primary pt-4 text-xl font-bold">
          12. Limitation of Liability
        </h2>
        <p>
          To the maximum extent permitted by law, X-Talent and XChange will not
          be liable for indirect, incidental, special, consequential, exemplary,
          or punitive damages, or for loss of profits, data, business,
          reputation, or opportunities arising from or related to your use of
          the platform.
        </p>
        <p>
          Nothing in these Terms excludes or limits liability where such
          exclusion or limitation is not permitted by applicable law.
        </p>

        <h2 className="text-text-primary pt-4 text-xl font-bold">
          13. Suspension and Termination
        </h2>
        <p>
          X-Talent may suspend or terminate your account or access to the
          platform if we reasonably believe that you have violated these Terms,
          created security or legal risks, misused the platform, or engaged in
          harmful conduct.
        </p>
        <p>
          You may stop using X-Talent at any time. You may also request account
          deletion according to the process described in our Privacy Policy.
        </p>

        <h2 className="text-text-primary pt-4 text-xl font-bold">
          14. Privacy
        </h2>
        <p>
          Your use of X-Talent is also governed by our Privacy Policy, which
          explains how we collect, use, store, share, and delete personal data,
          including Google user data.
        </p>
        <p>
          Privacy Policy:{' '}
          <a href="/privacy" className="text-brand-500 underline">
            https://xtalent.xchange.com.tw/privacy
          </a>
        </p>

        <h2 className="text-text-primary pt-4 text-xl font-bold">
          15. Changes to These Terms
        </h2>
        <p>
          X-Talent may update these Terms from time to time. When we make
          material changes, we may notify users through the platform, by email,
          or by updating the &ldquo;Last updated&rdquo; date above.
        </p>
        <p>
          Your continued use of the platform after the updated Terms become
          effective means you agree to the updated Terms.
        </p>

        <h2 className="text-text-primary pt-4 text-xl font-bold">
          16. Contact
        </h2>
        <p>If you have questions about these Terms, please contact us at:</p>
        <p>
          <a
            href="mailto:leo.yao@xchange.com.tw"
            className="text-brand-500 underline"
          >
            leo.yao@xchange.com.tw
          </a>
        </p>
        <p>or through the inquiry form:</p>
        <p>
          <a
            href="https://forms.gle/enXCV4fdnZk9KZv1A"
            target="_blank"
            rel="noreferrer"
            className="text-brand-500 underline"
          >
            https://forms.gle/enXCV4fdnZk9KZv1A
          </a>
        </p>
      </div>
    </main>
  );
}
