import Link from "next/link";

export const metadata = {
  title: "Terms and Conditions | EasyHeals",
  description: "Terms and Conditions for EasyHeals",
};

export default function TermsPage() {
  return (
    <main className="min-h-screen bg-slate-50 py-12 px-4 sm:px-6 lg:px-8">
      <style dangerouslySetInnerHTML={{__html: `
        .legal-content h2 { font-size: 1.5rem; font-weight: 700; color: #0f172a; margin-top: 2.5rem; margin-bottom: 1rem; }
        .legal-content h3 { font-size: 1.25rem; font-weight: 600; color: #1e293b; margin-top: 2rem; margin-bottom: 0.75rem; }
        .legal-content p { margin-bottom: 1.25rem; line-height: 1.7; color: #334155; }
        .legal-content ol { list-style-type: decimal; padding-left: 1.5rem; margin-bottom: 1.5rem; color: #334155; }
        .legal-content ol ol { list-style-type: lower-alpha; margin-top: 0.5rem; }
        .legal-content li { margin-bottom: 0.5rem; line-height: 1.7; }
        .legal-content a { color: #0f766e; text-decoration: none; font-weight: 500; }
        .legal-content a:hover { color: #0f766e; text-decoration: underline; }
      `}} />
      <div className="max-w-4xl mx-auto bg-white p-6 sm:p-12 rounded-2xl shadow-sm border border-slate-100">
        <div className="mb-8">
          <Link href="/" className="text-teal-700 hover:text-teal-800 font-medium text-sm inline-flex items-center gap-1">
            <span>&larr;</span> Back to Home
          </Link>
        </div>
        
        <h1 className="text-3xl font-bold text-slate-900 mb-6">Terms and Conditions</h1>
        <p className="text-slate-600 mb-8 italic">Please read all of our terms and conditions before doing anything.</p>
        
        <div className="legal-content">
          <h2>1. General</h2>
          <p>
            We, at EasyHeals Technologies Private Limited (&#8220;ETPL&#8221;, &#8220;EasyHeals&#8221;, &#8220;We&#8221;, &#8220;Us&#8221;) provide services to all individuals accessing or using our EasyHeals platform (&#8220;Platform&#8221;) for any reason (&#8220;you&#8221;, &#8220;yours&#8221;, &#8220;User&#8221;) subject to the notices, terms and conditions set forth in these terms and conditions (&#8220;Terms and Conditions&#8221;, &#8220;Agreement&#8221;), with the Privacy Policy available here <a href="https://easyheals.com/privacy" target="_blank" rel="noopener noreferrer">https://easyheals.com/privacy</a>.
          </p>

          <p>
            The Platform is owned and operated by EasyHeals, a company duly incorporated under the provisions of the Companies Act, 1956. EasyHeals may assign, transfer, and subcontract its rights and/or obligations under these Terms and Conditions to any third party, as it may deem fit, and you shall continue to be bound by these Terms and Conditions in the event of such assignment, transfer or subcontracting.
          </p>

          <p>
            EasyHeals has onboarded various Healthcare service providers (&#8220;HSP&#8221;) such as Hospitals, Clinics, Pathology and Radiology Labs, Wellness Centers, Ambulance services etc to allow them to display and market their services on EasyHeals.
          </p>

          <p>
            Any accessing or browsing of the Platform and using the Services (as defined in these Terms and Conditions) indicates your agreement to all the terms and conditions in this Agreement. If you disagree with any part of the Terms and Conditions, then you may discontinue access or use of the Platform.
          </p>

          <h2>2. Eligibility</h2>
          <p>When you use the Platform, you represent that you meet the following primary eligibility criteria:</p>
          <ol>
            <li>You are at least 18 years old or accessing the Platform under the supervision of a parent or guardian, who in such a case will be deemed as the recipient / end-user of the Services (as defined in these Terms and Conditions) for the purpose of these Terms and Conditions.</li>
            <li>If your age is below that of 18 years, your parents or legal guardians can transact on behalf of you if they are registered users. You are prohibited from purchasing any material the sale or purchase of which to/by minors is prohibited and which is for consumption by adults only.</li>
            <li>You are legally competent to contract, and otherwise competent to receive the Services (as defined in these Terms and Conditions). Persons who are &#8220;incompetent to contract&#8221; within the meaning of the Indian Contract Act, 1872 including un-discharged insolvents etc. are not eligible to use the Platform.</li>
            <li>You have not been previously suspended or removed by EasyHeals or disqualified for any other reason, from availing the Services.</li>
            <li>EasyHeals reserves the right to terminate your membership and/or refuse to provide you with access to the Platform if EasyHeals discovers that you are under the age of 18 years.</li>
            <li>You have authorized EasyHeals to share your medical records with Health service provider (HSP) at the time of booking appointment with them.</li>
            <li>Provide accurate, current, true and complete information about them while registering on our Website or App.</li>
            <li>Maintain and promptly update your profile and registration data to keep it accurate, true, current and complete.</li>
            <li>Under an event of information being found incomplete, false or inaccurate, we reserve the right to delete, terminate or deactivate your account without any notification or intimation and refuse any current or future use of our Website and/or App.</li>
            <li>When you register on our Website and/or App, you will be required to choose a username and a password. You are responsible for maintaining the confidentiality of your password and accoun information. You must immediately notify us of any unauthorized use of password or account or any other security breach.</li>
          </ol>

          <h2>3. Our Services</h2>
          <p>Through the Platform, we provide you with the following services (&#8220;Services&#8221;):</p>
          <ol>
            <li>
              <strong>Creating and maintaining user accounts:</strong>
              <ol type="a">
                <li>When you register on our Website and/or App, you will be required to choose a username and a password. You are responsible for maintaining the confidentiality of your password and account information. You must immediately notify us of any unauthorized use of password or account or any other security breach.</li>
              </ol>
            </li>
            <li>
              <strong>Scheduling an appointment from our listed Health Service Providers (HSP):</strong>
              <ol type="a">
                <li>You can book an appointment for various services including pathology, radiology, hospital, home care from listed service providers on the Platform.</li>
                <li>You will receive a confirmation of appointment for a service appointments with the health service and health service provider of your choice, on the Platform and / or via SMS and / or email and / or an online communication or messaging service. We reserve the right to reschedule or cancel an appointment without any prior notice. The time provided for consultation to you is indicative and actual consultation time may change depending on the availability and consultancy with the HSP.</li>
                <li>You may book an appointment for seeking the diagnostic tests such as pathology and radiology and packages offered by a Service Provider on the Platform. You may book diagnostic test(s) and package(s) on the Platform and visit the concerned diagnostic centre / lab of the HSP or schedule the sample pickup from home by the HSP.</li>
                <li>Receiving e-prescription from the HSP based on the medical consultation.</li>
                <li>Accessing your medical records on the Platform.</li>
                <li>Any other service that is made available on the Platform from time to time subject to the scope of services specified under Section 4 below.</li>
              </ol>
            </li>
          </ol>

          <h2>4. Your use of the platform</h2>
          <p>As an end-user and recipient of Services, when you use the Platform, you agree to the following conditions of use:</p>

          <h3 className="text-lg font-semibold mt-4 mb-2">Due diligence conditions:</h3>
          <ol>
            <li>You are solely responsible for the medical, health and personal information you provide on the Platform, and you are requested to use your discretion in providing such information.</li>
            <li>The advice or the services provided by the HSP will depend upon the information you provide on the Platform. You will provide accurate and complete information everywhere on the Platform, based on which you will receive the Services.</li>
            <li>You will be solely responsible for all access to and use of this site by anyone using the password and identification originally assigned to you whether or not such access to and use of this site is actually authorized by you, including without limitation, all communications and transmissions and all obligations (including, without limitation, financial obligations) incurred through such access or use. You are solely responsible for protecting the security and confidentiality of the password and identification assigned to you.</li>
            <li>The information provided by you may be used by us for the purpose of Services including analysis, research, training and disclosure (where required) to our affiliates, group companies, agents and government authorities, etc., as stated in our Privacy Policy. Please separately review and consent to our Privacy Policy, accordingly.</li>
            <li>The information provided by you can be retained by us and can be used without revealing your identity, as per our Privacy Policy.</li>
            <li>We reserve the right to refuse service or terminate accounts at our discretion, if we believe that you have violated or are likely to violate applicable law or these Terms and Conditions.</li>
          </ol>

          <h3 className="text-lg font-semibold mt-4 mb-2">Scope of Services:</h3>
          <ol>
            <li>The Services availed by you from a HSP via the Platform are an arrangement between you and the HSP you select. The Platform only facilitates connections between you and the HSP and bears no responsibility for the outcome of any such medical consultation or other Services obtained by you.</li>
            <li>EasyHeals shall not be liable for deficiency or shortfall in Services / misdiagnosis / faulty judgment / interpretation error / perception error / adverse events / inefficacy of prescribed treatment or advice or investigation reports / validity of the advice or prescription or investigation reports provided by the HSP / unavailability of the recommended or prescribed treatment or medication under any condition or circumstances. Users are advised to use their discretion for following the advice obtained post medical consultation with HSP via the Platform or post Services.</li>
            <li>EasyHeals only facilitates the connections between you and the HSP established through the Platform and does not in any way facilitate, encourage, permit or require you to contact the HSP outside the Platform. Any contact between you and the HSP through the Platform, will be subject to these Terms and Conditions.</li>
            <li>You may view and access the content available on the Platform solely for the purposes of availing the Services, and only as per these Terms and Conditions. You shall not modify any content on the Platform or reproduce, display, publicly perform, distribute, or otherwise use such content in any way for any public or commercial purpose or for personal gain.</li>
          </ol>

          <h3 className="text-lg font-semibold mt-4 mb-2">Prohibitions:</h3>
          <ol>
            <li>You may not reproduce, distribute, display, sell, lease, transmit, create derivative works from, translate, modify, reverse-engineer, disassemble, decompile or otherwise exploit the Platform or any portion of it unless expressly permitted by EasyHeals in writing.</li>
            <li>You may not make any commercial use of any of the information provided on the Platform.</li>
            <li>You may not impersonate any person or entity, or falsely state or otherwise misrepresent your identity, age or affiliation with any person or entity.</li>
            <li>You may not upload any content prohibited under applicable law, and / or designated as &#8220;Prohibited Content&#8221; under Section 5.</li>
            <li>You may not contact or make any attempt to contact the concerned HSP for a consultation, follow up to a prior medical consultation or for any other reason outside the Platform via email, SMS, messaging services or any other mode of communication outside the authorized channels.</li>
            <li>You may not assign, transfer, or sub-contract any of your rights or obligations under these Terms or any related order for Products to any third party, unless agreed upon in writing by EasyHeals.</li>
          </ol>

          <h2>5. Prohibited Content</h2>
          <p>
            You shall not upload to, distribute, or otherwise publish through the Platform, the following Prohibited Content, which includes any content, information, or other material that:
          </p>
          <ol>
            <li>belongs to another person and which you do not own the rights to;</li>
            <li>is harmful, harassing, blasphemous, defamatory, obscene, pornographic, pedophilic, invasive of another&apos;s privacy, including bodily privacy, insulting or harassing on the basis of gender, libellous, racially or ethnically objectionable, or otherwise inconsistent with or contrary to the laws in force;</li>
            <li>is hateful, racially or ethnically objectionable, disparaging of any person;</li>
            <li>relates to or seems to encourage money laundering or gambling;</li>
            <li>harm minors in any way;</li>
            <li>infringes any patent, trademark, copyright or other proprietary rights;</li>
            <li>violates any law in India for the time being in force;</li>
            <li>deceives or misleads the addressee about the origin of your message and intentionally communicates any information which is patently false or misleading in nature but may reasonably be perceived as a fact;</li>
            <li>communicates any information which is grossly offensive or menacing in nature;</li>
            <li>impersonates another person;</li>
            <li>contains software viruses and malicious programs;</li>
            <li>threatens the unity, integrity, defence, security or sovereignty of India, friendly relations with foreign states, or public order;</li>
            <li>is patently false and untrue, and is written or published in any form, with the intent to mislead or harass a person, entity or agency for financial gain or to cause any injury to any person;</li>
            <li>incites any offence or prevents investigation of any offence or insults any other nation;</li>
            <li>is abusive or inappropriate to the HSP conducting your medical consultation or any employees, consultants or technicians of EasyHeals or affiliate who you may interact with for availing Services; and</li>
            <li>is not relating to the medical consultation or relating to any of the services you avail from us.</li>
          </ol>
          <p>
            You also understand and acknowledge that if you fail to adhere to the above, we have the right to remove such information and / or immediately terminate your access to the Services and / or to the Platform.
          </p>

          <h2>6. Indemnity</h2>
          <p>
            You agree and undertake to indemnify and keep indemnified EasyHeals, its affiliates and the concerned HSP (&#8220;Indemnified Persons&#8221;) and us for any losses, costs, charges and expenses including reasonable attorney fees that the concerned Indemnified Persons may suffer on account of:
          </p>
          <ol>
            <li>
              deficiency or shortfall in Services / misdiagnosis / faulty judgment / interpretation errors / perception error arising from:
              <ol type="a">
                <li>your failure to provide correct and / or complete clinical information / history about the patient in timely and clinically appropriate manner; or</li>
                <li>suppression of material facts; or your failure to provide relevant clinical information about the patient; or</li>
                <li>misinterpretation of the advice / prescription / diagnosis / investigation report by you; or</li>
                <li>failure to follow doctor&apos;s advice / prescription by you; or</li>
                <li>failure to follow instructions of the HSP in respect of the Services or medical procedures prescribed by the HSP by you;</li>
              </ol>
            </li>
            <li>incorrect or inaccurate credit / debit card details provided by you; or</li>
            <li>using a credit / debit card which is not lawfully owned by you; or</li>
            <li>you permitting a third party to use your password or other means to access your account.</li>
          </ol>

          <h2>7. Limitation of Liability</h2>
          <p>By using our Services, you confirm that you understand and agree to the following:</p>
          <ol>
            <li>The Services availed by you from a HSP via the Platform are provided to you by the HSP you select, and not by EasyHeals. The limitation of liability specified in this section also applies to any services availed by you from any third party seller of services listed on the Platform.</li>
            <li>The Platform only facilitates communications between you and the HSP and as such EasyHeals bears no responsibility for the quality and outcome of any such Services obtained by you from the respective HSP, to the extent permitted by applicable law.</li>
            <li>For Hospitals, Clinics, Mother & Care, Ortho & Joints, IVF Care and similar services, HSPs Rates mentioned in catalog primarily cover Operative & Facility charges only. Additional charges may apply based on patient history and treatment.</li>
            <li>EasyHeals itself does not provide any medical consultation or diagnostic services. If you receive any medical advice / investigation reports from a HSP you have contacted through the Platform, you are responsible for assessing such advice, and reports the consequences of acting on such advice or reports, and all post-consultation follow-up action, including following the HSP&apos;s instructions.</li>
            <li>The Services provided through the Platform is not intended in any way to be a substitute for face to face consultation with a doctor. EasyHeals advices the Users to make independent assessment in respect of its accuracy or usefulness and suitability prior to making any decision in reliance hereof.</li>
            <li>To the extent permitted by applicable law, EasyHeals or its affiliates will not be liable to you for any special, indirect, incidental, consequential, punitive, reliance, or exemplary damages arising out of or relating to: (i) these Terms and Conditions and Privacy Policy; (ii) your use or inability to use the Platform; (iii) your use or inability to use the AI assistant (iv) your use of any third party services including Services provided by any HSP you contacted through the Platform.</li>
          </ol>
          <p>This section shall survive the termination of this Agreement and the termination of your use of our Services or the Platform.</p>

          <h2>8. Data & Information Policy</h2>
          <p>
            We respect your right to privacy in respect of any personal information provided to us for the purposes of availing our Services. To see how we collect and use your personal information, please see our Privacy Policy <a href="https://easyheals.com/privacy" target="_blank" rel="noopener noreferrer">https://easyheals.com/privacy</a>.
          </p>

          <h2>9. Intellectual Property and Ownership</h2>
          <p>
            You recognize and agree that all copyright, registered trademarks and other intellectual property rights on all materials or contents provided as part of the Platform belong to us at all times or to those who grant us the license for their use. No use of these may be made without the prior written authorization of EasyHeals.
          </p>

          <h2>10. Other Conditions</h2>
          <p>Please note that your payments are processed in accordance with applicable laws.</p>
          
          <h3 className="text-lg font-semibold mt-4 mb-2">1. AI Assistant</h3>
          <p>
            We use an AI assistant to guide patients seeking medical help or treatment from the Platform. This AI assistant&apos;s primary purpose is to allow users to book appointments by letting them enter their symptoms, medical conditions or treatment that they are seeking to consult with a HSP.
          </p>
          <p>You understand that:</p>
          <ol type="a">
            <li>you should never use the AI assistant in a medical or psychiatric emergency;</li>
            <li>in case of an emergency, you should dial 112 or visit the emergency department of HSPs;</li>
            <li>you can use this Platform on behalf of other users (third parties) only if you are a legal guardian of such persons, meaning that you have the legal authority to care for the personal and property interests of such person; and</li>
            <li>no content on the Platform, is or should be considered, or used as a substitute for, medical advice, care, diagnosis or treatment.</li>
          </ol>
          <p>The user may be directed to chat or call with our patient support team, in certain cases which include but are not limited to the following:</p>
          <ol type="a">
            <li>Uncertain outcome from the AI assistant;</li>
            <li>Change in schedule of appointment;</li>
            <li>Incomplete appointment booking;</li>
            <li>Any other case as deemed appropriate by EasyHeals.</li>
          </ol>

          <h3 className="text-lg font-semibold mt-4 mb-2">2. Accuracy of Information Displayed</h3>
          <p>
            We have made every effort to display, as accurately as possible, the information provided by the relevant third parties including HSPs. However, we do not undertake any liability in respect of such information and or with respect to any other information in regard to which you are capable of conducting your own due diligence to ascertain accuracy.
          </p>

          <h3 className="text-lg font-semibold mt-4 mb-2">3. Payments & Refunds</h3>
          <p>
            Easyheals is committed to providing high-quality healthcare consultation services. By availing our services, users acknowledge and agree to the following terms:
          </p>
          <p>You understand that:</p>
          <ol type="a">
            <li>All consultation fees paid to Easyheals are non-refundable, regardless of the outcome, duration, or nature of the consultation.</li>
            <li>This policy applies to all modes of consultation, including in-person, telephonic, and online sessions.</li>
            <li>Users are encouraged to review service details and fee structures carefully before making a payment.</li>
            <li>Easyheals reserves the right to modify this policy at its discretion. Continued use of our services constitutes acceptance of any such changes.</li>
          </ol>

          <h2>11. Third Party links and Resources</h2>
          <p>
            Where the Platform contains links to other sites and resources provided by third parties (including where our social media sharing plug-ins include links to third party sites), these links are provided for your information only. We have no control over the contents of those websites/ platforms (including without limitation EasyHeals Platforms) or resources and accept no responsibility for them or for any loss or damage that may arise from your use of them.
          </p>
          <p>
            EasyHeals is neither guaranteeing nor making any representation with respect to the goods or services made available or sold by such third party. EasyHeals does not provide any warranty or recommendation in relation to the products and/or services made available to you by such third parties during your access or use of such third party website/platform including in relation to delivery, services, suitability, merchantability, reliability, availability or quality of the products and/or services.
          </p>
          <p>
            You shall not hold EasyHeals, its group entities, affiliates, or their respective directors, officers, employees, agents and/or vendors responsible or liable for any actions, claims, demands, losses, damages, personal injury, costs, charges and expenses which you claim to have suffered, sustained or incurred, or claim to suffer, sustain or incur, directly or indirectly, on account of your use or access of third party website/platform.
          </p>
          <p>
            EasyHeals is not a party to any contractual arrangements entered into between you and the third party website/platform. We are not the agent of the third party and such third party website/ platform is governed exclusively by its respective policies over which EasyHeals has no control.
          </p>
          <p>
            The use of such link to visit the third party website/platform implies full acceptance of these Terms and Conditions. EasyHeals shall not be responsible or liable, directly or indirectly, for any damage or loss caused or alleged to be caused by or in connection with use of or reliance on any such content available on or through any such third party linked website, including without limitation any form of transmission received from any third party website or its server.
          </p>

          <h2>12. Amendments</h2>
          <p>
            We may from time to time update or revise these Terms and Conditions. Every time you wish to use the Platform, please check the relevant Terms and Conditions and Privacy Policy to ensure you understand the terms that apply at that time.
          </p>

          <h2>13. Events beyond our control</h2>
          <p>
            We will not be liable for any non-compliance or delay in compliance with any of the obligations we assume under any contract when caused by events that are beyond our reasonable control (&#8220;Force Majeure&#8221;). Force Majeure shall include any act, event, failure to exercise, omission or accident that is beyond our reasonable control, including, among others, the following:
          </p>
          <ol>
            <li>Strike, lockout or other forms of protest</li>
            <li>Civil unrest, revolt, invasion, terrorist attack or terrorist threat, war (declared or not) or threat or preparation for war.</li>
            <li>Fire, explosion, storm, flood, earthquake, collapse, epidemic or any other natural disaster.</li>
            <li>Inability to use public or private transportation and telecommunication systems.</li>
            <li>Acts, decrees, legislation, regulations or restrictions of any government or public authority including any judicial determination.</li>
          </ol>
          <p>
            Our obligations deriving from any contracts should be considered suspended during the period in which Force Majeure remains in effect and we will be given an extension of the period in which to fulfil these obligations by an amount of time we shall communicate to you, not being less than the time that the situation of Force Majeure lasted.
          </p>

          <h2>14. Termination</h2>
          <ol>
            <li>We may terminate this arrangement at any time, with or without cause. If you wish to terminate this arrangement, you may do so at any time by discontinuing your access or use of this Platform.</li>
            <li>We reserve the right to refuse the use of Services immediately in case your conduct is deemed by us to be in contravention of applicable acts, laws, rules and regulations or these Terms and Conditions or considered to be unethical / immoral.</li>
            <li>For change in law specifically, we reserve our rights to suspend our obligations under any contract indefinitely, and / or provide Services under revised Terms and Conditions.</li>
          </ol>

          <h2>15. Applicable legislation and jurisdiction</h2>
          <p>
            The use of our Platform shall be governed by the laws applicable in India. Any dispute relating to the use of our Services shall be subject to the exclusive jurisdiction of the courts at Pune, India.
          </p>

          <h2>16. Contact us</h2>
          <p>
            If you have any query or grievances regarding the Services, Terms and Conditions and Privacy Policy, you may contact us at <a href="mailto:sales@easyheals.com">sales@easyheals.com</a>
          </p>
        </div>
      </div>
    </main>
  );
}
