import { Metadata } from "next"
import Link from "next/link"
import { DonutLogo } from "@/components/DonutLogo"

export const metadata: Metadata = {
  title: "Privacy Policy",
  description: "Privacy Policy for FantasyPhish",
  alternates: {
    canonical: "/privacy",
  },
}

export default function PrivacyPage() {
  return (
    <div className="min-h-screen bg-[#2d4654]">
      {/* Header */}
      <header className="border-b border-[#3d5a6c]/50 bg-[#1e3340]">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
          <Link
            href="/"
            className="inline-flex items-center space-x-2 hover:opacity-80 transition-opacity"
          >
            <DonutLogo size="md" />
            <span className="text-xl font-bold text-white">FantasyPhish</span>
          </Link>
        </div>
      </header>

      {/* Content */}
      <main className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
        <h1 className="text-4xl font-bold text-white mb-8">Privacy Policy</h1>

        <div className="prose prose-invert prose-slate max-w-none">
          <p className="text-gray-300 mb-8">
            <strong>Last Updated:</strong> December 31, 2024
          </p>

          <section className="mb-8">
            <h2 className="text-2xl font-semibold text-white mb-4">
              Introduction
            </h2>
            <p className="text-gray-300 mb-4">
              FantasyPhish (&quot;we,&quot; &quot;our,&quot; or &quot;us&quot;)
              is committed to protecting your privacy. This Privacy Policy
              explains how we collect, use, disclose, and safeguard your
              information when you use our website and mobile application
              (collectively, the &quot;Service&quot;).
            </p>
          </section>

          <section className="mb-8">
            <h2 className="text-2xl font-semibold text-white mb-4">
              Information We Collect
            </h2>

            <h3 className="text-xl font-semibold text-white mb-3 mt-6">
              Information You Provide
            </h3>
            <p className="text-gray-300 mb-4">
              When you register for an account, we collect:
            </p>
            <ul className="list-disc list-inside text-gray-300 mb-4 space-y-2">
              <li>Email address</li>
              <li>Username (display name)</li>
              <li>Password (encrypted)</li>
            </ul>

            <h3 className="text-xl font-semibold text-white mb-3 mt-6">
              Information We Automatically Collect
            </h3>
            <p className="text-gray-300 mb-4">
              When you use our Service, we may automatically collect:
            </p>
            <ul className="list-disc list-inside text-gray-300 mb-4 space-y-2">
              <li>
                Device information (device type, operating system, browser type)
              </li>
              <li>IP address and general location (city/region level)</li>
              <li>Usage data (pages visited, features used, time spent)</li>
              <li>Session information and cookies</li>
            </ul>

            <h3 className="text-xl font-semibold text-white mb-3 mt-6">
              Game Data
            </h3>
            <p className="text-gray-300 mb-4">We collect and store:</p>
            <ul className="list-disc list-inside text-gray-300 mb-4 space-y-2">
              <li>Your song picks for each show</li>
              <li>Your scores and points</li>
              <li>Your achievements and badges</li>
              <li>Leaderboard rankings</li>
            </ul>
          </section>

          <section className="mb-8">
            <h2 className="text-2xl font-semibold text-white mb-4">
              How We Use Your Information
            </h2>
            <p className="text-gray-300 mb-4">
              We use the information we collect to:
            </p>
            <ul className="list-disc list-inside text-gray-300 mb-4 space-y-2">
              <li>Create and manage your account</li>
              <li>Provide the fantasy game functionality</li>
              <li>Calculate scores and maintain leaderboards</li>
              <li>Send you account-related notifications</li>
              <li>
                Send you show reminders and pick deadline notifications (if you
                opt in)
              </li>
              <li>Improve and optimize our Service</li>
              <li>Prevent fraud and ensure security</li>
              <li>Comply with legal obligations</li>
            </ul>
          </section>

          <section className="mb-8">
            <h2 className="text-2xl font-semibold text-white mb-4">
              Information Sharing
            </h2>
            <p className="text-gray-300 mb-4">
              We do not sell your personal information. We may share your
              information only in the following circumstances:
            </p>
            <ul className="list-disc list-inside text-gray-300 mb-4 space-y-2">
              <li>
                <strong>Public Information:</strong> Your username, scores, and
                leaderboard rankings are visible to other users
              </li>
              <li>
                <strong>Service Providers:</strong> We use third-party services
                for hosting (Vercel), database (Neon), analytics (Vercel
                Analytics), and email (Resend)
              </li>
              <li>
                <strong>Legal Requirements:</strong> If required by law or to
                protect our rights
              </li>
              <li>
                <strong>Business Transfers:</strong> In connection with a
                merger, sale, or acquisition
              </li>
            </ul>
          </section>

          <section className="mb-8">
            <h2 className="text-2xl font-semibold text-white mb-4">
              Third-Party Services
            </h2>
            <p className="text-gray-300 mb-4">
              Our Service integrates with the following third-party services:
            </p>
            <ul className="list-disc list-inside text-gray-300 mb-4 space-y-2">
              <li>
                <strong>Phish.net API:</strong> We retrieve setlist data from
                Phish.net to score your picks
              </li>
              <li>
                <strong>Vercel:</strong> Hosts our website and collects
                analytics
              </li>
              <li>
                <strong>Neon:</strong> Stores our database
              </li>
              <li>
                <strong>Resend:</strong> Sends transactional emails
              </li>
            </ul>
            <p className="text-gray-300 mb-4">
              These services have their own privacy policies and we encourage
              you to review them.
            </p>
          </section>

          <section className="mb-8">
            <h2 className="text-2xl font-semibold text-white mb-4">
              Mobile App Permissions
            </h2>
            <p className="text-gray-300 mb-4">
              Our mobile app may request the following permissions:
            </p>
            <ul className="list-disc list-inside text-gray-300 mb-4 space-y-2">
              <li>
                <strong>Biometric Authentication:</strong> To enable Face ID,
                Touch ID, or fingerprint login (optional)
              </li>
              <li>
                <strong>Push Notifications:</strong> To send you show reminders
                and updates (optional)
              </li>
            </ul>
            <p className="text-gray-300 mb-4">
              You can manage these permissions in your device settings at any
              time.
            </p>
          </section>

          <section className="mb-8">
            <h2 className="text-2xl font-semibold text-white mb-4">Cookies</h2>
            <p className="text-gray-300 mb-4">
              We use cookies and similar technologies to:
            </p>
            <ul className="list-disc list-inside text-gray-300 mb-4 space-y-2">
              <li>Keep you logged in</li>
              <li>Remember your preferences</li>
              <li>Analyze how you use our Service</li>
            </ul>
            <p className="text-gray-300 mb-4">
              You can control cookies through your browser settings.
            </p>
          </section>

          <section className="mb-8">
            <h2 className="text-2xl font-semibold text-white mb-4">
              Data Security
            </h2>
            <p className="text-gray-300 mb-4">
              We implement reasonable security measures to protect your
              information, including:
            </p>
            <ul className="list-disc list-inside text-gray-300 mb-4 space-y-2">
              <li>Encrypted passwords using bcrypt</li>
              <li>HTTPS encryption for data transmission</li>
              <li>Secure database storage</li>
              <li>Regular security updates</li>
            </ul>
            <p className="text-gray-300 mb-4">
              However, no method of transmission over the internet is 100%
              secure. We cannot guarantee absolute security.
            </p>
          </section>

          <section className="mb-8">
            <h2 className="text-2xl font-semibold text-white mb-4">
              Your Rights
            </h2>
            <p className="text-gray-300 mb-4">
              Depending on your location, you may have the following rights:
            </p>
            <ul className="list-disc list-inside text-gray-300 mb-4 space-y-2">
              <li>
                <strong>Access:</strong> Request a copy of your personal data
              </li>
              <li>
                <strong>Correction:</strong> Update your account information
              </li>
              <li>
                <strong>Deletion:</strong> Request deletion of your account and
                data
              </li>
              <li>
                <strong>Objection:</strong> Object to certain processing
                activities
              </li>
              <li>
                <strong>Portability:</strong> Request your data in a portable
                format
              </li>
            </ul>
            <p className="text-gray-300 mb-4">
              To exercise these rights, contact us at{" "}
              <a
                href="mailto:privacy@fantasyphish.com"
                className="text-[#c23a3a] hover:text-[#d64545]"
              >
                privacy@fantasyphish.com
              </a>
            </p>
          </section>

          <section className="mb-8">
            <h2 className="text-2xl font-semibold text-white mb-4">
              Children&apos;s Privacy
            </h2>
            <p className="text-gray-300 mb-4">
              Our Service is not intended for children under 13 years of age. We
              do not knowingly collect personal information from children under
              13. If you believe we have collected information from a child
              under 13, please contact us immediately.
            </p>
          </section>

          <section className="mb-8">
            <h2 className="text-2xl font-semibold text-white mb-4">
              Data Retention
            </h2>
            <p className="text-gray-300 mb-4">
              We retain your information for as long as your account is active
              or as needed to provide our Service. You may request deletion of
              your account at any time. We may retain certain information as
              required by law or for legitimate business purposes.
            </p>
          </section>

          <section className="mb-8">
            <h2 className="text-2xl font-semibold text-white mb-4">
              International Users
            </h2>
            <p className="text-gray-300 mb-4">
              Our Service is hosted in the United States. If you access our
              Service from outside the United States, your information may be
              transferred to, stored, and processed in the United States.
            </p>
          </section>

          <section className="mb-8">
            <h2 className="text-2xl font-semibold text-white mb-4">
              Changes to This Policy
            </h2>
            <p className="text-gray-300 mb-4">
              We may update this Privacy Policy from time to time. We will
              notify you of any changes by posting the new Privacy Policy on
              this page and updating the &quot;Last Updated&quot; date.
            </p>
          </section>

          <section className="mb-8">
            <h2 className="text-2xl font-semibold text-white mb-4">
              Contact Us
            </h2>
            <p className="text-gray-300 mb-4">
              If you have questions about this Privacy Policy, please contact
              us:
            </p>
            <ul className="list-none text-gray-300 mb-4 space-y-2">
              <li>
                Email:{" "}
                <a
                  href="mailto:privacy@fantasyphish.com"
                  className="text-[#c23a3a] hover:text-[#d64545]"
                >
                  privacy@fantasyphish.com
                </a>
              </li>
              <li>
                Support:{" "}
                <a
                  href="mailto:chalupa@fantasyphish.com"
                  className="text-[#c23a3a] hover:text-[#d64545]"
                >
                  chalupa@fantasyphish.com
                </a>
              </li>
            </ul>
          </section>
        </div>

        {/* Back to home link */}
        <div className="mt-12 pt-8 border-t border-[#3d5a6c]/50">
          <Link
            href="/"
            className="text-[#c23a3a] hover:text-[#d64545] font-medium"
          >
            ← Back to Home
          </Link>
        </div>
      </main>

      {/* Footer */}
      <footer className="border-t border-[#3d5a6c]/50 py-8 bg-[#1e3340] mt-12">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">
          <p className="text-center text-sm text-gray-400">
            © {new Date().getFullYear()} FantasyPhish. All rights reserved.
          </p>
        </div>
      </footer>
    </div>
  )
}
