import type { Metadata } from "next";
import Link from "next/link";
import s from "@/app/legal.module.css";

export const metadata: Metadata = {
  title: "Terms and Conditions | EasyHeals",
  description:
    "EasyHeals Terms and Conditions — your rights and obligations when using India's AI-powered healthcare discovery platform. Governed by Indian law, jurisdiction at Pune.",
  alternates: { canonical: "/terms-and-conditions" },
};

const SECTIONS = [
  { id: "s1",  label: "1. General" },
  { id: "s2",  label: "2. Eligibility" },
  { id: "s3",  label: "3. Our Services" },
  { id: "s4",  label: "4. Use of Platform" },
  { id: "s5",  label: "5. Prohibited Content" },
  { id: "s6",  label: "6. Indemnity" },
  { id: "s7",  label: "7. Limitation of Liability" },
  { id: "s8",  label: "8. Data & Information" },
  { id: "s9",  label: "9. Intellectual Property" },
  { id: "s10", label: "10. Other Conditions" },
  { id: "s11", label: "11. Third Party Links" },
  { id: "s12", label: "12. Amendments" },
  { id: "s13", label: "13. Force Majeure" },
  { id: "s14", label: "14. Termination" },
  { id: "s15", label: "15. Jurisdiction" },
  { id: "s16", label: "16. Contact Us" },
];

export default function TermsPage() {
  return (
    <main className={s.page}>
      <div className={s.hero}>
        <div className={s.heroInner}>
          <Link href="/" className={s.backLink}>← Back to Home</Link>
          <div className={s.heroLabel}>Legal</div>
          <h1 className={s.heroTitle}>Terms and Conditions</h1>
          <div className={s.heroMeta}>
            <span>📅 Effective: January 2024</span>
            <span>🏢 EasyHeals Technologies Pvt. Ltd.</span>
            <span>⚖️ Jurisdiction: Pune, India</span>
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
            Please read all of our Terms and Conditions carefully before using the EasyHeals platform.
          </p>

          <h2 id="s1">1. General</h2>
          <p>
            We, at EasyHeals Technologies Private Limited (&ldquo;ETPL&rdquo;, &ldquo;EasyHeals&rdquo;, &ldquo;We&rdquo;,
            &ldquo;Us&rdquo;) provide services to all individuals accessing or using our EasyHeals platform
            (&ldquo;Platform&rdquo;) subject to these Terms and Conditions (&ldquo;Agreement&rdquo;), with the Privacy
            Policy available at <Link href="/privacy">/privacy</Link>.
          </p>
          <p>
            The Platform is owned and operated by EasyHeals, incorporated under the provisions of
            the Companies Act, 1956. EasyHeals may assign, transfer, and subcontract its rights
            and/or obligations under these Terms to any third party as it may deem fit.
          </p>
          <p>
            EasyHeals has onboarded various Healthcare Service Providers (&ldquo;HSP&rdquo;) such as Hospitals,
            Clinics, Pathology and Radiology Labs, Wellness Centers, and Ambulance services to
            allow them to display and market their services on EasyHeals.
          </p>
          <p>
            Any accessing or browsing of the Platform indicates your agreement to all the terms in
            this Agreement. If you disagree with any part, you may discontinue access or use.
          </p>

          <h2 id="s2">2. Eligibility</h2>
          <p>When you use the Platform, you represent that you meet the following criteria:</p>
          <ol>
            <li>You are at least 18 years old or accessing under the supervision of a parent or guardian;</li>
            <li>If below 18, your parents or legal guardians can transact on your behalf if they are registered users;</li>
            <li>You are legally competent to contract under the Indian Contract Act, 1872;</li>
            <li>You have not been previously suspended or removed by EasyHeals;</li>
            <li>EasyHeals reserves the right to terminate membership if you are found to be under 18;</li>
            <li>You have authorised EasyHeals to share your medical records with HSPs at the time of booking;</li>
            <li>You provide accurate, current, true and complete information during registration;</li>
            <li>You maintain and promptly update your profile to keep it accurate and complete;</li>
            <li>We reserve the right to delete or deactivate your account if information is found false or inaccurate;</li>
            <li>You are responsible for maintaining the confidentiality of your password and must immediately notify us of any security breach.</li>
          </ol>

          <h2 id="s3">3. Our Services</h2>
          <p>Through the Platform, we provide you with the following services (&ldquo;Services&rdquo;):</p>
          <ol>
            <li>
              <strong>Creating and maintaining user accounts:</strong> You are responsible for
              maintaining the confidentiality of your password and account information. You must
              immediately notify us of any unauthorised use or security breach.
            </li>
            <li>
              <strong>Scheduling appointments from listed HSPs:</strong>
              <ol>
                <li>You can book appointments for pathology, radiology, hospital, home care and other services from listed providers;</li>
                <li>You will receive confirmation of appointment via the Platform, SMS or email. We reserve the right to reschedule or cancel without prior notice;</li>
                <li>You may book diagnostic tests and packages on the Platform and visit the diagnostic centre or schedule home sample pickup;</li>
                <li>Receiving e-prescription from the HSP based on medical consultation;</li>
                <li>Accessing your medical records on the Platform.</li>
              </ol>
            </li>
          </ol>

          <h2 id="s4">4. Your use of the platform</h2>
          <h3>Due diligence conditions:</h3>
          <ol>
            <li>You are solely responsible for the medical and personal information you provide on the Platform;</li>
            <li>The advice provided by the HSP will depend upon the information you provide — ensure it is accurate and complete;</li>
            <li>You are solely responsible for all access to and use of the site using your password and identification;</li>
            <li>The information you provide may be used for Services, analysis, research, training and disclosure as stated in our Privacy Policy;</li>
            <li>We reserve the right to refuse service or terminate accounts if you violate applicable law or these Terms.</li>
          </ol>
          <h3>Scope of Services:</h3>
          <ol>
            <li>Services availed from an HSP via the Platform are an arrangement between you and the HSP. The Platform only facilitates connections and bears no responsibility for the outcome;</li>
            <li>EasyHeals shall not be liable for deficiency in Services, misdiagnosis, faulty judgment, or interpretation errors by the HSP;</li>
            <li>EasyHeals only facilitates connections between you and the HSP and does not encourage contact outside the Platform;</li>
            <li>You may not modify, reproduce or use any content on the Platform for public or commercial purposes.</li>
          </ol>
          <h3>Prohibitions:</h3>
          <ol>
            <li>You may not reproduce, distribute, sell, reverse-engineer, or exploit the Platform or any portion of it unless expressly permitted in writing;</li>
            <li>You may not make any commercial use of any information provided on the Platform;</li>
            <li>You may not impersonate any person or entity, or misrepresent your identity, age or affiliation;</li>
            <li>You may not upload any content prohibited under applicable law or designated as &ldquo;Prohibited Content&rdquo; under Section 5;</li>
            <li>You may not contact the HSP outside the Platform via email, SMS or any other mode of communication outside authorised channels;</li>
            <li>You may not assign, transfer, or sub-contract any of your rights or obligations under these Terms.</li>
          </ol>

          <h2 id="s5">5. Prohibited Content</h2>
          <p>You shall not upload, distribute, or publish through the Platform any content that:</p>
          <ol>
            <li>Belongs to another person and which you do not own the rights to;</li>
            <li>Is harmful, harassing, defamatory, obscene, pornographic, or invasive of another&apos;s privacy;</li>
            <li>Is hateful, racially or ethnically objectionable, or disparaging of any person;</li>
            <li>Relates to or encourages money laundering or gambling;</li>
            <li>Harms minors in any way;</li>
            <li>Infringes any patent, trademark, copyright or other proprietary rights;</li>
            <li>Violates any law in India;</li>
            <li>Deceives or misleads the addressee about the origin of messages;</li>
            <li>Contains software viruses or malicious programs;</li>
            <li>Threatens the unity, integrity, defence or security of India;</li>
            <li>Is abusive or inappropriate to any HSP or EasyHeals employee;</li>
            <li>Is not related to medical consultation or Services availed from us.</li>
          </ol>
          <p>
            If you fail to adhere to the above, we have the right to remove such information and/or
            immediately terminate your access to the Services.
          </p>

          <h2 id="s6">6. Indemnity</h2>
          <p>
            You agree to indemnify and keep indemnified EasyHeals, its affiliates and the concerned
            HSP for any losses, costs and expenses including reasonable attorney fees arising from:
          </p>
          <ol>
            <li>Deficiency or shortfall in Services arising from your failure to provide correct or complete clinical information, suppression of material facts, or misinterpretation of advice;</li>
            <li>Incorrect or inaccurate credit/debit card details provided by you;</li>
            <li>Using a credit/debit card that is not lawfully owned by you;</li>
            <li>Permitting a third party to use your password or other means to access your account.</li>
          </ol>

          <h2 id="s7">7. Limitation of Liability</h2>
          <p>By using our Services, you confirm that you understand and agree:</p>
          <ol>
            <li>The Services availed from an HSP via the Platform are provided by the HSP, not by EasyHeals;</li>
            <li>The Platform only facilitates communications between you and the HSP — EasyHeals bears no responsibility for the quality or outcome of Services;</li>
            <li>For Hospital and Clinic services, HSP rates primarily cover Operative &amp; Facility charges only. Additional charges may apply based on patient history and treatment;</li>
            <li>EasyHeals does not provide any medical consultation or diagnostic services. You are responsible for assessing any medical advice received from an HSP;</li>
            <li>The Services are not intended as a substitute for face to face consultation with a doctor;</li>
            <li>To the extent permitted by applicable law, EasyHeals will not be liable for any special, indirect, incidental, consequential or punitive damages arising out of your use or inability to use the Platform.</li>
          </ol>
          <p>This section shall survive the termination of this Agreement.</p>

          <h2 id="s8">8. Data &amp; Information Policy</h2>
          <p>
            We respect your right to privacy in respect of any personal information provided to us.
            To see how we collect and use your personal information, please see our{" "}
            <Link href="/privacy">Privacy Policy</Link>.
          </p>

          <h2 id="s9">9. Intellectual Property and Ownership</h2>
          <p>
            You recognise and agree that all copyright, registered trademarks and other intellectual
            property rights on all materials or contents provided as part of the Platform belong to
            us at all times or to those who grant us the licence for their use. No use may be made
            without the prior written authorisation of EasyHeals.
          </p>

          <h2 id="s10">10. Other Conditions</h2>
          <h3>AI Assistant</h3>
          <p>
            We use an AI assistant to guide patients seeking medical help or treatment. You understand that:
          </p>
          <ol>
            <li>You should never use the AI assistant in a medical or psychiatric emergency — in such cases dial 112 or visit the emergency department;</li>
            <li>You can use the Platform on behalf of third parties only if you are their legal guardian;</li>
            <li>No content on the Platform is or should be considered a substitute for medical advice, care, diagnosis or treatment.</li>
          </ol>
          <h3>Accuracy of Information</h3>
          <p>
            We have made every effort to display information provided by third parties including HSPs
            as accurately as possible. However, we do not undertake any liability in respect of such
            information.
          </p>
          <h3>Payments &amp; Refunds</h3>
          <p>
            All consultation fees paid to EasyHeals are non-refundable, regardless of the outcome,
            duration, or nature of the consultation. This policy applies to all modes of consultation
            including in-person, telephonic, and online sessions. Users are encouraged to review
            service details and fee structures carefully before making a payment.
          </p>

          <h2 id="s11">11. Third Party Links and Resources</h2>
          <p>
            Where the Platform contains links to other sites and resources provided by third parties,
            these links are provided for your information only. We have no control over the contents
            of those websites or resources and accept no responsibility for them or for any loss or
            damage that may arise from your use of them.
          </p>
          <p>
            EasyHeals is neither guaranteeing nor making any representation with respect to the goods
            or services made available by such third parties. You shall not hold EasyHeals responsible
            or liable for any actions, claims, losses, or damages arising from your use of any third
            party website or platform.
          </p>

          <h2 id="s12">12. Amendments</h2>
          <p>
            We may from time to time update or revise these Terms and Conditions. Every time you
            wish to use the Platform, please check the relevant Terms and Conditions and Privacy
            Policy to ensure you understand the terms that apply at that time.
          </p>

          <h2 id="s13">13. Events beyond our control</h2>
          <p>
            We will not be liable for any non-compliance or delay in compliance with our obligations
            caused by events beyond our reasonable control (&ldquo;Force Majeure&rdquo;), including:
          </p>
          <ol>
            <li>Strike, lockout or other forms of protest;</li>
            <li>Civil unrest, revolt, invasion, terrorist attack, war or threat of war;</li>
            <li>Fire, explosion, storm, flood, earthquake, collapse, epidemic or any other natural disaster;</li>
            <li>Inability to use public or private transportation and telecommunication systems;</li>
            <li>Acts, decrees, legislation, regulations or restrictions of any government or public authority.</li>
          </ol>
          <p>
            Our obligations should be considered suspended during the period in which Force Majeure
            remains in effect.
          </p>

          <h2 id="s14">14. Termination</h2>
          <ol>
            <li>We may terminate this arrangement at any time, with or without cause;</li>
            <li>We reserve the right to refuse Services immediately if your conduct is in contravention of applicable law or these Terms and Conditions;</li>
            <li>For change in law, we reserve the right to suspend our obligations indefinitely and/or provide Services under revised Terms and Conditions.</li>
          </ol>

          <h2 id="s15">15. Applicable legislation and jurisdiction</h2>
          <p>
            The use of our Platform shall be governed by the laws applicable in India. Any dispute
            relating to the use of our Services shall be subject to the exclusive jurisdiction of
            the courts at Pune, India.
          </p>

          <h2 id="s16">16. Contact us</h2>
          <p>
            If you have any query or grievances regarding the Services, Terms and Conditions or
            Privacy Policy, you may contact us at{" "}
            <a href="mailto:sales@easyheals.com">sales@easyheals.com</a>.
          </p>

          <div className={s.contactCard}>
            <p>Have a question about our Terms? We&rsquo;re happy to help.</p>
            <a href="mailto:sales@easyheals.com">Contact Us →</a>
          </div>
        </div>
      </div>
    </main>
  );
}
