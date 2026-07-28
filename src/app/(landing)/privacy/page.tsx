import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Privacy Policy | X-Talent',
  description:
    'X-Talent Privacy Policy — how X-Talent collects, uses, stores, shares, and deletes personal data, including Google user data.',
  alternates: { canonical: '/privacy' },
  openGraph: {
    title: 'Privacy Policy | X-Talent',
    description:
      'X-Talent Privacy Policy — how X-Talent collects, uses, stores, shares, and deletes personal data, including Google user data.',
    url: '/privacy',
  },
};

export default function PrivacyPolicyPage() {
  return (
    <main className="mx-auto max-w-3xl px-6 py-16 md:px-8 md:py-20">
      <h1 className="text-3xl font-bold text-navy md:text-4xl">
        Privacy Policy
      </h1>
      <p className="mt-3 text-sm text-text-tertiary">
        Last updated: May 25, 2026
      </p>

      <div className="mt-8 space-y-4 text-base leading-relaxed text-text-secondary">
        <p>
          X-Talent is a mentorship platform operated by XChange. X-Talent
          connects mentors and mentees and helps users schedule mentorship
          sessions.
        </p>
        <p>
          This Privacy Policy explains how X-Talent collects, uses, stores,
          shares, and deletes personal data, including Google user data accessed
          through Google OAuth and Google Calendar integration.
        </p>

        <h2 className="pt-4 text-xl font-bold text-text-primary">
          1. Information We Collect
        </h2>
        <p>We may collect the following information when you use X-Talent:</p>
        <ul className="list-disc space-y-1 pl-6">
          <li>Name</li>
          <li>Email address</li>
          <li>Phone number, if provided</li>
          <li>
            Company, job title, or professional profile information, if provided
          </li>
          <li>Account login information</li>
          <li>Service usage records</li>
          <li>Mentorship booking and appointment records</li>
          <li>Device and browser information</li>
          <li>
            Other information you voluntarily provide through the platform
          </li>
        </ul>

        <h2 className="pt-4 text-xl font-bold text-text-primary">
          2. Google User Data We Access
        </h2>
        <p>
          When you choose to sign in with Google, X-Talent may access your basic
          Google account information, including:
        </p>
        <ul className="list-disc space-y-1 pl-6">
          <li>Name</li>
          <li>Email address</li>
          <li>Google account ID</li>
          <li>Profile picture</li>
        </ul>
        <p>
          When you choose to use Google Calendar integration for mentorship
          scheduling, X-Talent may access Google Calendar data necessary to
          create, update, or cancel mentorship session events, including:
        </p>
        <ul className="list-disc space-y-1 pl-6">
          <li>Event title</li>
          <li>Event start and end time</li>
          <li>Participant email addresses</li>
          <li>Event description</li>
          <li>Google Meet link</li>
          <li>Calendar event ID</li>
        </ul>
        <p>
          X-Talent accesses Google user data only after you grant permission
          through Google OAuth.
        </p>
        <p>
          X-Talent does not read, analyze, or use your existing Google Calendar
          events for unrelated purposes.
        </p>

        <h2 className="pt-4 text-xl font-bold text-text-primary">
          3. How We Use Google User Data
        </h2>
        <p>X-Talent uses Google user data only for the following purposes:</p>
        <ul className="list-disc space-y-1 pl-6">
          <li>To authenticate users and create or manage X-Talent accounts</li>
          <li>To identify the signed-in user by their Google account email</li>
          <li>
            To schedule mentorship sessions after both the mentor and mentee
            agree on a time
          </li>
          <li>
            To create, update, or cancel Google Calendar events related to
            mentorship sessions
          </li>
          <li>
            To generate or attach a Google Meet link to the scheduled mentorship
            session
          </li>
          <li>To send calendar invitations to the mentor and mentee</li>
          <li>To maintain the security and reliability of the platform</li>
        </ul>
        <p>
          X-Talent does not use Google user data for advertising, retargeting,
          data brokerage, or unrelated marketing purposes.
        </p>
        <p>
          X-Talent does not use Google user data to train, fine-tune, or improve
          generalized AI or machine learning models.
        </p>

        <h2 className="pt-4 text-xl font-bold text-text-primary">
          4. How We Share Google User Data
        </h2>
        <p>X-Talent does not sell, rent, or trade Google user data.</p>
        <p>
          Google user data may be shared only in the following limited
          situations:
        </p>
        <ul className="list-disc space-y-1 pl-6">
          <li>
            With the mentor and mentee participating in the same mentorship
            session, so they can receive the calendar invitation, meeting time,
            participant information, and Google Meet link.
          </li>
          <li>
            With service providers that support the operation of X-Talent, such
            as cloud hosting, data storage, email delivery, system maintenance,
            and security services.
          </li>
          <li>
            When required by law, regulation, legal process, or governmental
            request.
          </li>
          <li>
            When necessary to protect the security, rights, or safety of
            X-Talent, our users, or the public.
          </li>
        </ul>
        <p>
          Service providers are only allowed to process data as necessary to
          provide services to X-Talent and must apply reasonable security
          measures.
        </p>

        <h2 className="pt-4 text-xl font-bold text-text-primary">
          5. Data Storage and Protection
        </h2>
        <p>
          X-Talent uses reasonable technical and organizational measures to
          protect user data, including:
        </p>
        <ul className="list-disc space-y-1 pl-6">
          <li>Encrypted data transmission</li>
          <li>Access control</li>
          <li>Permission management</li>
          <li>Logging and monitoring</li>
          <li>Data minimization</li>
          <li>Secure storage practices</li>
        </ul>
        <p>
          Google OAuth tokens, if stored, are stored securely and used only for
          the authorized features selected by the user.
        </p>
        <p>
          X-Talent personnel do not access Google Calendar data unless necessary
          to provide the service, respond to a user request, troubleshoot
          technical or security issues, comply with legal obligations, or with
          the user&rsquo;s explicit consent.
        </p>

        <h2 className="pt-4 text-xl font-bold text-text-primary">
          6. Data Retention and Deletion
        </h2>
        <p>
          X-Talent retains personal data and Google user data only for as long
          as necessary to provide the platform services, maintain user accounts,
          comply with legal obligations, resolve disputes, or protect legitimate
          business interests.
        </p>
        <p>
          Users may disconnect Google access at any time through their X-Talent
          account settings, if available, or through the Google Account
          third-party app access page.
        </p>
        <p>
          Users may request deletion of their account or related Google user
          data by contacting us at:
        </p>
        <ul className="list-disc space-y-1 pl-6">
          <li>
            <a
              href="mailto:leo.yao@xchange.com.tw"
              className="text-brand-500 underline"
            >
              leo.yao@xchange.com.tw
            </a>
          </li>
        </ul>
        <p>or through the inquiry form:</p>
        <ul className="list-disc space-y-1 pl-6">
          <li>
            <a
              href="https://forms.gle/enXCV4fdnZk9KZv1A"
              target="_blank"
              rel="noreferrer"
              className="text-brand-500 underline"
            >
              https://forms.gle/enXCV4fdnZk9KZv1A
            </a>
          </li>
        </ul>
        <p>
          After verifying the request, X-Talent will delete or anonymize the
          relevant data within a reasonable period, unless retention is required
          for legal, security, audit, or dispute-resolution purposes.
        </p>

        <h2 className="pt-4 text-xl font-bold text-text-primary">
          7. Contact Us
        </h2>
        <p>
          If you have questions about this Privacy Policy or wish to exercise
          your data rights, please contact us at:
        </p>
        <p>
          <a
            href="mailto:leo.yao@xchange.com.tw"
            className="text-brand-500 underline"
          >
            leo.yao@xchange.com.tw
          </a>
        </p>
      </div>
    </main>
  );
}
