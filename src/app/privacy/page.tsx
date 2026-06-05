import type { Metadata } from "next";
import Link from "next/link";
import s from "@/app/legal.module.css";

export const metadata: Metadata = {
  title: "Privacy Policy | EasyHeals",
  description:
    "EasyHeals Privacy Policy — how we collect, use, and protect your personal health information in compliance with the Information Technology Act 2000 and DPDP Act 2023.",
  alternates: { canonical: "/privacy" },
};

const SECTIONS = [
  { id: "s1",  label: "1. Personal Information" },
  { id: "s2",  label: "2. Data We Collect" },
  { id: "s3",  label: "3. Data Sources" },
  { id: "s4",  label: "4. How We Use Data" },
  { id: "s5",  label: "5. Data Retention" },
  { id: "s6",  label: "6. Disclosure & Transfer" },
  { id: "s7",  label: "7. Data Protection" },
  { id: "s8",  label: "8. Your Rights" },
  { id: "s9",  label: "9. Third Party Websites" },
  { id: "s10", label: "10. Policy Changes" },
];

export default function PrivacyPage() {
  return (
    <main className={s.page}>
      <div className={s.hero}>
        <div className={s.heroInner}>
          <Link href="/" className={s.backLink}>← Back to Home</Link>
          <div className={s.heroLabel}>Legal</div>
          <h1 className={s.heroTitle}>Privacy Policy</h1>
          <div className={s.heroMeta}>
            <span>📅 Effective: January 2024</span>
            <span>🏢 EasyHeals Technologies Pvt. Ltd.</span>
            <span>🛡️ DPDP Act 2023 Compliant</span>
          </div>
        </div>
      </div>

      <div className={s.body}>
        <aside className={s.toc}>
          <div className={s.tocHeading}>Contents</div>
          <ul className={s.tocList}>
            {SECTIONS.map((sec) => (
              <li key={sec.id}><a href={`#${sec.id}`}>{sec.label}</a></li>
            ))}
          </ul>
        </aside>

        <div className={s.content}>
          <p>
            This Privacy Policy governs how EasyHeals Technologies Private Limited
            (&ldquo;ETPL&rdquo;, &ldquo;EasyHeals&rdquo;, &ldquo;We&rdquo;, &ldquo;Us&rdquo;) collects, uses, shares and processes your
            information through the EasyHeals app and website in the course of availing our Services.
          </p>
          <p>
            ETPL respects your privacy and seeks to comply with the Information Technology Act,
            2000 and the Digital Personal Data Protection Act, 2023. Please read this Privacy
            Policy carefully. By using our Website or App, you agree to be bound by these terms.
          </p>

          <h2 id="s1">1. What is Personal Information?</h2>
          <p>
            Personal information is information which can be used to directly or indirectly identify
            you. &ldquo;Sensitive Personal Data or Information&rdquo; includes passwords, financial
            information, physical or mental health conditions, sexual orientation, medical records,
            and biometric information.
          </p>
          <p>
            By signing up or using our Services you confirm that you voluntarily provide us with
            personal information and consent to its collection, use and disclosure in accordance
            with this Privacy Policy.
          </p>

          <h2 id="s2">2. What types of data do we collect?</h2>
          <p>
            The Website and App use cookies for storing preferences, profiling and tracking
            behaviour. By visiting the App or Website, you authorise the placement of cookies.
          </p>
          <p>When you register or use our Services, we collect:</p>
          <ol>
            <li>Contact information: Name, Address, Email ID, Phone Number;</li>
            <li>Geo-location to provide nearest Health Service Providers;</li>
            <li>Usage data such as search history and appointment history;</li>
            <li>Financial information such as bank account or payment instrument details;</li>
            <li>Browsing history including IP address, operating system and browser type;</li>
            <li>Any additional information you provide during interactions with us;</li>
            <li>Health information such as medical records and history you voluntarily provide;</li>
            <li>Insurance coverage information you voluntarily provide;</li>
            <li>Physical, physiological and mental health condition information including inpatient, outpatient, laboratory, radiology and pharmacy data;</li>
            <li>Any other information collected in the course of availing Services.</li>
          </ol>

          <h2 id="s3">3. Where do we collect your data from?</h2>
          <h3>For end users:</h3>
          <ol>
            <li>Information you voluntarily provide through the App, Website, email or other communication channels;</li>
            <li>Information from healthcare service providers (HSPs) to whom you have permitted sharing of your personal information;</li>
            <li>Data you have provided to any group company or affiliate to whom you have given consent for sharing.</li>
          </ol>
          <h3>For Healthcare Service Providers (HSPs):</h3>
          <ol>
            <li>Qualifications, experience and public profile information before onboarding;</li>
            <li>Usage information collected during your use of the App or Website;</li>
            <li>Information you voluntarily provide through any communication channel.</li>
          </ol>

          <h2 id="s4">4. How do we use your data?</h2>
          <h3>General uses:</h3>
          <ol>
            <li>Registration, identification, communication and fulfilment of Terms and Conditions;</li>
            <li>Offering personalised Services and targeted healthcare plan recommendations;</li>
            <li>Addressing requests, queries and complaints and assisting with transactions;</li>
            <li>Developing machine learning algorithms to improve diagnostics and treatment protocols;</li>
            <li>Contacting you about new Services, features, products and special promotions;</li>
            <li>Research and analysis for product and service development;</li>
            <li>Disclosure as required by government authorities under applicable law;</li>
            <li>Investigating, enforcing and resolving disputes or grievances.</li>
          </ol>
          <h3>For end users only:</h3>
          <ol>
            <li>Creation and maintenance of health records in our Personal Health Record (PHR) database;</li>
            <li>Creating your unified profile with analytics and insights;</li>
            <li>Sharing with your chosen HSP to provide you with Services.</li>
          </ol>

          <h2 id="s5">5. How long will we retain your data?</h2>
          <p>
            We store your personal information as long as necessary to provide Services or as
            required under law. De-identified data may be kept for research and statistical purposes
            for a longer period.
          </p>
          <p>
            If you close your account, we may delete any or all of your data without liability.
            We may retain data to prevent fraud, for legal compliance, or other legitimate purposes.
          </p>

          <h2 id="s6">6. Disclosure and transfer of your data</h2>
          <p>
            We may share, disclose and transfer your personal information to entities required to
            provide Services, improve our Services, or provide value added services, to the extent
            permitted by applicable law. These entities may be located outside India.
          </p>
          <h3>Service Providers:</h3>
          <p>
            Companies that provide Services on our behalf, such as website hosting, data storage,
            email services, marketing, payment processing and customer services. Such entities are
            obligated to protect your data.
          </p>
          <h3>Business Affiliates:</h3>
          <p>
            EasyHeals group companies, affiliates and subsidiaries involved in the provision of
            products and services. In the event of a merger or acquisition, personal information
            may be transferred to the relevant third party.
          </p>
          <h3>Law Enforcement Agencies:</h3>
          <p>
            We may share information with law enforcement agencies pursuant to lawful requests and
            as required under applicable law.
          </p>

          <h2 id="s7">7. How do we protect your data?</h2>
          <p>
            We use reasonable technical, administrative, and physical security measures to safeguard
            all data you share with us. We have comprehensive internal policies to prevent
            unauthorised access. Third parties we share data with are contractually required to
            adopt reasonable security practices.
          </p>
          <p>
            We are not responsible for data loss due to unauthorised access to your electronic
            devices. For any third party action or action on your part leading to loss or harm,
            the Company shall not be held liable.
          </p>

          <h2 id="s8">8. What are your rights?</h2>
          <p>You have the following rights with regard to your personal information:</p>
          <ol>
            <li>Right to access your personal information and request updates or corrections;</li>
            <li>Right to correct inaccuracies by contacting us at <a href="mailto:sales@easyheals.com">sales@easyheals.com</a>;</li>
            <li>Right to withdraw consent for us to use data you have previously provided;</li>
            <li>Right to erasure — request account deletion through our <Link href="/consent">Consent Settings</Link>.</li>
          </ol>
          <p>
            In the event you withdraw consent, we reserve the right to restrict Services for
            which that information is necessary.
          </p>

          <h2 id="s9">9. Third Party Websites and Services</h2>
          <p>
            Our Website and App may contain links to third party services. You proceed to use such
            websites at your own risk. EasyHeals will not be held liable for any outcome or harm
            arising from your use of third party websites. Please read the privacy policies of any
            third party before proceeding.
          </p>

          <h2 id="s10">10. Changes to this Privacy Policy</h2>
          <p>
            Any changes to our Privacy Policy will be posted on the Website and App and will become
            effective as of the date of posting. Please review the Privacy Policy periodically. If
            you do not agree with any revised terms, please refrain from using our Services.
          </p>

          <div className={s.contactCard}>
            <p>Questions about your privacy or data? We&rsquo;re here to help.</p>
            <a href="mailto:sales@easyheals.com">Contact Us →</a>
          </div>
        </div>
      </div>
    </main>
  );
}
