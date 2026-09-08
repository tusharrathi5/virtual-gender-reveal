import type { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = {
  title: "Privacy Policy — Virtual Gender Reveal",
  description: "How Virtual Gender Reveal collects, uses, and protects your information, including phone numbers used for SMS event invitations.",
};

export default function PrivacyPolicyPage() {
  return (
    <main className="min-h-screen bg-gradient-to-b from-[#FDF6FB] to-[#EFF6FE] font-jakarta">
      <div className="max-w-3xl mx-auto px-6 py-14 md:py-20">
        <Link href="/" className="text-xs font-bold text-[#3A9FE8] uppercase tracking-widest hover:underline">
          ← Back to Virtual Gender Reveal
        </Link>

        <h1 className="font-nunito font-extrabold text-3xl md:text-4xl text-gray-900 mt-4 mb-2">
          Privacy Policy
        </h1>
        <p className="text-sm text-gray-500 font-semibold mb-10">Last updated: September 8, 2026</p>

        <div className="space-y-8 text-sm md:text-[15px] leading-relaxed text-gray-700">
          <section>
            <h2 className="font-nunito font-extrabold text-lg text-[#E8449A] mb-2">1. Who We Are</h2>
            <p>
              Virtual Gender Reveal (&ldquo;Virtual Gender Reveal,&rdquo; &ldquo;VGR,&rdquo; &ldquo;VG Reveal Corp,&rdquo; &ldquo;we,&rdquo; &ldquo;us,&rdquo; or
              &ldquo;our&rdquo;) provides personalized digital gender reveal experiences, including reveal pages, videos, guest
              invitations, and related features. This Privacy Policy explains what information we collect, how we use it, and
              the choices you have — including for text message (SMS) communications.
            </p>
          </section>

          <section>
            <h2 className="font-nunito font-extrabold text-lg text-[#E8449A] mb-2">2. Information We Collect</h2>
            <p className="mb-2">When you use Virtual Gender Reveal, we may collect:</p>
            <ul className="list-disc pl-5 space-y-1">
              <li>Account information: your name, email address, and password.</li>
              <li>Event details: parent names, reveal date/time, timezone, and revealer information.</li>
              <li>
                Guest information: names, phone numbers, and email addresses that a host provides in order to invite guests
                to their event.
              </li>
              <li>Photos, videos, and other content you choose to upload for your reveal.</li>
              <li>Payment information, processed securely by our payment provider.</li>
            </ul>
          </section>

          <section>
            <h2 className="font-nunito font-extrabold text-lg text-[#E8449A] mb-2">3. How We Use Phone Numbers &amp; SMS</h2>
            <p className="mb-2">
              When a host submits a guest&apos;s phone number through our Invite Guests feature, we use that number solely to
              send SMS messages related to that host&apos;s Virtual Gender Reveal event, specifically:
            </p>
            <ul className="list-disc pl-5 space-y-1">
              <li>The guest&apos;s event invitation and access link.</li>
              <li>Event reminders as the reveal date approaches.</li>
              <li>Event updates (such as a change in date, time, or details).</li>
            </ul>
            <p className="mt-2">
              We do not use phone numbers collected through Invite Guests for advertising, marketing campaigns, or any
              purpose unrelated to the specific event the host is hosting. Message and data rates may apply. Recipients can
              reply <strong>STOP</strong> at any time to stop receiving messages, or <strong>HELP</strong> for assistance.
            </p>
          </section>

          <section>
            <h2 className="font-nunito font-extrabold text-lg text-[#E8449A] mb-2">4. We Do Not Sell Your Information</h2>
            <p>
              We do not sell, rent, or trade phone numbers, email addresses, or any other personal information to third
              parties for their own marketing purposes. Phone numbers and contact details submitted for guest invitations
              are used exclusively to operate the Virtual Gender Reveal messaging feature described above.
            </p>
          </section>

          <section>
            <h2 className="font-nunito font-extrabold text-lg text-[#E8449A] mb-2">5. How We Share Information</h2>
            <p className="mb-2">We may share information with:</p>
            <ul className="list-disc pl-5 space-y-1">
              <li>Service providers who help us operate the platform, such as our SMS delivery provider, email provider, hosting provider, and payment processor — solely to perform services on our behalf.</li>
              <li>Law enforcement or regulators when required by law.</li>
              <li>A successor entity in the event of a merger, acquisition, or sale of assets, subject to this Privacy Policy.</li>
            </ul>
          </section>

          <section>
            <h2 className="font-nunito font-extrabold text-lg text-[#E8449A] mb-2">6. Data Retention</h2>
            <p>
              We retain guest contact information for as long as reasonably necessary to deliver invitations, reminders, and
              updates for the associated event, and for a limited period afterward for support and record-keeping purposes.
              You may request deletion of your information at any time by contacting us below.
            </p>
          </section>

          <section>
            <h2 className="font-nunito font-extrabold text-lg text-[#E8449A] mb-2">7. Your Choices</h2>
            <p>
              Guests can opt out of SMS messages at any time by replying <strong>STOP</strong> to any message received. Hosts
              can manage or remove guest information from their dashboard. You may also contact us to request access,
              correction, or deletion of your personal information.
            </p>
          </section>

          <section>
            <h2 className="font-nunito font-extrabold text-lg text-[#E8449A] mb-2">8. Security</h2>
            <p>
              We use reasonable technical and organizational measures to protect the information we collect. However, no
              method of transmission or storage is completely secure, and we cannot guarantee absolute security.
            </p>
          </section>

          <section>
            <h2 className="font-nunito font-extrabold text-lg text-[#E8449A] mb-2">9. Changes to This Policy</h2>
            <p>
              We may update this Privacy Policy from time to time. Material changes will be reflected by updating the
              &ldquo;Last updated&rdquo; date above.
            </p>
          </section>

          <section>
            <h2 className="font-nunito font-extrabold text-lg text-[#E8449A] mb-2">10. Contact Us</h2>
            <p>
              Questions about this Privacy Policy or your information can be sent to:
              <br />
              <strong>Virtual Gender Reveal</strong>
              <br />
              Email:{" "}
              <a href="mailto:support@virtualgenderreveal.com" className="text-[#3A9FE8] font-bold">
                support@virtualgenderreveal.com
              </a>
              <br />
              Website: <strong>virtualgenderreveal.com</strong>
            </p>
          </section>

          <p className="pt-4">
            See also our{" "}
            <Link href="/terms" className="text-[#3A9FE8] font-bold">
              Terms of Service
            </Link>{" "}
            and our{" "}
            <Link href="/sms-consent" className="text-[#3A9FE8] font-bold">
              SMS Consent &amp; Guest Invitations
            </Link>{" "}
            information.
          </p>
        </div>
      </div>
    </main>
  );
}
