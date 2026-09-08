import type { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = {
  title: "Terms of Service — Virtual Gender Reveal",
  description: "The terms that govern your use of Virtual Gender Reveal's website, services, and guest invitation features.",
};

export default function TermsPage() {
  return (
    <main className="min-h-screen bg-gradient-to-b from-[#FDF6FB] to-[#EFF6FE] font-jakarta">
      <div className="max-w-3xl mx-auto px-6 py-14 md:py-20">
        <Link href="/" className="text-xs font-bold text-[#3A9FE8] uppercase tracking-widest hover:underline">
          ← Back to Virtual Gender Reveal
        </Link>

        <h1 className="font-nunito font-extrabold text-3xl md:text-4xl text-gray-900 mt-4 mb-2">
          Terms of Service
        </h1>
        <p className="text-sm text-gray-500 font-semibold mb-10">Last updated: September 8, 2026</p>

        <div className="space-y-6 text-sm md:text-[15px] leading-relaxed text-gray-700">
          <p>
            Welcome to Virtual Gender Reveal (&ldquo;Virtual Gender Reveal,&rdquo; &ldquo;VGR,&rdquo; &ldquo;we,&rdquo; &ldquo;us,&rdquo; or
            &ldquo;our&rdquo;). These Terms of Service govern your use of our website, services, digital reveal experiences,
            videos, invitations, and related features.
          </p>
          <p>By purchasing, accessing, or using Virtual Gender Reveal, you agree to these Terms.</p>

          {[
            {
              title: "1. Our Service",
              body: [
                "Virtual Gender Reveal provides personalized digital gender reveal experiences that may include reveal pages, videos, invitations, guest experiences, uploaded photographs, and related digital content.",
                "Some services allow a customer to designate another person, such as a physician, healthcare professional, family member, or friend (the “Revealer”), to confidentially provide the gender information used to create the reveal.",
                "Virtual Gender Reveal does not independently determine, verify, or medically confirm fetal sex or gender information.",
              ],
            },
            {
              title: "2. Accuracy of Gender Information",
              body: [
                "The customer is responsible for selecting a trusted Revealer and ensuring that the Revealer has access to accurate information.",
                "Virtual Gender Reveal relies entirely on the information submitted through the designated reveal process. We are not responsible for an incorrect reveal when incorrect information is entered by the customer, Revealer, healthcare provider, friend, family member, or any other third party.",
                "Customers and Revealers are responsible for reviewing information carefully before submitting it.",
              ],
            },
            {
              title: "3. Purchases and Payment",
              body: [
                "Prices are displayed before purchase and are charged as shown at checkout.",
                "By submitting payment, you authorize us and our payment processor to charge the selected payment method for your order.",
                "Prices, features, promotional offers, and packages may change at any time. Changes will not affect orders that have already been purchased unless otherwise stated.",
              ],
            },
            {
              title: "4. Cancellation and Refund Policy",
              body: [
                "Because Virtual Gender Reveal creates customized digital content, orders become non-refundable 24 hours after the reveal request is submitted.",
                "A cancellation or refund request submitted within the first 24 hours may be eligible for a refund provided that substantial production or customization work has not already been completed.",
                "After the 24-hour cancellation period, payments are non-refundable, including when a customer changes their mind, provides incorrect information, chooses the wrong Revealer, or no longer wishes to use the completed reveal.",
              ],
            },
            {
              title: "5. User-Provided Content",
              body: [
                "Customers may provide names, photographs, videos, invitations, ultrasound images, messages, or other materials for use in a personalized reveal.",
                "You retain ownership of your content. By submitting content to Virtual Gender Reveal, you give us a limited, temporary license to store, process, modify, and display that content only as reasonably necessary to create, deliver, maintain, or support your requested reveal experience.",
                "You represent that you have permission to provide any photographs, names, images, or other content you upload and that our use of that content for your reveal does not violate another person’s rights.",
              ],
            },
            {
              title: "6. Privacy & SMS Communications",
              body: [
                "We take the privacy of reveal information seriously. Information provided to Virtual Gender Reveal will be used only as reasonably necessary to provide the service, process payments, deliver and maintain your reveal, provide customer support, protect the security of the service, and comply with applicable legal requirements.",
                "We do not sell customers’ personal information, including phone numbers submitted for guest invitations.",
                "When a host submits a guest’s phone number, that guest may receive SMS text messages related to that event (invitation, reminders, and updates). Message and data rates may apply. Reply STOP to opt out or HELP for help.",
              ],
            },
            {
              title: "7. Confidential Reveal Information",
              body: [
                "When the Surprise Reveal feature is used, gender information submitted by the Revealer is intended to remain confidential from the customer until the reveal experience occurs.",
                "We take reasonable measures to maintain that confidentiality. However, no internet-based system can guarantee absolute security or confidentiality.",
                "Customers are responsible for keeping private reveal links, account credentials, invitations, and access links secure.",
              ],
            },
            {
              title: "8. Medical Disclaimer",
              body: [
                "Virtual Gender Reveal is an entertainment and celebration service. We do not provide medical advice, diagnostic services, ultrasound interpretation, or healthcare services.",
                "Any fetal sex or gender information used by the service originates from the customer, Revealer, or another third party. Do not rely on Virtual Gender Reveal for medical decisions.",
              ],
            },
            {
              title: "9. Uploaded Medical Information",
              body: [
                "Users should avoid submitting medical information that is not necessary to create their reveal.",
                "If an ultrasound image or similar material is uploaded, it is used solely as customer-provided content for the requested reveal and is not reviewed or interpreted for medical purposes.",
              ],
            },
            {
              title: "10. Delivery and Availability",
              body: [
                "We make reasonable efforts to provide purchased reveal experiences within the timelines communicated on our website.",
                "Delivery times may vary depending on customization requirements, customer responsiveness, technical issues, or circumstances beyond our reasonable control. A specific delivery time is not guaranteed unless we expressly agree to it in writing.",
              ],
            },
            {
              title: "11. Technical Requirements and Service Interruptions",
              body: [
                "Virtual Gender Reveal is an online service and requires compatible devices, browsers, and internet connectivity.",
                "We cannot guarantee that the service will always be uninterrupted, error-free, or compatible with every device or internet connection.",
              ],
            },
            {
              title: "12. Guest Links and Sharing",
              body: [
                "Customers may be able to share their reveal with invited guests through links, invitations, or other sharing tools.",
                "Customers are responsible for determining who receives these links, and for having appropriate permission before providing a guest’s phone number for SMS invitations.",
              ],
            },
            {
              title: "13. Acceptable Use",
              body: [
                "You may not use Virtual Gender Reveal to upload or distribute unlawful content, infringe intellectual property or privacy rights, harass others, attempt to compromise the security of the website, misuse another person’s private information, interfere with the service, or engage in fraudulent activity.",
                "We may suspend or terminate access to the service when we reasonably believe these Terms have been violated.",
              ],
            },
            {
              title: "14. Intellectual Property",
              body: [
                "The Virtual Gender Reveal website, branding, graphics, designs, animations, templates, software, video elements, and other original materials are owned by Virtual Gender Reveal or its licensors.",
                "Purchasing a reveal gives you permission to use and share your completed personalized reveal for personal, non-commercial purposes. It does not transfer ownership of our underlying templates, software, designs, or intellectual property.",
              ],
            },
            {
              title: "15. Disclaimer of Warranties",
              body: [
                "Virtual Gender Reveal is provided on an “as is” and “as available” basis to the extent permitted by law.",
              ],
            },
            {
              title: "16. Limitation of Liability",
              body: [
                "To the maximum extent permitted by applicable law, Virtual Gender Reveal will not be liable for indirect, incidental, consequential, special, or emotional damages arising from the use of the service.",
                "To the maximum extent permitted by law, our total liability relating to a particular purchase will not exceed the amount paid to Virtual Gender Reveal for that purchase.",
              ],
            },
            {
              title: "17. Indemnification",
              body: [
                "You agree to be responsible for claims resulting from content you submit, your misuse of the service, your violation of these Terms, or your infringement of another person’s rights.",
              ],
            },
            {
              title: "18. Age Requirement",
              body: [
                "You must be at least 18 years old, or the age of legal majority where you live, to purchase services from Virtual Gender Reveal.",
                "Guests under the age of 18 may view a reveal when invited by a parent, guardian, or other authorized adult.",
              ],
            },
            {
              title: "19. Changes to the Service or Terms",
              body: [
                "We may update the service or these Terms from time to time. When material changes are made, we will update the “Last Updated” date above.",
                "Continued use of the service after updated Terms become effective constitutes acceptance of the revised Terms.",
              ],
            },
            {
              title: "20. Governing Law",
              body: [
                "These Terms are governed by the laws of the State of California, without regard to conflict-of-law principles.",
                "Any dispute arising from these Terms or the service will be handled in the courts located in California, unless applicable law requires otherwise.",
              ],
            },
          ].map((sec) => (
            <section key={sec.title}>
              <h2 className="font-nunito font-extrabold text-lg text-[#E8449A] mb-2">{sec.title}</h2>
              {sec.body.map((p, i) => (
                <p key={i} className="mb-1.5">{p}</p>
              ))}
            </section>
          ))}

          <section>
            <h2 className="font-nunito font-extrabold text-lg text-[#E8449A] mb-2">21. Contact Us</h2>
            <p>
              Questions regarding these Terms may be sent to:
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
            <Link href="/privacy-policy" className="text-[#3A9FE8] font-bold">
              Privacy Policy
            </Link>
            .
          </p>
        </div>
      </div>
    </main>
  );
}
