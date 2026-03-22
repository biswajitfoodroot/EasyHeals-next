/**
 * treatment-content.ts
 * Static rich content for treatment/specialty pages:
 *  - Multilingual names (all 10 locales)
 *  - Elaborative "About" descriptions (en + hi; other locales fall back to en)
 *  - Common procedures list per treatment
 *
 * RN-note: This module is pure data — no DOM/window references. Safe for React Native.
 */

import type { Locale } from "@/i18n/translations";

type LocaleMap = Partial<Record<Locale, string>>;

interface TreatmentMeta {
  names?: LocaleMap;
  about?: LocaleMap;
  procedures?: string[];
}

const CONTENT: Record<string, TreatmentMeta> = {

  // ─── SPECIALTIES ──────────────────────────────────────────────────────────

  "cardiology": {
    names: {
      en: "Cardiology",
      hi: "हृदय रोग विज्ञान",
      mr: "हृदयरोगशास्त्र",
      ta: "இதயவியல்",
      bn: "হৃদরোগ বিদ্যা",
      ml: "ഹൃദ്രോഗ ചികിത്സ",
      kn: "ಹೃದ್ರೋಗ ಶಾಸ್ತ್ರ",
      te: "హృదయ వైద్య శాస్త్రం",
      ar: "أمراض القلب",
      si: "හෘද රෝග",
    },
    about: {
      en: "Cardiology is the branch of medicine that specialises in the diagnosis, treatment and prevention of diseases of the heart and blood vessels. Cardiologists manage a wide spectrum of conditions — from coronary artery disease, heart attacks and heart failure to arrhythmias, valvular heart disease and congenital defects. India has world-class cardiac centres equipped with state-of-the-art catheterisation labs, hybrid operating theatres and advanced electrophysiology suites. With timely intervention, most heart conditions can be effectively treated or well-controlled. EasyHeals connects you with NABH-accredited cardiac hospitals and verified cardiologists across Mumbai, Delhi, Chennai, Bengaluru and all major Indian cities.",
      hi: "कार्डियोलॉजी चिकित्सा की वह शाखा है जो हृदय और रक्त वाहिकाओं के रोगों के निदान, उपचार और रोकथाम में विशेषज्ञता रखती है। हृदय रोग विशेषज्ञ कोरोनरी धमनी रोग, दिल का दौरा, हृदय विफलता, अनियमित धड़कन और हृदय वाल्व रोग जैसी स्थितियों का उपचार करते हैं। भारत में विश्व स्तरीय हृदय केंद्र नवीनतम तकनीक — एंजियोग्राफी, एंजियोप्लास्टी, पेसमेकर और रोबोटिक हार्ट सर्जरी — से लैस हैं। EasyHeals के माध्यम से आप अपने शहर में प्रमाणित हृदय रोग विशेषज्ञ और अस्पताल खोज सकते हैं।",
      ta: "இதயவியல் என்பது இதயம் மற்றும் இரத்த நாளங்களின் நோய்களை கண்டறிந்து சிகிச்சையளிக்கும் மருத்துவ துறையாகும். இதய நோய் நிபுணர்கள் கரோனரி தமனி நோய், மாரடைப்பு, இதய செயலிழப்பு மற்றும் வால்வு நோய்களை கையாளுகின்றனர். EasyHeals மூலம் இந்தியாவிலுள்ள சிறந்த இதய மருத்துவமனைகள் மற்றும் நிபுணர்களை கண்டறியுங்கள்.",
    },
    procedures: [
      "Coronary Angiography",
      "Coronary Angioplasty / PTCA",
      "Coronary Artery Bypass Graft (CABG)",
      "Pacemaker Implantation",
      "Implantable Cardioverter Defibrillator (ICD)",
      "Heart Valve Repair / Replacement",
      "Electrophysiology Study (EPS) & Ablation",
      "Transcatheter Aortic Valve Replacement (TAVR)",
      "Cardiac Catheterisation",
      "Echocardiography (2D Echo / Stress Echo)",
    ],
  },

  "neurology": {
    names: {
      en: "Neurology",
      hi: "तंत्रिका विज्ञान",
      mr: "मज्जारोगशास्त्र",
      ta: "நரம்பியல்",
      bn: "স্নায়ুবিজ্ঞান",
      ml: "നευറോളജി",
      kn: "ನರವಿಜ್ಞಾನ",
      te: "నరమండల వైద్యం",
      ar: "طب الأعصاب",
      si: "ස්නායු විද්‍යාව",
    },
    about: {
      en: "Neurology is the medical specialty focused on the diagnosis and treatment of disorders affecting the brain, spinal cord, nerves and muscles. Neurologists manage conditions including stroke, epilepsy, Parkinson's disease, multiple sclerosis, migraines, dementia, neuropathy and movement disorders. India has rapidly advanced neurological care, with dedicated stroke units, advanced epilepsy monitoring and functional neurosurgery programmes available at leading hospitals. Early diagnosis and treatment are critical — especially for stroke, where every minute matters. EasyHeals helps you find experienced neurologists and neurology centres in your city.",
      hi: "न्यूरोलॉजी वह चिकित्सा विशेषता है जो मस्तिष्क, रीढ़ की हड्डी, नसों और मांसपेशियों को प्रभावित करने वाले विकारों के निदान और उपचार पर केंद्रित है। न्यूरोलॉजिस्ट स्ट्रोक, मिर्गी, पार्किंसन रोग, माइग्रेन, डिमेंशिया और मल्टीपल स्क्लेरोसिस जैसी स्थितियों का प्रबंधन करते हैं। EasyHeals के माध्यम से अपने शहर में विशेषज्ञ न्यूरोलॉजिस्ट और न्यूरोलॉजी सेंटर खोजें।",
    },
    procedures: [
      "MRI Brain & Spine",
      "CT Scan Brain",
      "Electroencephalogram (EEG)",
      "Nerve Conduction Study (NCS) / EMG",
      "Lumbar Puncture (Spinal Tap)",
      "Deep Brain Stimulation (DBS)",
      "Botulinum Toxin Therapy for Migraine / Spasticity",
      "Carotid Endarterectomy",
    ],
  },

  "orthopaedics": {
    names: {
      en: "Orthopaedics",
      hi: "अस्थि रोग विज्ञान",
      mr: "अस्थिरोगशास्त्र",
      ta: "எலும்பியல்",
      bn: "অর্থোপেডিক্স",
      ml: "ഓർത്തോപീഡിക്സ്",
      kn: "ಅಸ್ಥಿ ವಿಜ್ಞಾನ",
      te: "ఎముక శాస్త్రం",
      ar: "جراحة العظام",
      si: "අස්ථි රෝග",
    },
    about: {
      en: "Orthopaedics is the surgical and medical specialty dedicated to the diagnosis, treatment and rehabilitation of conditions affecting the musculoskeletal system — bones, joints, ligaments, tendons and muscles. Orthopaedic surgeons treat fractures, arthritis, sports injuries, spine disorders, congenital deformities and degenerative joint diseases. Modern orthopaedic care in India includes joint replacement surgery, arthroscopic (keyhole) procedures, robotic-assisted surgeries and advanced sports injury management. India is one of the most affordable destinations globally for high-quality orthopaedic care with significantly reduced waiting times compared to Western countries.",
      hi: "ऑर्थोपेडिक्स शल्य चिकित्सा और चिकित्सा विशेषता है जो हड्डियों, जोड़ों, स्नायुबंधन, कंडरा और मांसपेशियों को प्रभावित करने वाली स्थितियों के निदान, उपचार और पुनर्वास के लिए समर्पित है। ऑर्थोपेडिक सर्जन फ्रैक्चर, गठिया, खेल चोटें, रीढ़ की हड्डी के विकार और जोड़ों के अपक्षयी रोगों का उपचार करते हैं।",
    },
    procedures: [
      "Total Knee Replacement (TKR)",
      "Total Hip Replacement (THR)",
      "Shoulder Replacement",
      "Arthroscopic Knee Surgery",
      "ACL Reconstruction",
      "Spinal Fusion Surgery",
      "Fracture Fixation (Internal / External)",
      "Joint Injections (PRP / Hyaluronic Acid)",
      "Limb Deformity Correction",
    ],
  },

  "gastroenterology": {
    names: {
      en: "Gastroenterology",
      hi: "जठरांत्र विज्ञान",
      mr: "पाचनतंत्रशास्त्र",
      ta: "இரைப்பை குடல் நோயியல்",
      bn: "গ্যাস্ট্রোএন্টেরোলজি",
      ml: "ദഹന നാള ചികിത്സ",
      kn: "ಜಠರಾಂತ್ರ ವಿಜ್ಞಾನ",
      te: "జఠర ప్రేగు వైద్యం",
      ar: "أمراض الجهاز الهضمي",
      si: "ආමාශ රෝග",
    },
    about: {
      en: "Gastroenterology is the branch of medicine concerned with the digestive system — oesophagus, stomach, small intestine, large intestine, liver, gallbladder and pancreas. Gastroenterologists diagnose and treat conditions such as GERD, peptic ulcers, irritable bowel syndrome (IBS), inflammatory bowel disease (Crohn's disease, ulcerative colitis), liver cirrhosis, hepatitis, gallstones and colorectal cancer. Endoscopic techniques have transformed diagnosis and treatment, allowing minimally invasive procedures like colonoscopy, ERCP and therapeutic endoscopy. India's gastroenterology centres offer advanced endoscopy suites, liver transplant programmes and comprehensive IBD care.",
      hi: "गैस्ट्रोएंटरोलॉजी चिकित्सा की वह शाखा है जो पाचन तंत्र से संबंधित है — अन्नप्रणाली, पेट, छोटी आंत, बड़ी आंत, यकृत, पित्ताशय और अग्न्याशय। गैस्ट्रोएंटेरोलॉजिस्ट GERD, पेप्टिक अल्सर, IBS, लिवर सिरोसिस, हेपेटाइटिस और पित्त पथरी जैसी बीमारियों का उपचार करते हैं।",
    },
    procedures: [
      "Upper GI Endoscopy (OGD Scopy)",
      "Colonoscopy",
      "ERCP (Endoscopic Retrograde Cholangiopancreatography)",
      "Endoscopic Ultrasound (EUS)",
      "Liver Biopsy",
      "Capsule Endoscopy",
      "Laparoscopic Cholecystectomy",
      "Polypectomy",
    ],
  },

  "pulmonology": {
    names: {
      en: "Pulmonology",
      hi: "श्वसन रोग विज्ञान",
      mr: "फुफ्फुसशास्त्र",
      ta: "நுரையீரல் நோயியல்",
      bn: "ফুসফুস রোগবিদ্যা",
      ml: "ശ്വാസകോശ ചികിത്സ",
      kn: "ಶ್ವಾಸಕೋಶ ವಿಜ್ಞಾನ",
      te: "శ్వాసకోశ వైద్యం",
      ar: "طب الرئة",
      si: "පෙනහළු රෝග",
    },
    about: {
      en: "Pulmonology (also called respiratory medicine) focuses on the prevention, diagnosis and treatment of diseases affecting the lungs and respiratory system. Pulmonologists manage asthma, chronic obstructive pulmonary disease (COPD), pneumonia, tuberculosis, interstitial lung diseases, sleep apnoea, pulmonary hypertension and lung cancer. Diagnostic tools include spirometry, bronchoscopy, CT thorax and polysomnography for sleep disorders. India carries a high burden of respiratory diseases including TB and pollution-related lung conditions — making access to specialist pulmonology care critically important.",
      hi: "पल्मोनोलॉजी (श्वसन चिकित्सा) फेफड़ों और श्वसन तंत्र को प्रभावित करने वाली बीमारियों की रोकथाम, निदान और उपचार पर केंद्रित है। पल्मोनोलॉजिस्ट अस्थमा, COPD, निमोनिया, तपेदिक, इंटरस्टिशियल फेफड़ों की बीमारी और फेफड़ों के कैंसर का प्रबंधन करते हैं।",
    },
    procedures: [
      "Spirometry (Pulmonary Function Test)",
      "Bronchoscopy & BAL",
      "CT Thorax / HRCT Chest",
      "Polysomnography (Sleep Study)",
      "Pleural Tapping (Thoracentesis)",
      "Chest Physiotherapy",
      "Mechanical Ventilation Management",
    ],
  },

  "nephrology": {
    names: {
      en: "Nephrology",
      hi: "वृक्क रोग विज्ञान",
      mr: "मूत्रपिंडशास्त्र",
      ta: "சிறுநீரக நோயியல்",
      bn: "বৃক্ক রোগবিদ্যা",
      ml: "നെഫ്രോളജി",
      kn: "ಮೂತ್ರಪಿಂಡ ವಿಜ್ಞಾನ",
      te: "మూత్రపిండ వైద్యం",
      ar: "أمراض الكلى",
      si: "වකුගඩු රෝග",
    },
    about: {
      en: "Nephrology is the medical specialty concerned with the kidneys — their function, diseases and disorders. Nephrologists diagnose and manage chronic kidney disease (CKD), acute kidney injury, glomerulonephritis, nephrotic syndrome, polycystic kidney disease, hypertension-related kidney damage and kidney failure requiring dialysis or transplantation. The kidneys play a vital role in fluid and electrolyte balance, blood pressure regulation and waste filtration. With India facing a growing CKD epidemic, timely nephrological care is essential to slow disease progression and improve quality of life.",
      hi: "नेफ्रोलॉजी वह चिकित्सा विशेषता है जो गुर्दों से संबंधित है — उनके कार्य, रोग और विकार। नेफ्रोलॉजिस्ट क्रोनिक किडनी रोग, तीव्र किडनी चोट, ग्लोमेरुलोनेफ्राइटिस और किडनी विफलता का प्रबंधन करते हैं।",
    },
    procedures: [
      "Haemodialysis",
      "Peritoneal Dialysis",
      "Kidney Biopsy",
      "Renal Doppler Ultrasound",
      "Continuous Renal Replacement Therapy (CRRT)",
      "Kidney Transplant Evaluation",
    ],
  },

  "urology": {
    names: {
      en: "Urology",
      hi: "मूत्र रोग विज्ञान",
      mr: "मूत्रविज्ञान",
      ta: "சிறுநீரகவியல்",
      bn: "মূত্রবিদ্যা",
      ml: "മൂത്രശാസ്ത്രം",
      kn: "ಮೂತ್ರ ವಿಜ್ಞಾನ",
      te: "మూత్ర వైద్యం",
      ar: "طب المسالك البولية",
      si: "මූත්‍ර රෝග",
    },
    about: {
      en: "Urology is the surgical and medical specialty dealing with diseases of the urinary system in both sexes and the male reproductive system. Urologists treat kidney stones, urinary tract infections, prostate enlargement (BPH), prostate cancer, bladder disorders, urinary incontinence, erectile dysfunction, male infertility and congenital urological conditions. Minimally invasive techniques — including laser lithotripsy for kidney stones, laparoscopic and robot-assisted surgeries — have made urological treatments significantly safer and faster-recovering. India offers world-class urological care at a fraction of the cost compared to Western nations.",
      hi: "यूरोलॉजी शल्य चिकित्सा और चिकित्सा विशेषता है जो दोनों लिंगों के मूत्र प्रणाली और पुरुष प्रजनन प्रणाली के रोगों से संबंधित है। यूरोलॉजिस्ट किडनी की पथरी, प्रोस्टेट वृद्धि, ब्लैडर विकार, मूत्र असंयम और पुरुष बांझपन का उपचार करते हैं।",
    },
    procedures: [
      "Laser Lithotripsy (PCNL / URS / ESWL)",
      "Cystoscopy",
      "Transurethral Resection of Prostate (TURP)",
      "Radical Prostatectomy (Robotic / Laparoscopic)",
      "Varicocele Treatment",
      "Circumcision",
      "Bladder Tumour Resection (TURBT)",
    ],
  },

  "ophthalmology": {
    names: {
      en: "Ophthalmology",
      hi: "नेत्र विज्ञान",
      mr: "नेत्रशास्त्र",
      ta: "கண் மருத்துவம்",
      bn: "চক্ষুবিজ্ঞান",
      ml: "നേത്ര ചികിത്സ",
      kn: "ನೇತ್ರ ವಿಜ್ಞಾನ",
      te: "నేత్ర వైద్యం",
      ar: "طب العيون",
      si: "නේත්‍ර රෝග",
    },
    about: {
      en: "Ophthalmology is the medical and surgical specialty dedicated to the diagnosis and treatment of eye diseases. Ophthalmologists manage a wide range of conditions including cataracts, glaucoma, diabetic retinopathy, age-related macular degeneration (AMD), retinal detachment, corneal disorders, squint (strabismus) and refractive errors. India is a global leader in cataract surgery volume and cost-effectiveness, performing millions of surgeries annually. Advanced refractive procedures like LASIK and SMILE offer spectacle independence to millions. Leading eye hospitals in India provide the complete spectrum of eye care from children to the elderly.",
      hi: "ऑप्थाल्मोलॉजी (नेत्र विज्ञान) आंखों के रोगों के निदान और उपचार के लिए समर्पित चिकित्सा और शल्य चिकित्सा विशेषता है। नेत्र रोग विशेषज्ञ मोतियाबिंद, ग्लूकोमा, डायबिटिक रेटिनोपैथी, रेटिनल डिटैचमेंट और अपवर्तक दोष (मायोपिया, हाइपरोपिया) का उपचार करते हैं।",
    },
    procedures: [
      "Cataract Surgery (Phacoemulsification)",
      "LASIK / SMILE Refractive Surgery",
      "Glaucoma Surgery (Trabeculectomy)",
      "Retinal Laser Photocoagulation",
      "Intravitreal Injections (Anti-VEGF)",
      "Corneal Transplant (Keratoplasty)",
      "Vitreoretinal Surgery",
    ],
  },

  "ent-ear-nose-throat": {
    names: {
      en: "ENT (Ear, Nose & Throat)",
      hi: "कान, नाक और गला",
      mr: "कान, नाक, घसा",
      ta: "காது, மூக்கு, தொண்டை",
      bn: "কান, নাক ও গলা",
      ml: "കാത്, മൂക്ക്, തൊണ്ട",
      kn: "ಕಿವಿ, ಮೂಗು, ಗಂಟಲು",
      te: "చెవి, ముక్కు, గొంతు",
      ar: "أمراض الأنف والأذن والحنجرة",
      si: "කන, නාසය, උගුර",
    },
    about: {
      en: "Otolaryngology (ENT — Ear, Nose and Throat) is the surgical specialty that deals with conditions of the ear, nose, nasal sinuses, throat, head and neck. ENT specialists treat hearing loss, ear infections, tinnitus, balance disorders, sinusitis, nasal polyps, tonsillitis, adenoid problems, voice disorders, sleep apnoea and head & neck cancers. India has excellent ENT centres offering cochlear implants for the deaf, endoscopic sinus surgeries, laser treatments for voice disorders and comprehensive skull base surgery programmes.",
      hi: "ENT (कान, नाक और गला विशेषता) कान, नाक, साइनस, गले, सिर और गर्दन की स्थितियों से निपटती है। ENT विशेषज्ञ श्रवण हानि, कान के संक्रमण, साइनसाइटिस, टॉन्सिलाइटिस, आवाज विकार और स्लीप एप्निया का उपचार करते हैं।",
    },
    procedures: [
      "Functional Endoscopic Sinus Surgery (FESS)",
      "Tonsillectomy & Adenoidectomy",
      "Cochlear Implant",
      "Septoplasty / Rhinoplasty",
      "Microlaryngoscopy (Voice Surgery)",
      "Myringoplasty (Eardrum Repair)",
      "Neck Dissection for Head & Neck Cancer",
    ],
  },

  "dermatology": {
    names: {
      en: "Dermatology",
      hi: "त्वचा विज्ञान",
      mr: "त्वचाशास्त्र",
      ta: "தோல் மருத்துவம்",
      bn: "চর্মরোগ বিদ্যা",
      ml: "ത്വക്ക് ചികിത്സ",
      kn: "ಚರ್ಮ ವಿಜ್ಞಾನ",
      te: "చర్మ వైద్యం",
      ar: "طب الجلد",
      si: "සමේ රෝග",
    },
    about: {
      en: "Dermatology is the branch of medicine specialising in skin, hair, nail and mucous membrane disorders. Dermatologists diagnose and treat acne, eczema, psoriasis, fungal infections, allergic skin conditions, vitiligo, alopecia (hair loss), skin cancer, urticaria and a wide range of cosmetic skin concerns. Cosmetic dermatology services — including chemical peels, laser treatments, PRP for hair loss, Botox and dermal fillers — are increasingly sought after. India has a growing number of super-specialist dermatology and aesthetic clinics offering cutting-edge treatments.",
      hi: "डर्माटोलॉजी त्वचा, बाल, नाखून और श्लेष्मा झिल्ली के विकारों में विशेषज्ञता रखने वाली चिकित्सा शाखा है। डर्माटोलॉजिस्ट मुंहासे, एक्जिमा, सोरायसिस, फंगल संक्रमण, विटिलिगो, बालों के झड़ने और त्वचा कैंसर का उपचार करते हैं।",
    },
    procedures: [
      "Laser Skin Treatments",
      "Chemical Peels",
      "PRP for Hair Loss",
      "Phototherapy (NB-UVB) for Psoriasis / Vitiligo",
      "Skin Biopsy",
      "Dermoscopy",
      "Botox & Dermal Fillers",
    ],
  },

  "oncology": {
    names: {
      en: "Oncology (Cancer Care)",
      hi: "कैंसर चिकित्सा",
      mr: "कर्करोगशास्त्र",
      ta: "புற்றுநோயியல்",
      bn: "অনকোলজি (ক্যান্সার চিকিৎসা)",
      ml: "ഓങ്കോളജി (കാൻസർ ചികിത്സ)",
      kn: "ಆಂಕೊಲಾಜಿ",
      te: "కాన్సర్ వైద్యం",
      ar: "علاج الأورام",
      si: "පිළිකා රෝග",
    },
    about: {
      en: "Oncology is the study and treatment of cancer. Medical oncologists, radiation oncologists and surgical oncologists work as a multidisciplinary team to treat all types of cancers — breast, lung, colorectal, cervical, prostate, blood cancers (leukaemia, lymphoma), brain tumours and more. Treatment modalities include surgery, chemotherapy, radiation therapy, targeted therapy, immunotherapy and bone marrow transplantation. India has established centres of excellence in oncology with internationally trained oncologists, linear accelerators, PET-CT scanners and robotic surgery systems. Access to affordable, world-class cancer care makes India a preferred destination for medical tourism.",
      hi: "ऑन्कोलॉजी कैंसर के अध्ययन और उपचार से संबंधित है। मेडिकल ऑन्कोलॉजिस्ट, रेडिएशन ऑन्कोलॉजिस्ट और सर्जिकल ऑन्कोलॉजिस्ट की बहु-अनुशासनीय टीम सभी प्रकार के कैंसर — स्तन, फेफड़े, आंत, ग्रीवा, प्रोस्टेट और रक्त कैंसर — का उपचार करती है।",
    },
    procedures: [
      "Chemotherapy",
      "Radiation Therapy (IMRT / IGRT / SBRT)",
      "Targeted Therapy & Immunotherapy",
      "Surgical Tumour Resection",
      "Bone Marrow / Stem Cell Transplant",
      "PET-CT Scan & Tumour Biopsy",
      "Port-a-Cath Insertion",
      "Palliative Care Management",
    ],
  },

  "gynaecology-obstetrics": {
    names: {
      en: "Gynaecology & Obstetrics",
      hi: "स्त्री रोग और प्रसूति विज्ञान",
      mr: "स्त्रीरोग व प्रसूतिशास्त्र",
      ta: "மகப்பேறியல் & மகளிர் நோயியல்",
      bn: "স্ত্রীরোগ ও প্রসূতিবিদ্যা",
      ml: "പ്രസവ ചികിത്സ",
      kn: "ಸ್ತ್ರೀ ರೋಗ ಮತ್ತು ಪ್ರಸೂತಿ ವಿಜ್ಞಾನ",
      te: "స్త్రీ రోగ వైద్యం",
      ar: "أمراض النساء والتوليد",
      si: "ප්‍රසව රෝග",
    },
    about: {
      en: "Gynaecology and Obstetrics is the dual specialty covering women's reproductive health. Gynaecologists diagnose and treat uterine fibroids, ovarian cysts, endometriosis, polycystic ovary syndrome (PCOS), cervical and uterine cancers, menstrual disorders and infertility. Obstetricians manage pregnancy, childbirth and the postnatal period, handling high-risk pregnancies, gestational diabetes, pre-eclampsia and preterm deliveries. India's top hospitals offer fetal medicine services, foetal surgery, minimally invasive gynaecological surgeries, high-risk obstetrics units and comprehensive reproductive medicine programmes.",
      hi: "स्त्री रोग और प्रसूति विज्ञान महिलाओं के प्रजनन स्वास्थ्य को कवर करने वाली दोहरी विशेषता है। स्त्री रोग विशेषज्ञ गर्भाशय फाइब्रॉएड, ओवेरियन सिस्ट, PCOS, एंडोमेट्रियोसिस, गर्भाशय ग्रीवा कैंसर और बांझपन का उपचार करते हैं।",
    },
    procedures: [
      "Normal Delivery & C-Section",
      "Laparoscopic Hysterectomy",
      "Myomectomy (Fibroid Removal)",
      "Laparoscopic Ovarian Cystectomy",
      "Endometrial Ablation",
      "Hysteroscopy & D&C",
      "Cervical Cerclage (High-risk Pregnancy)",
      "Fetal Medicine & Amniocentesis",
    ],
  },

  "paediatrics": {
    names: {
      en: "Paediatrics",
      hi: "बाल रोग विज्ञान",
      mr: "बालरोगशास्त्र",
      ta: "குழந்தை மருத்துவம்",
      bn: "শিশু চিকিৎসা বিদ্যা",
      ml: "ശിശുരോഗ ചികിത്സ",
      kn: "ಮಕ್ಕಳ ವೈದ್ಯಕೀಯ ವಿಜ್ಞಾನ",
      te: "శిశు వైద్యం",
      ar: "طب الأطفال",
      si: "ළමා රෝග",
    },
    about: {
      en: "Paediatrics is the branch of medicine that focuses on the health and medical care of infants, children and adolescents. Paediatricians provide preventive care, vaccinations, growth and development monitoring, and treat conditions ranging from common infections to complex cardiac, neurological and genetic disorders. Paediatric subspecialties include neonatology (newborn care), paediatric cardiology, paediatric surgery, paediatric neurology and paediatric oncology. India has rapidly improved its child health indicators, with leading hospitals offering Level III NICUs (Neonatal Intensive Care Units) and comprehensive paediatric surgical services.",
      hi: "बाल रोग विज्ञान चिकित्सा की वह शाखा है जो शिशुओं, बच्चों और किशोरों के स्वास्थ्य और चिकित्सा देखभाल पर केंद्रित है। बाल रोग विशेषज्ञ सामान्य संक्रमणों से लेकर जटिल हृदय, तंत्रिका और आनुवांशिक विकारों तक का उपचार करते हैं।",
    },
    procedures: [
      "Neonatal Intensive Care (NICU)",
      "Vaccination Programme",
      "Growth & Development Assessment",
      "Paediatric Bronchoscopy",
      "Paediatric Cardiac Surgery",
      "Paediatric Laparoscopic Surgery",
    ],
  },

  "psychiatry": {
    names: {
      en: "Psychiatry & Mental Health",
      hi: "मनोचिकित्सा",
      mr: "मनोचिकित्सा",
      ta: "மனநல சிகிச்சை",
      bn: "মানসিক স্বাস্থ্য",
      ml: "മനോരോഗ ചികിത്സ",
      kn: "ಮನೋವೈದ್ಯಶಾಸ್ತ್ರ",
      te: "మానసిక వైద్యం",
      ar: "الطب النفسي",
      si: "මනෝ රෝග",
    },
    about: {
      en: "Psychiatry is the medical specialty devoted to the diagnosis, prevention and treatment of mental, emotional and behavioural disorders. Psychiatrists treat depression, anxiety disorders, bipolar disorder, schizophrenia, OCD, PTSD, eating disorders, addiction, ADHD and personality disorders. Treatment approaches include psychotherapy (CBT, DBT, psychoanalysis), pharmacotherapy, ECT (electroconvulsive therapy) and newer modalities like TMS (transcranial magnetic stimulation) and ketamine therapy. Mental health care is a growing priority in India, with dedicated inpatient units, day care programmes and tele-psychiatry services expanding access across the country.",
      hi: "मनोचिकित्सा मानसिक, भावनात्मक और व्यवहारिक विकारों के निदान, रोकथाम और उपचार के लिए समर्पित चिकित्सा विशेषता है। मनोचिकित्सक अवसाद, चिंता विकार, द्विध्रुवीय विकार, सिज़ोफ्रेनिया, OCD और व्यसन का उपचार करते हैं।",
    },
    procedures: [
      "Psychiatric Assessment & Diagnosis",
      "Cognitive Behavioural Therapy (CBT)",
      "Electroconvulsive Therapy (ECT)",
      "Transcranial Magnetic Stimulation (TMS)",
      "De-addiction & Rehabilitation Programme",
      "Psychotherapy & Counselling",
    ],
  },

  "endocrinology": {
    names: {
      en: "Endocrinology",
      hi: "अंतःस्रावी विज्ञान",
      mr: "अंतःस्रावशास्त्र",
      ta: "நாளமில்லா சுரப்பியல்",
      bn: "এন্ডোক্রিনোলজি",
      ml: "ഹോർമോൺ ചികിത്സ",
      kn: "ಅಂತಃಸ್ರಾವ ವಿಜ್ಞಾನ",
      te: "ఎండోక్రైనాలజీ",
      ar: "الغدد الصماء",
      si: "හෝමෝන රෝග",
    },
    about: {
      en: "Endocrinology is the study of hormones, the glands that produce them, and the diseases caused by hormonal imbalances. Endocrinologists treat diabetes mellitus (Type 1 & Type 2), thyroid disorders (hypothyroidism, hyperthyroidism, thyroid nodules), adrenal disorders (Cushing's syndrome, Addison's disease), pituitary tumours, polycystic ovary syndrome (PCOS), obesity and metabolic syndrome, osteoporosis and growth hormone disorders. With India having one of the world's largest populations of diabetics, endocrinology services are in extremely high demand across the country.",
      hi: "एंडोक्रिनोलॉजी हार्मोन, उन्हें उत्पादित करने वाली ग्रंथियों और हार्मोनल असंतुलन से उत्पन्न होने वाली बीमारियों का अध्ययन है। एंडोक्रिनोलॉजिस्ट डायबिटीज, थायरॉइड विकार, एड्रिनल विकार, पिट्यूटरी ट्यूमर, PCOS और ऑस्टियोपोरोसिस का उपचार करते हैं।",
    },
    procedures: [
      "HbA1c & Glucose Monitoring",
      "Thyroid Ultrasound & FNAC",
      "Radioiodine Therapy",
      "Insulin Pump / CGM Initiation",
      "DEXA Scan (Bone Density)",
      "Adrenal / Pituitary Imaging & Testing",
    ],
  },

  "haematology": {
    names: {
      en: "Haematology",
      hi: "रक्त विज्ञान",
      mr: "रक्तशास्त्र",
      ta: "இரத்தவியல்",
      bn: "হেমাটোলজি",
      ml: "ഹേമറ്റോളജി",
      kn: "ರಕ್ತ ವಿಜ್ಞಾನ",
      te: "రక్త వైద్యం",
      ar: "أمراض الدم",
      si: "රුධිර රෝග",
    },
    about: {
      en: "Haematology is the branch of medicine concerned with the study and treatment of blood, blood-forming organs and blood diseases. Haematologists diagnose and treat anaemia, haemophilia, thalassaemia, sickle cell disease, blood clotting disorders, leukaemia, lymphoma, multiple myeloma and other blood cancers. Treatment may involve blood transfusions, iron infusions, chemotherapy, targeted therapy or bone marrow transplantation. India has leading haematology centres offering stem cell and bone marrow transplant programmes, particularly important given the high prevalence of thalassaemia and sickle cell disease in certain populations.",
      hi: "हेमेटोलॉजी रक्त, रक्त बनाने वाले अंगों और रक्त रोगों के अध्ययन और उपचार से संबंधित चिकित्सा की शाखा है। हेमेटोलॉजिस्ट एनीमिया, थैलेसीमिया, सिकल सेल रोग, ल्यूकेमिया, लिम्फोमा और मल्टीपल मायलोमा का उपचार करते हैं।",
    },
    procedures: [
      "Bone Marrow Biopsy & Aspiration",
      "Blood Transfusion",
      "Stem Cell Transplant",
      "Chemotherapy for Blood Cancers",
      "Flow Cytometry / Immunophenotyping",
      "Apheresis / Plasmapheresis",
    ],
  },

  "rheumatology": {
    names: {
      en: "Rheumatology",
      hi: "आमवात विज्ञान",
      mr: "रूमेटोलॉजी",
      ta: "மூட்டு நோயியல்",
      bn: "রিউমাটোলজি",
      ml: "സന്ധി രോഗ ചികിത്സ",
      kn: "ರುಮೆಟಾಲಜಿ",
      te: "రుమటాలజీ",
      ar: "الروماتولوجيا",
      si: "රූමැටොලොජි",
    },
    about: {
      en: "Rheumatology is the medical specialty focused on the diagnosis and treatment of autoimmune and musculoskeletal diseases. Rheumatologists manage rheumatoid arthritis, ankylosing spondylitis, lupus (SLE), psoriatic arthritis, gout, fibromyalgia, vasculitis, Sjögren's syndrome and other connective tissue diseases. Modern rheumatology treatments — including disease-modifying antirheumatic drugs (DMARDs) and biologics — have transformed the management of these chronic conditions, enabling patients to maintain quality of life and prevent joint damage.",
      hi: "रुमेटोलॉजी ऑटोइम्यून और मस्कुलोस्केलेटल रोगों के निदान और उपचार पर केंद्रित चिकित्सा विशेषता है। रुमेटोलॉजिस्ट रुमेटॉयड आर्थराइटिस, लुपस, एंकाइलोजिंग स्पॉन्डिलाइटिस, गठिया और फाइब्रोमायल्जिया का प्रबंधन करते हैं।",
    },
    procedures: [
      "Joint Aspiration & Injection",
      "DEXA Scan",
      "Autoimmune Blood Panel (ANA, RF, anti-CCP)",
      "Biologic Infusion Therapy",
      "Musculoskeletal Ultrasound",
    ],
  },

  "cardiothoracic-surgery": {
    names: {
      en: "Cardiothoracic Surgery",
      hi: "हृदय-वक्ष शल्य चिकित्सा",
      mr: "हृदय-वक्ष शस्त्रक्रिया",
      ta: "இதய-மார்பு அறுவை சிகிச்சை",
      bn: "কার্ডিওথোরাসিক সার্জারি",
      ml: "കാർഡിയോ തൊറാസിക് ശസ്ത്രക്രിയ",
      kn: "ಹೃದ್ವಕ್ಷ ಶಸ್ತ್ರಚಿಕಿತ್ಸೆ",
      te: "హృదయ-వక్ష శస్త్రచికిత్స",
      ar: "جراحة القلب والصدر",
      si: "හෘද-පපුව ශල්‍ය",
    },
    about: {
      en: "Cardiothoracic surgery encompasses surgical procedures on the heart, lungs and other thoracic (chest) organs. Cardiothoracic surgeons perform coronary artery bypass grafting (CABG), heart valve repairs and replacements, thoracic aortic surgery, congenital heart defect corrections, lung resections for cancer or infection, and pleural surgeries. India's leading cardiac surgical centres offer outcomes comparable to the best international hospitals at a significantly lower cost. Robotic-assisted cardiac surgery is now available at select premium centres, enabling smaller incisions and faster recovery.",
      hi: "कार्डियोथोरेसिक सर्जरी में हृदय, फेफड़े और अन्य थोरेसिक (छाती) अंगों पर शल्य प्रक्रियाएं शामिल हैं। CABG, हृदय वाल्व मरम्मत और प्रतिस्थापन, और फेफड़ों की सर्जरी इसमें शामिल हैं।",
    },
    procedures: [
      "Coronary Artery Bypass Graft (CABG)",
      "Heart Valve Replacement (Surgical / TAVR)",
      "Thoracic Aortic Aneurysm Repair",
      "Lung Lobectomy / Pneumonectomy",
      "Pericardiectomy",
      "Atrial Septal Defect (ASD) Repair",
      "Ventricular Septal Defect (VSD) Repair",
    ],
  },

  "neurosurgery": {
    names: {
      en: "Neurosurgery",
      hi: "मस्तिष्क शल्य चिकित्सा",
      mr: "न्यूरोसर्जरी",
      ta: "நரம்பியல் அறுவை சிகிச்சை",
      bn: "নিউরোসার্জারি",
      ml: "ന്യൂറോ ശസ്ത്രക്രിയ",
      kn: "ನ್ಯೂರೋಸರ್ಜರಿ",
      te: "న్యూరో శస్త్రచికిత్స",
      ar: "جراحة الأعصاب",
      si: "ස්නායු ශල්‍ය",
    },
    about: {
      en: "Neurosurgery is the surgical specialty concerned with the operative treatment of disorders of the brain, spinal cord, peripheral nerves and cerebrovascular system. Neurosurgeons operate on brain tumours, cerebral aneurysms, arteriovenous malformations (AVMs), hydrocephalus, epilepsy, movement disorders (Parkinson's), trigeminal neuralgia, spinal disc disease, spinal cord tumours and traumatic brain injuries. India has internationally trained neurosurgeons at top hospitals using neuro-navigation, intraoperative MRI, awake craniotomy and endoscopic techniques to achieve excellent outcomes with minimised risk.",
      hi: "न्यूरोसर्जरी मस्तिष्क, रीढ़ की हड्डी, परिधीय नसों और सेरेब्रोवैस्कुलर प्रणाली के विकारों के शल्य उपचार से संबंधित है। न्यूरोसर्जन मस्तिष्क ट्यूमर, सेरेब्रल एन्यूरिज्म, हाइड्रोसेफेलस, मिर्गी और स्पाइनल डिस्क रोग पर ऑपरेशन करते हैं।",
    },
    procedures: [
      "Craniotomy for Brain Tumour",
      "Cerebral Aneurysm Clipping / Coiling",
      "Deep Brain Stimulation (DBS)",
      "Endoscopic Third Ventriculostomy (ETV)",
      "Spinal Disc Microdiscectomy",
      "Spinal Cord Tumour Resection",
      "VP Shunt for Hydrocephalus",
    ],
  },

  "spine-surgery": {
    names: {
      en: "Spine Surgery",
      hi: "रीढ़ की हड्डी की शल्य चिकित्सा",
      mr: "मणक्याची शस्त्रक्रिया",
      ta: "முதுகுத்தண்டு அறுவை சிகிச்சை",
      bn: "মেরুদণ্ড অস্ত্রোপচার",
      ml: "നട്ടെല്ല് ശസ്ത്രക്രിയ",
      kn: "ಬೆನ್ನೆಲುಬು ಶಸ್ತ್ರಚಿಕಿತ್ಸೆ",
      te: "వెన్నెముక శస్త్రచికిత్స",
      ar: "جراحة العمود الفقري",
      si: "කොඳු ඇට ශල්‍ය",
    },
    about: {
      en: "Spine surgery addresses disorders of the vertebral column, spinal cord and related structures. Spine surgeons treat herniated discs, spinal stenosis, scoliosis, spondylolisthesis, vertebral fractures, spinal tumours and degenerative disc disease. Modern spine surgery emphasises minimally invasive techniques — micro-discectomy, endoscopic spine surgery, MISS (Minimally Invasive Spine Surgery) — which result in smaller incisions, less blood loss and faster recovery compared to open surgery. Robotic-assisted spine surgery is now offered at premium centres in India, improving precision in pedicle screw placement.",
      hi: "स्पाइन सर्जरी रीढ़ की हड्डी के स्तंभ, स्पाइनल कॉर्ड और संबंधित संरचनाओं के विकारों का उपचार करती है। स्पाइन सर्जन हर्नियेटेड डिस्क, स्पाइनल स्टेनोसिस, स्कोलियोसिस और डिजनरेटिव डिस्क रोग का उपचार करते हैं।",
    },
    procedures: [
      "Microdiscectomy",
      "Lumbar / Cervical Spinal Fusion",
      "Laminectomy",
      "Endoscopic Spine Surgery",
      "Vertebral Fracture Fixation",
      "Scoliosis Correction Surgery",
    ],
  },

  "reproductive-medicine-ivf": {
    names: {
      en: "Reproductive Medicine & IVF",
      hi: "प्रजनन चिकित्सा और IVF",
      mr: "पुनरुत्पादक औषध व IVF",
      ta: "மகப்பேறு மருத்துவம் & IVF",
      bn: "প্রজনন চিকিৎসা ও IVF",
      ml: "പ്രത്യുൽപ്പാദന ചികിത്സ & IVF",
      kn: "ಸಂತಾನ ಚಿಕಿತ್ಸೆ & IVF",
      te: "పునరుత్పత్తి వైద్యం & IVF",
      ar: "طب الإنجاب وأطفال الأنابيب",
      si: "ප්‍රජනන වෛද්‍ය & IVF",
    },
    about: {
      en: "Reproductive medicine focuses on the prevention, diagnosis and management of reproductive problems, with the goal of helping people conceive and carry successful pregnancies. Treatments range from ovulation induction and intrauterine insemination (IUI) to in vitro fertilisation (IVF), intracytoplasmic sperm injection (ICSI), egg/embryo freezing (cryopreservation) and surrogacy programmes. India is a leading global destination for affordable IVF, with success rates comparable to Western centres. IVF clinics in major Indian cities are accredited and equipped with world-class embryology laboratories.",
      hi: "प्रजनन चिकित्सा प्रजनन समस्याओं की रोकथाम, निदान और प्रबंधन पर केंद्रित है। IUI, IVF, ICSI, भ्रूण क्रायोप्रिजर्वेशन और सरोगेसी उपलब्ध उपचार में शामिल हैं। भारत में किफायती IVF उपलब्ध है जिसकी सफलता दर विश्व स्तरीय है।",
    },
    procedures: [
      "IVF (In Vitro Fertilisation)",
      "ICSI (Intracytoplasmic Sperm Injection)",
      "IUI (Intrauterine Insemination)",
      "Ovulation Induction",
      "Egg / Embryo Freezing (Cryopreservation)",
      "Embryo Transfer",
      "Preimplantation Genetic Testing (PGT)",
    ],
  },

  "plastic-reconstructive-surgery": {
    names: {
      en: "Plastic & Reconstructive Surgery",
      hi: "प्लास्टिक और पुनर्निर्माण शल्य चिकित्सा",
      mr: "प्लास्टिक व पुनर्रचनात्मक शस्त्रक्रिया",
      ta: "பிளாஸ்டிக் & மறுகட்டமைப்பு அறுவை சிகிச்சை",
      bn: "প্লাস্টিক ও পুনর্নির্মাণ সার্জারি",
      ml: "പ്ലാസ്റ്റിക് & പുനർനിർമ്മാണ ശസ്ത്രക്രിയ",
      kn: "ಪ್ಲಾಸ್ಟಿಕ್ ಮತ್ತು ಪುನರ್ನಿರ್ಮಾಣ ಶಸ್ತ್ರಚಿಕಿತ್ಸೆ",
      te: "ప్లాస్టిక్ & పునర్నిర్మాణ శస్త్రచికిత్స",
      ar: "الجراحة التجميلية والترميمية",
      si: "ප්ලාස්ටික් & ප්‍රතිසංස්කරණ ශල්‍ය",
    },
    about: {
      en: "Plastic and reconstructive surgery restores form and function to the body following trauma, cancer surgery, burns or congenital abnormalities — while also encompassing cosmetic surgical procedures. Reconstructive procedures include breast reconstruction after mastectomy, cleft lip and palate repair, skin grafts for burns, flap surgeries and microsurgical limb reconstruction. Cosmetic procedures include rhinoplasty, facelifts, blepharoplasty, breast augmentation/reduction, liposuction, tummy tuck and body contouring. India's plastic and aesthetic surgery centres offer internationally trained surgeons and accredited facilities at significantly lower costs.",
      hi: "प्लास्टिक और पुनर्निर्माण सर्जरी आघात, कैंसर सर्जरी, जलन या जन्मजात असामान्यताओं के बाद शरीर को रूप और कार्य देती है। इसमें राइनोप्लास्टी, ब्रेस्ट सर्जरी, लिपोसक्शन और बर्न्स की स्किन ग्राफ्टिंग शामिल हैं।",
    },
    procedures: [
      "Rhinoplasty (Nose Job)",
      "Liposuction & Body Contouring",
      "Breast Augmentation / Reduction",
      "Abdominoplasty (Tummy Tuck)",
      "Cleft Lip & Palate Repair",
      "Skin Grafting for Burns",
      "Microsurgical Reconstruction",
    ],
  },

  "vascular-surgery": {
    names: {
      en: "Vascular Surgery",
      hi: "रक्त वाहिका शल्य चिकित्सा",
      mr: "रक्तवाहिनी शस्त्रक्रिया",
      ta: "இரத்தக்குழாய் அறுவை சிகிச்சை",
      bn: "ভাস্কুলার সার্জারি",
      ml: "രക്തക്കുഴൽ ശസ്ത്രക്രിയ",
      kn: "ರಕ್ತನಾಳ ಶಸ್ತ್ರಚಿಕಿತ್ಸೆ",
      te: "రక్తనాళ శస్త్రచికిత్స",
      ar: "جراحة الأوعية الدموية",
      si: "රුධිර නාල ශල්‍ය",
    },
    about: {
      en: "Vascular surgery involves the operative and endovascular management of diseases of the arteries, veins and lymphatic system (outside the heart and brain). Vascular surgeons treat peripheral arterial disease (PAD), abdominal aortic aneurysms (AAA), carotid artery disease, deep vein thrombosis (DVT), varicose veins, diabetic foot disease and renal artery disease. Minimally invasive endovascular techniques — stenting, angioplasty, EVAR — have become the gold standard for many conditions, reducing recovery time and complications significantly.",
      hi: "वैस्कुलर सर्जरी में धमनियों, नसों और लसीका प्रणाली के रोगों का शल्य और एंडोवास्कुलर प्रबंधन शामिल है। वैस्कुलर सर्जन परिधीय धमनी रोग, महाधमनी एन्यूरिज्म, वैरिकोज वेन्स और डायबिटिक फुट का उपचार करते हैं।",
    },
    procedures: [
      "Aortic Aneurysm Repair (Open / EVAR)",
      "Carotid Endarterectomy",
      "Peripheral Arterial Bypass Surgery",
      "Varicose Vein Surgery (EVLT / RF Ablation)",
      "AV Fistula Creation for Dialysis",
      "Endovascular Stenting",
    ],
  },

  "hepatology": {
    names: {
      en: "Hepatology (Liver Diseases)",
      hi: "यकृत रोग विज्ञान",
      mr: "यकृतशास्त्र",
      ta: "கல்லீரல் நோயியல்",
      bn: "হেপাটোলজি",
      ml: "കരൾ രോഗ ചികിത்স",
      kn: "ಯಕೃತ್ತು ವಿಜ್ಞಾನ",
      te: "కాలేయ వైద్యం",
      ar: "أمراض الكبد",
      si: "අක්මා රෝග",
    },
    about: {
      en: "Hepatology is the branch of gastroenterology focusing exclusively on the liver, gallbladder, biliary tree and pancreas. Hepatologists diagnose and treat viral hepatitis (Hepatitis B & C), alcoholic liver disease, non-alcoholic fatty liver disease (NAFLD), liver cirrhosis, hepatocellular carcinoma (liver cancer), autoimmune liver diseases and biliary disorders. India carries a high burden of Hepatitis B and C — effective antiviral therapies are now available that can cure Hepatitis C in over 95% of patients. Advanced liver transplant programmes are available at leading hospitals in Delhi, Mumbai, Chennai and Hyderabad.",
      hi: "हेपेटोलॉजी यकृत, पित्ताशय और अग्न्याशय पर केंद्रित गैस्ट्रोएंटरोलॉजी की शाखा है। हेपेटोलॉजिस्ट वायरल हेपेटाइटिस, फैटी लिवर, लिवर सिरोसिस और लिवर कैंसर का उपचार करते हैं।",
    },
    procedures: [
      "Liver Biopsy",
      "Fibroscan (Liver Stiffness Assessment)",
      "TIPS (Transjugular Intrahepatic Portosystemic Shunt)",
      "Paracentesis (Ascites Drainage)",
      "Antiviral Therapy for Hepatitis B & C",
      "Liver Transplant Evaluation",
    ],
  },

  // ─── TREATMENTS ──────────────────────────────────────────────────────────

  "knee-replacement": {
    names: {
      en: "Knee Replacement",
      hi: "घुटना प्रत्यारोपण",
      mr: "गुडघा प्रत्यारोपण",
      ta: "முழங்கால் மாற்று அறுவை",
      bn: "হাঁটু প্রতিস্থাপন",
      ml: "മുട്ട് മാറ്റ ശസ്ത്രക്രിয",
      kn: "ಮೊಣಕಾಲು ಬದಲಾವಣೆ",
      te: "మోకాలు భర్తీ",
      ar: "استبدال الركبة",
      si: "දණහිස් ශල්‍ය",
    },
    about: {
      en: "Total knee replacement (TKR), also called total knee arthroplasty, is a surgical procedure to resurface a knee damaged by severe arthritis or injury. The surgeon removes damaged bone and cartilage and replaces it with a metal and plastic implant that mimics the natural knee joint's shape and movement. It is one of the most successful orthopaedic surgeries, dramatically reducing pain and restoring mobility. Modern implants last 15–20+ years. India offers world-class knee replacement at costs 60–80% lower than the US or UK, with NABH-accredited hospitals achieving excellent outcomes. Robotic-assisted and computer-navigated techniques are now available at leading centres for improved implant positioning.",
      hi: "टोटल नी रिप्लेसमेंट (TKR) एक शल्य प्रक्रिया है जो गंभीर गठिया या चोट से क्षतिग्रस्त घुटने को फिर से सतह देती है। सर्जन क्षतिग्रस्त हड्डी और उपास्थि को हटाकर धातु और प्लास्टिक इम्प्लांट से बदल देता है। भारत में यह सर्जरी विश्व स्तरीय गुणवत्ता के साथ अमेरिका-यूके की तुलना में 60-80% कम लागत पर उपलब्ध है।",
    },
    procedures: [
      "Total Knee Replacement (TKR)",
      "Unicompartmental (Partial) Knee Replacement",
      "Robotic-Assisted Knee Replacement",
      "Knee Arthroscopy",
      "Revision Knee Replacement",
    ],
  },

  "hip-replacement": {
    names: {
      en: "Hip Replacement",
      hi: "कूल्हा प्रत्यारोपण",
      mr: "नितंब प्रत्यारोपण",
      ta: "இடுப்பு மாற்று அறுவை",
      bn: "নিতম্ব প্রতিস্থাপন",
      ml: "ഇടുപ്പ് മാറ്റ ശസ്ത്രക്രിയ",
      kn: "ತೊಡೆಸಂದಿ ಬದಲಾವಣೆ",
      te: "నడుము భర్తీ",
      ar: "استبدال الورك",
      si: " උකුල් ශල්‍ය",
    },
    about: {
      en: "Hip replacement (total hip arthroplasty) involves removing damaged hip joint components and replacing them with a prosthetic implant. It is primarily performed for severe hip arthritis, hip fracture, avascular necrosis of the femoral head or other debilitating hip conditions. The procedure relieves pain, restores mobility and significantly improves quality of life. Minimally invasive approaches and anterior hip replacement techniques reduce recovery time. India's orthopaedic hospitals perform thousands of hip replacements annually with implants from top international manufacturers.",
      hi: "हिप रिप्लेसमेंट (टोटल हिप आर्थ्रोप्लास्टी) में क्षतिग्रस्त कूल्हे के जोड़ के घटकों को हटाकर प्रोस्थेटिक इम्प्लांट से बदला जाता है। यह गंभीर हिप आर्थराइटिस, हिप फ्रैक्चर और फेमोरल हेड के एवस्कुलर नेक्रोसिस के लिए किया जाता है।",
    },
    procedures: [
      "Total Hip Replacement (THR)",
      "Partial Hip Replacement (Hemiarthroplasty)",
      "Minimally Invasive Hip Replacement",
      "Revision Hip Replacement",
      "Hip Resurfacing",
    ],
  },

  "dialysis": {
    names: {
      en: "Dialysis",
      hi: "डायलिसिस",
      mr: "डायलिसिस",
      ta: "டயாலிசிஸ்",
      bn: "ডায়ালিসিস",
      ml: "ഡയാലിസിസ്",
      kn: "ಡಯಾಲಿಸಿಸ್",
      te: "డయాలసిస్",
      ar: "غسيل الكلى",
      si: "ඩයාලිසිස්",
    },
    about: {
      en: "Dialysis is a life-sustaining treatment that performs the kidneys' functions when they fail — removing waste products, excess fluid and toxins from the blood. There are two main types: haemodialysis (HD), where blood is filtered through a machine outside the body, and peritoneal dialysis (PD), which uses the lining of the abdomen as a natural filter. Most haemodialysis patients require sessions 3 times a week, typically 4 hours each. While dialysis manages kidney failure, kidney transplantation is the definitive long-term treatment. India has an extensive network of dialysis centres — both in hospitals and as standalone facilities — making care accessible across cities and towns.",
      hi: "डायलिसिस एक जीवन-रक्षक उपचार है जो गुर्दे विफल होने पर उनके कार्य करता है — रक्त से अपशिष्ट उत्पाद, अतिरिक्त तरल और विषाक्त पदार्थों को हटाना। हेमोडायलिसिस और पेरिटोनियल डायलिसिस दो मुख्य प्रकार हैं। भारत में व्यापक डायलिसिस केंद्र नेटवर्क उपलब्ध है।",
    },
    procedures: [
      "Haemodialysis (HD)",
      "Peritoneal Dialysis (CAPD / APD)",
      "AV Fistula Creation for Dialysis Access",
      "Temporary Dialysis Catheter Insertion",
    ],
  },

  "bariatric-weight-loss-surgery": {
    names: {
      en: "Bariatric Weight Loss Surgery",
      hi: "बेरिएट्रिक वजन घटाने की सर्जरी",
      mr: "बेरिएट्रिक वजन कमी शस्त्रक्रिया",
      ta: "உடல் பருமன் அறுவை சிகிச்சை",
      bn: "ব্যারিয়াট্রিক ওজন কমানোর সার্জারি",
      ml: "ബാരിയാട്രിക് ശസ്ത്രക്രിയ",
      kn: "ಬಾರಿಯಾಟ್ರಿಕ್ ಶಸ್ತ್ರಚಿಕಿತ್ಸೆ",
      te: "బేరియాట్రిక్ శస్త్రచికిత్స",
      ar: "جراحة السمنة",
      si: "බේරියාට්‍රික් ශල්‍ය",
    },
    about: {
      en: "Bariatric surgery comprises a group of procedures for weight loss in people with severe obesity (BMI ≥ 40, or ≥ 35 with serious co-morbidities). By reducing the size of the stomach and/or altering the digestive tract, bariatric surgery achieves dramatic, sustained weight loss and often resolves obesity-related conditions including Type 2 diabetes, hypertension, sleep apnoea and joint pain. The most common procedures are sleeve gastrectomy, Roux-en-Y gastric bypass and laparoscopic adjustable gastric banding. Most are performed laparoscopically (keyhole surgery) with minimal scarring and faster recovery. India is a top destination for bariatric surgery with skilled surgeons and costs 40–60% lower than Western nations.",
      hi: "बेरिएट्रिक सर्जरी गंभीर मोटापे वाले लोगों में वजन घटाने के लिए प्रक्रियाओं का एक समूह है। स्लीव गैस्ट्रेक्टोमी, गैस्ट्रिक बाईपास और गैस्ट्रिक बैंडिंग सामान्य प्रक्रियाएं हैं। यह टाइप 2 डायबिटीज, हाइपरटेंशन और स्लीप एप्निया जैसी बीमारियों को भी ठीक करती है।",
    },
    procedures: [
      "Sleeve Gastrectomy",
      "Roux-en-Y Gastric Bypass",
      "Laparoscopic Adjustable Gastric Banding",
      "Mini Gastric Bypass (MGB)",
      "Duodenal Switch",
    ],
  },

  "liver-transplant": {
    names: {
      en: "Liver Transplant",
      hi: "यकृत प्रत्यारोपण",
      mr: "यकृत प्रत्यारोपण",
      ta: "கல்லீரல் மாற்று அறுவை",
      bn: "লিভার ট্রান্সপ্ল্যান্ট",
      ml: "കരൾ മാറ്റ ശസ്ത്രക്രിയ",
      kn: "ಯಕೃತ್ ಕಸಿ",
      te: "కాలేయ మార్పిడి",
      ar: "زراعة الكبد",
      si: "අක්මා බද්ධ",
    },
    about: {
      en: "Liver transplantation is the surgical replacement of a diseased liver with a healthy donor liver — either a whole liver from a deceased donor or a portion from a living donor (living donor liver transplant, LDLT). Indications include end-stage liver cirrhosis (from any cause), acute liver failure, hepatocellular carcinoma (within Milan criteria) and certain metabolic liver diseases. India has emerged as a world leader in LDLT, with programmes at leading hospitals in Chennai, Hyderabad, Mumbai and Delhi achieving outcomes comparable to the best international centres. Post-transplant, patients require lifelong immunosuppression and regular follow-up.",
      hi: "लिवर ट्रांसप्लांटेशन एक रोगग्रस्त यकृत को स्वस्थ दाता यकृत से शल्य प्रतिस्थापन है। लिविंग डोनर लिवर ट्रांसप्लांट (LDLT) में भारत विश्व नेता है। चेन्नई, हैदराबाद, मुंबई और दिल्ली में शीर्ष कार्यक्रम विश्व स्तरीय परिणाम देते हैं।",
    },
    procedures: [
      "Living Donor Liver Transplant (LDLT)",
      "Deceased Donor Liver Transplant",
      "Pre-Transplant Liver Evaluation",
      "Post-Transplant Immunosuppression Management",
    ],
  },

  "kidney-transplant": {
    names: {
      en: "Kidney Transplant",
      hi: "गुर्दा प्रत्यारोपण",
      mr: "मूत्रपिंड प्रत्यारोपण",
      ta: "சிறுநீரக மாற்று அறுவை",
      bn: "কিডনি ট্রান্সপ্ল্যান্ট",
      ml: "വൃക്ക മാറ്റ ശസ്ത്രക്രിയ",
      kn: "ಮೂತ್ರಪಿಂಡ ಕಸಿ",
      te: "మూత్రపిండ మార్పిడి",
      ar: "زراعة الكلى",
      si: "වකුගඩු බද්ධ",
    },
    about: {
      en: "Kidney transplantation is the gold-standard treatment for end-stage renal disease (ESRD) — it provides better quality of life, longer survival and lower long-term cost compared to dialysis. A healthy kidney from a living or deceased donor is surgically placed in the lower abdomen, where it takes over the function of the failed kidneys. India performs thousands of kidney transplants annually with excellent short- and long-term outcomes. The country has strong programmes for both living-donor and deceased-donor transplants, with waiting time significantly shorter than in many Western countries for living-donor cases.",
      hi: "किडनी ट्रांसप्लांटेशन एंड-स्टेज रीनल डिजीज के लिए सर्वश्रेष्ठ उपचार है। यह डायलिसिस की तुलना में बेहतर जीवन गुणवत्ता, लंबा जीवन और कम दीर्घकालिक लागत प्रदान करता है। भारत में हजारों किडनी ट्रांसप्लांट वार्षिक रूप से उत्कृष्ट परिणामों के साथ किए जाते हैं।",
    },
    procedures: [
      "Living Donor Kidney Transplant",
      "Deceased Donor Kidney Transplant",
      "Laparoscopic Donor Nephrectomy",
      "ABO-Incompatible Kidney Transplant",
    ],
  },

  "bone-marrow-transplant": {
    names: {
      en: "Bone Marrow Transplant",
      hi: "अस्थि मज्जा प्रत्यारोपण",
      mr: "अस्थिमज्जा प्रत्यारोपण",
      ta: "எலும்பு மஜ்ஜை மாற்று அறுவை",
      bn: "অস্থি মজ্জা প্রতিস্থাপন",
      ml: "ബോൺ മാരോ ട്രാൻസ്പ്ലാന്റ്",
      kn: "ಅಸ್ಥಿ ಮಜ್ಜೆ ಕಸಿ",
      te: "ఎముక మూల కణ మార్పిడి",
      ar: "زراعة نخاع العظم",
      si: "ඇටමිදුළු බද්ධ",
    },
    about: {
      en: "Bone marrow transplant (BMT), now more accurately called haematopoietic stem cell transplant (HSCT), replaces diseased bone marrow with healthy stem cells that can regenerate a functioning blood and immune system. It is used to treat blood cancers (leukaemia, lymphoma, multiple myeloma), aplastic anaemia, thalassaemia, sickle cell disease and certain immune deficiency disorders. Types include autologous (using patient's own stem cells) and allogeneic (using a matched donor's cells). India has developed centres of excellence for BMT in cities like Mumbai, Delhi, Chennai, Bengaluru and Hyderabad, with internationally comparable outcomes.",
      hi: "बोन मैरो ट्रांसप्लांट (BMT) रोगग्रस्त अस्थि मज्जा को स्वस्थ स्टेम सेल से बदलता है। यह ल्यूकेमिया, लिम्फोमा, अप्लास्टिक एनीमिया, थैलेसीमिया और सिकल सेल रोग के उपचार के लिए उपयोग किया जाता है।",
    },
    procedures: [
      "Autologous Stem Cell Transplant",
      "Allogeneic Bone Marrow Transplant",
      "Haploidentical Transplant",
      "Peripheral Blood Stem Cell Collection",
    ],
  },

  "ivf-in-vitro-fertilisation": {
    names: {
      en: "IVF & Fertility Treatment",
      hi: "IVF और प्रजनन उपचार",
      mr: "IVF व प्रजनन उपचार",
      ta: "IVF & மலட்டுத்தன்மை சிகிச்சை",
      bn: "IVF ও বন্ধ্যাত্ব চিকিৎসা",
      ml: "IVF & ഫെർടിലിറ്റി ചികിത്സ",
      kn: "IVF & ಫಲಿತಾಂಶ ಚಿಕಿತ್ಸೆ",
      te: "IVF & సంతాన చికిత్స",
      ar: "أطفال الأنابيب وعلاج العقم",
      si: "IVF & ප්‍රජනන ප්‍රතිකාරය",
    },
    about: {
      en: "In vitro fertilisation (IVF) is an assisted reproductive technology (ART) where eggs are fertilised outside the body in a laboratory, and the resulting embryo(s) are transferred to the uterus. IVF and related treatments help couples and individuals facing infertility due to blocked tubes, low sperm count, unexplained infertility, advanced maternal age, endometriosis or other factors. With continuous advances in embryology, genetic testing (PGT-A) and cryopreservation, IVF success rates have steadily improved. India offers world-class IVF at 30–50% lower costs than the US or Europe, with centres in Mumbai, Delhi, Chennai, Hyderabad and Bengaluru ranked among the best in Asia.",
      hi: "इन विट्रो फर्टिलाइजेशन (IVF) में अंडे को प्रयोगशाला में शरीर के बाहर निषेचित किया जाता है और परिणामी भ्रूण को गर्भाशय में स्थानांतरित किया जाता है। भारत में किफायती और विश्व स्तरीय IVF उपलब्ध है।",
    },
    procedures: [
      "IVF (In Vitro Fertilisation)",
      "ICSI (Intracytoplasmic Sperm Injection)",
      "IUI (Intrauterine Insemination)",
      "Frozen Embryo Transfer (FET)",
      "Preimplantation Genetic Testing (PGT-A)",
      "Egg Freezing (Oocyte Cryopreservation)",
    ],
  },

  "bypass-surgery-cabg": {
    names: {
      en: "Coronary Bypass Surgery (CABG)",
      hi: "कोरोनरी बाईपास सर्जरी (CABG)",
      mr: "कोरोनरी बायपास शस्त्रक्रिया (CABG)",
      ta: "இதய கட்டு அறுவை சிகிச்சை (CABG)",
      bn: "করোনারি বাইপাস সার্জারি (CABG)",
      ml: "കൊറോണറി ബൈപ്പാസ് ശസ്ത്രക്രിയ",
      kn: "ಕೊರೊನರಿ ಬೈಪಾಸ್ ಶಸ್ತ್ರಚಿಕಿತ್ಸೆ",
      te: "కరోనరీ బైపాస్ శస్త్రచికిత్స",
      ar: "جراحة القلب المفتوح (CABG)",
      si: "කරොනරි බයිපාස් ශල්‍ය (CABG)",
    },
    about: {
      en: "Coronary artery bypass graft (CABG) surgery is a procedure to improve blood flow to the heart by creating new pathways around blocked or narrowed coronary arteries using blood vessels (grafts) taken from other parts of the body (typically the internal mammary artery and saphenous vein). CABG is recommended for significant multi-vessel coronary artery disease, especially when angioplasty is not feasible or has failed. It relieves angina, reduces the risk of heart attacks and improves long-term survival. India performs thousands of CABG surgeries annually, with outcomes at top cardiac centres matching international standards at a fraction of the cost.",
      hi: "कोरोनरी आर्टरी बाईपास ग्राफ्ट (CABG) सर्जरी अवरुद्ध या संकुचित कोरोनरी धमनियों के चारों ओर नए मार्ग बनाकर हृदय में रक्त प्रवाह को बेहतर बनाती है। यह मल्टी-वेसेल कोरोनरी आर्टरी डिजीज के लिए अनुशंसित है।",
    },
    procedures: [
      "On-pump CABG (Traditional Open Heart)",
      "Off-pump CABG (Beating Heart Surgery)",
      "Minimally Invasive CABG (MIDCAB)",
      "Robotic-Assisted CABG",
    ],
  },

  "angioplasty-stenting": {
    names: {
      en: "Angioplasty / PTCA",
      hi: "एंजियोप्लास्टी / PTCA",
      mr: "एंजियोप्लास्टी / PTCA",
      ta: "ஆஞ்சியோபிளாஸ்டி / PTCA",
      bn: "অ্যাঞ্জিওপ্লাস্টি / PTCA",
      ml: "ആഞ്ചിയോപ്ലാസ്റ്റി",
      kn: "ಆಂಜಿಯೋಪ್ಲಾಸ್ಟಿ",
      te: "ఆంజియోప్లాస్టీ",
      ar: "رأب الأوعية التاجية",
      si: "ඇන්ජියොප්ලාස්ටි",
    },
    about: {
      en: "Percutaneous transluminal coronary angioplasty (PTCA), commonly called coronary angioplasty, is a minimally invasive procedure to open blocked or narrowed coronary arteries caused by atherosclerosis. A small balloon catheter is inserted through the groin or wrist, guided to the blockage, inflated to widen the artery, and a stent (metal mesh tube) is often placed to keep the artery open. It is a day-care or short-stay procedure with rapid recovery. Drug-eluting stents (DES) have significantly reduced re-blockage rates. Angioplasty is a first-choice treatment for heart attacks (primary PCI) and stable angina with significant blockages.",
      hi: "पर्क्यूटेनियस ट्रांसल्यूमिनल कोरोनरी एंजियोप्लास्टी (PTCA) एक न्यूनतम आक्रामक प्रक्रिया है जो अवरुद्ध या संकुचित कोरोनरी धमनियों को खोलती है। इसमें गुब्बारे वाले कैथेटर और स्टेंट का उपयोग किया जाता है।",
    },
    procedures: [
      "Primary PTCA (Emergency Heart Attack)",
      "Elective Coronary Angioplasty",
      "Drug-Eluting Stent (DES) Placement",
      "Rotablation (for Calcified Lesions)",
    ],
  },

  "cataract-surgery": {
    names: {
      en: "Cataract Surgery",
      hi: "मोतियाबिंद शल्य चिकित्सा",
      mr: "मोतीबिंदू शस्त्रक्रिया",
      ta: "கண் புரை அறுவை சிகிச்சை",
      bn: "ছানি অপারেশন",
      ml: "തിമിര ശസ്ത്രക്രിയ",
      kn: "ಕಾಟರ್ ಶಸ್ತ್ರಚಿಕಿತ್ಸೆ",
      te: "కంటి పొర శస్త్రచికిత్స",
      ar: "جراحة إزالة الساد",
      si: "ඇසේ සේදුම ශල්‍ය",
    },
    about: {
      en: "Cataract surgery is the removal of the natural lens of the eye when it becomes clouded (cataract), significantly impairing vision. The lens is replaced with an artificial intraocular lens (IOL). Phacoemulsification — where ultrasound energy breaks up the cataract for removal through a tiny incision — is the modern standard technique. Premium IOLs including multifocal, trifocal and toric lenses can correct refractive errors simultaneously, often eliminating the need for glasses. India is the world leader in cataract surgery volume, performing over 7 million procedures annually with excellent safety profiles and extremely affordable costs — even for premium IOL options.",
      hi: "मोतियाबिंद सर्जरी आंख के प्राकृतिक लेंस को हटाने की प्रक्रिया है जब यह धुंधला हो जाता है। इसे कृत्रिम इंट्राओकुलर लेंस (IOL) से बदला जाता है। भारत प्रतिवर्ष 70 लाख से अधिक मोतियाबिंद सर्जरी करता है।",
    },
    procedures: [
      "Phacoemulsification (Standard)",
      "Micro-incision Cataract Surgery (MICS)",
      "Femtosecond Laser-Assisted Cataract Surgery (FLACS)",
      "Multifocal / Trifocal IOL Implantation",
    ],
  },

  "deep-brain-stimulation": {
    names: {
      en: "Deep Brain Stimulation (DBS)",
      hi: "डीप ब्रेन स्टिमुलेशन (DBS)",
      mr: "डीप ब्रेन स्टिम्युलेशन",
      ta: "ஆழமான மூளை தூண்டுதல்",
      bn: "ডিপ ব্রেইন স্টিমুলেশন",
      ml: "ഡീപ് ബ്രെയിൻ സ്റ്റിമുലേഷൻ",
      kn: "ಡೀಪ್ ಬ್ರೈನ್ ಸ್ಟಿಮ್ಯುಲೇಷನ್",
      te: "డీప్ బ్రెయిన్ స్టిమ్యులేషన్",
      ar: "التحفيز العميق للدماغ",
      si: "ගැඹුරු මොළ උත්තේජනය",
    },
    about: {
      en: "Deep brain stimulation (DBS) is a neurosurgical procedure where electrodes are implanted into specific targets in the brain and connected to a neurostimulator device (like a pacemaker) implanted under the skin. It is the most effective surgical treatment for advanced Parkinson's disease — dramatically improving tremors, rigidity, slowness and fluctuations in medication response. DBS is also used for essential tremor, dystonia, OCD and refractory epilepsy. The procedure requires an experienced multidisciplinary team including neurologists, neurosurgeons and neuropsychologists. Select Indian hospitals now offer DBS with outcomes matching international standards.",
      hi: "डीप ब्रेन स्टिमुलेशन (DBS) एक न्यूरोसर्जिकल प्रक्रिया है जहां मस्तिष्क के विशिष्ट लक्ष्यों में इलेक्ट्रोड प्रत्यारोपित किए जाते हैं। यह उन्नत पार्किंसन रोग, आवश्यक कंपकंपी और डिस्टोनिया का सबसे प्रभावी शल्य उपचार है।",
    },
    procedures: [
      "DBS Lead Implantation (Awake Craniotomy)",
      "Neurostimulator Device Implantation",
      "DBS Programming & Optimisation",
    ],
  },

  "cochlear-implant": {
    names: {
      en: "Cochlear Implant",
      hi: "कॉक्लियर इम्प्लांट",
      mr: "कॉक्लियर इम्प्लांट",
      ta: "கோக்லியர் இம்பிளான்ட்",
      bn: "কক্লিয়ার ইমপ্লান্ট",
      ml: "കോക്ലിയർ ഇംപ്ലാന്റ്",
      kn: "ಕಾಕ್ಲಿಯರ್ ಇಂಪ್ಲಾಂಟ್",
      te: "కాక్లియర్ ఇంప్లాంట్",
      ar: "زراعة القوقعة",
      si: "කොකලේඅර් බද්ධය",
    },
    about: {
      en: "A cochlear implant is an electronic medical device that replaces the function of the damaged inner ear (cochlea). Unlike hearing aids which amplify sound, cochlear implants directly stimulate the auditory nerve, enabling the brain to perceive sound. They are the only medical device that can restore one of the human senses. Cochlear implants are recommended for people with severe to profound sensorineural hearing loss who benefit little from conventional hearing aids — including young children. Early implantation in infants allows normal speech and language development. India has established centres offering cochlear implantation with excellent long-term speech outcomes.",
      hi: "कॉक्लियर इम्प्लांट एक इलेक्ट्रॉनिक चिकित्सा उपकरण है जो क्षतिग्रस्त आंतरिक कान (कोक्लिया) के कार्य को प्रतिस्थापित करता है। यह श्रवण तंत्रिका को सीधे उत्तेजित करता है। गंभीर सेंसोरिन्यूरल श्रवण हानि वाले बच्चों और वयस्कों के लिए प्रभावी है।",
    },
    procedures: [
      "Cochlear Implant Surgery",
      "Post-Operative Activation & Programming",
      "Auditory-Verbal Therapy (AVT)",
    ],
  },

  "chemotherapy": {
    names: {
      en: "Cancer Chemotherapy",
      hi: "कैंसर कीमोथेरेपी",
      mr: "कर्करोग केमोथेरपी",
      ta: "புற்றுநோய் கீமோதெரபி",
      bn: "ক্যান্সার কেমোথেরাপি",
      ml: "കാൻസർ കീമോതെറാപ്പി",
      kn: "ಕ್ಯಾನ್ಸರ್ ಕೀಮೋಥೆರಪಿ",
      te: "కాన్సర్ కీమోథెరపీ",
      ar: "علاج السرطان الكيميائي",
      si: "පිළිකා රසායනික ප්‍රතිකාරය",
    },
    about: {
      en: "Chemotherapy uses drugs that kill or slow the growth of rapidly dividing cancer cells. It is one of the main treatments for cancer, often used in combination with surgery, radiation therapy or immunotherapy. Chemotherapy can be given as the primary treatment, before surgery (neoadjuvant) to shrink a tumour, after surgery (adjuvant) to kill remaining cells, or palliatively to slow growth and relieve symptoms. Modern supportive care has significantly reduced many traditional chemotherapy side effects. Targeted therapy and immunotherapy have transformed treatment of specific cancer types. India's oncology centres provide comprehensive chemotherapy services at costs a fraction of those in Western countries.",
      hi: "कीमोथेरेपी ऐसी दवाओं का उपयोग करती है जो तेजी से विभाजित होने वाली कैंसर कोशिकाओं को मारती या उनकी वृद्धि को धीमी करती हैं। यह सर्जरी, रेडिएशन थेरेपी या इम्यूनोथेरेपी के साथ संयोजन में उपयोग की जाती है।",
    },
    procedures: [
      "Intravenous Chemotherapy (IV Chemo)",
      "Oral Targeted Therapy",
      "Immunotherapy (Checkpoint Inhibitors)",
      "Intrathecal Chemotherapy",
      "HIPEC (Hyperthermic Intraperitoneal Chemotherapy)",
    ],
  },

  "lasik-eye-surgery": {
    names: {
      en: "LASIK Eye Surgery",
      hi: "लेसिक नेत्र शल्य चिकित्सा",
      mr: "लेसिक नेत्र शस्त्रक्रिया",
      ta: "லேசிக் கண் அறுவை சிகிச்சை",
      bn: "লেসিক চোখের অস্ত্রোপচার",
      ml: "ലേസിക് ശസ്ത്രക്രിയ",
      kn: "ಲೇಸಿಕ್ ಶಸ್ತ್ರಚಿಕಿತ್ಸೆ",
      te: "లాసిక్ కంటి శస్త్రచికిత్స",
      ar: "جراحة الليزك للعين",
      si: "ලේසික් ඇස් ශල්‍ය",
    },
    about: {
      en: "LASIK (Laser-Assisted In Situ Keratomileusis) is a refractive surgery that corrects myopia (short-sightedness), hyperopia (long-sightedness) and astigmatism by reshaping the cornea using an excimer laser. Most patients achieve 20/20 vision or better, eliminating or greatly reducing dependence on spectacles or contact lenses. The procedure takes about 15 minutes per eye and recovery is rapid. Newer variants include LASIK, SMILE (Small Incision Lenticule Extraction), PRK and LASEK. India has modern excimer laser platforms (WaveLight, VisX, Contoura) available at leading eye hospitals at affordable costs.",
      hi: "LASIK एक अपवर्तक शल्य चिकित्सा है जो एक्सिमर लेजर का उपयोग करके कॉर्निया को आकार देकर मायोपिया, हाइपरोपिया और दृष्टिवैषम्य को ठीक करती है। अधिकांश मरीज चश्मे या कॉन्टैक्ट लेंस से मुक्ति पाते हैं।",
    },
    procedures: [
      "LASIK",
      "SMILE (Small Incision Lenticule Extraction)",
      "PRK / LASEK / Trans-PRK",
      "Contoura Vision (Topography-Guided LASIK)",
    ],
  },

  "hair-transplant": {
    names: {
      en: "Hair Transplant",
      hi: "बाल प्रत्यारोपण",
      mr: "केस प्रत्यारोपण",
      ta: "முடி மாற்று அறுவை",
      bn: "চুল প্রতিস্থাপন",
      ml: "ഹെയർ ട്രാൻസ്പ്ലാന്റ്",
      kn: "ಕೂದಲು ಕಸಿ",
      te: "జుట్టు మార్పిడి",
      ar: "زراعة الشعر",
      si: "හිසකෙස් බද්ධ",
    },
    about: {
      en: "Hair transplant surgery moves hair follicles from a donor area (typically the back or sides of the scalp) to areas of hair loss (recipient area). The two main techniques are Follicular Unit Extraction (FUE) and Follicular Unit Transplantation (FUT/strip). FUE is minimally invasive with no linear scar. Results are permanent as the transplanted hair is genetically resistant to balding hormones. PRP (platelet-rich plasma) injections are often combined with transplants to enhance results and accelerate healing. India has a rapidly growing hair transplant industry with highly experienced surgeons and costs significantly lower than Western markets.",
      hi: "हेयर ट्रांसप्लांट सर्जरी दाता क्षेत्र से बालों के रोम को बालों के झड़ने वाले क्षेत्रों में स्थानांतरित करती है। FUE (फॉलिक्युलर यूनिट एक्सट्रैक्शन) आधुनिक न्यूनतम आक्रामक तकनीक है।",
    },
    procedures: [
      "FUE Hair Transplant",
      "FUT (Strip) Hair Transplant",
      "PRP for Hair Loss",
      "Beard / Eyebrow Transplant",
    ],
  },

  "diabetes-management": {
    names: {
      en: "Diabetes Management",
      hi: "मधुमेह प्रबंधन",
      mr: "मधुमेह व्यवस्थापन",
      ta: "நீரிழிவு மேலாண்மை",
      bn: "ডায়াবেটিস ব্যবস্থাপনা",
      ml: "പ്രമേഹ ചികിത്സ",
      kn: "ಮಧುಮೇಹ ನಿರ್ವಹಣೆ",
      te: "మధుమేహ నిర్వహణ",
      ar: "إدارة السكري",
      si: "දියවැඩියා කළමනාකරණය",
    },
    about: {
      en: "Diabetes mellitus is a chronic metabolic disease characterised by elevated blood glucose due to insufficient insulin production or insulin resistance. India has the second-largest diabetic population in the world — over 77 million people. Comprehensive diabetes management includes lifestyle modification (diet and exercise), blood glucose monitoring, oral medications, insulin therapy, and management of complications like diabetic neuropathy, retinopathy, nephropathy, and foot ulcers. Advanced tools such as continuous glucose monitors (CGM) and insulin pumps are now accessible in India. Regular specialist follow-up at a diabetology centre helps prevent complications and maintain quality of life.",
      hi: "मधुमेह एक पुरानी चयापचय बीमारी है जिसमें अपर्याप्त इंसुलिन उत्पादन या इंसुलिन प्रतिरोध के कारण रक्त शर्करा बढ़ जाती है। भारत में 7.7 करोड़ से अधिक मधुमेह रोगी हैं। व्यापक मधुमेह प्रबंधन में जीवनशैली संशोधन, दवाएं और जटिलताओं की रोकथाम शामिल है।",
    },
    procedures: [
      "HbA1c & Blood Glucose Monitoring",
      "Insulin Pump Therapy",
      "Continuous Glucose Monitoring (CGM)",
      "Diabetic Foot Care & Wound Management",
      "Diabetic Retinopathy Screening",
      "Diabetic Kidney Disease Management",
    ],
  },

  "spinal-fusion": {
    names: {
      en: "Spinal Fusion Surgery",
      hi: "स्पाइनल फ्यूजन सर्जरी",
      mr: "मणक्याची फ्युजन शस्त्रक्रिया",
      ta: "முதுகெலும்பு ஒன்றிணைப்பு அறுவை",
      bn: "স্পাইনাল ফিউশন সার্জারি",
      ml: "നട്ടെല്ല് ഫ്യൂഷൻ ശസ്ത്രക്രിയ",
      kn: "ಬೆನ್ನೆಲುಬು ಫ್ಯೂಷನ್",
      te: "వెన్నెముక కలయిక శస్త్రచికిత్స",
      ar: "جراحة اندماج العمود الفقري",
      si: "කොඳු ඇට ශල්‍ය",
    },
    about: {
      en: "Spinal fusion surgery permanently joins two or more vertebrae so they heal into a single bone, eliminating painful motion between them. It is performed for spondylolisthesis, severe degenerative disc disease, spinal stenosis with instability, scoliosis, vertebral fractures and spinal tumours. Modern minimally invasive spinal fusion (MISS) techniques — TLIF, PLIF, ALIF, lateral approaches — result in less muscle damage, reduced blood loss and faster return to activity compared to traditional open surgery. Robotic-assisted spinal fusion improves screw placement accuracy. India's spine centres are equipped for all variants of fusion surgery.",
      hi: "स्पाइनल फ्यूजन सर्जरी दो या अधिक कशेरुकाओं को स्थायी रूप से एक हड्डी में मिला देती है, जिससे उनके बीच दर्दनाक गति समाप्त हो जाती है। यह स्पॉन्डिलोलिस्थेसिस, डिजनरेटिव डिस्क रोग और स्कोलियोसिस के लिए किया जाता है।",
    },
    procedures: [
      "TLIF (Transforaminal Lumbar Interbody Fusion)",
      "PLIF (Posterior Lumbar Interbody Fusion)",
      "ALIF (Anterior Lumbar Interbody Fusion)",
      "Cervical Discectomy & Fusion (ACDF)",
      "Minimally Invasive Spinal Fusion (MISS)",
    ],
  },

  "acl-reconstruction": {
    names: {
      en: "ACL Reconstruction",
      hi: "ACL पुनर्निर्माण",
      mr: "ACL पुनर्रचना",
      ta: "ACL மறுகட்டமைப்பு",
      bn: "ACL পুনর্গঠন",
      ml: "ACL പുനർനിർമ്മാണം",
      kn: "ACL ಪುನರ್ನಿರ್ಮಾಣ",
      te: "ACL పునర్నిర్మాణం",
      ar: "إعادة بناء الرباط الصليبي الأمامي",
      si: "ACL නැවත ශල්‍ය",
    },
    about: {
      en: "ACL (anterior cruciate ligament) reconstruction is a surgical procedure to replace a torn ACL — one of the key ligaments stabilising the knee joint. ACL tears are common sports injuries, often occurring in football, basketball, and other cutting/pivoting sports. Surgery involves replacing the torn ligament with a graft taken from the patient's own hamstring tendon, patellar tendon or a donor tissue (allograft). Arthroscopic technique (keyhole surgery) is standard, with excellent outcomes. Proper physiotherapy rehabilitation for 6–9 months post-surgery is essential for full recovery and return to sport.",
      hi: "ACL पुनर्निर्माण एक शल्य प्रक्रिया है जो फटे हुए ACL को बदलती है — घुटने के जोड़ को स्थिर करने वाले प्रमुख स्नायुबंधन में से एक। यह फुटबॉल, बास्केटबॉल में आम खेल चोट है।",
    },
    procedures: [
      "Arthroscopic ACL Reconstruction",
      "Hamstring Graft Harvest",
      "Patellar Tendon Graft",
      "Post-operative Physiotherapy",
    ],
  },

  "cataract-phacoemulsification": {
    names: {
      en: "Cataract Surgery (Phacoemulsification)",
      hi: "मोतियाबिंद शल्य चिकित्सा",
      mr: "मोतीबिंदू शस्त्रक्रिया",
      ta: "கண் புரை அறுவை சிகிச்சை",
      bn: "ছানি অপারেশন",
      ml: "തിമിര ശസ്ത്രക്രിയ",
      kn: "ಕಾಟರ್ ಶಸ್ತ್ರಚಿಕಿತ್ಸೆ",
      te: "కంటి పొర శస్త్రచికిత్స",
      ar: "جراحة الساد بالموجات فوق الصوتية",
      si: "ඇසේ සේදුම ශල්‍ය",
    },
    about: {
      en: "Cataract phacoemulsification is the standard modern technique for cataract surgery. An ultrasound probe breaks up the clouded lens into small pieces which are then aspirated out through a micro-incision (2–3 mm). An artificial intraocular lens (IOL) is then inserted to replace the natural lens. The procedure is typically done under topical anaesthesia (eye drops only) and takes 10–15 minutes. Vision improvement is usually noticed within 24–48 hours. India is the world leader in cataract surgery, performing over 7 million procedures annually with an excellent safety record.",
      hi: "फेकोइमल्सिफिकेशन मोतियाबिंद सर्जरी की आधुनिक तकनीक है। अल्ट्रासाउंड प्रोब बादल छाए हुए लेंस को टुकड़ों में तोड़ता है। भारत विश्व में सर्वाधिक मोतियाबिंद सर्जरी करता है।",
    },
    procedures: [
      "Phacoemulsification with IOL",
      "Laser Cataract Surgery (FLACS)",
      "Premium IOL (Multifocal / Toric)",
    ],
  },

};

// ─── PUBLIC API ─────────────────────────────────────────────────────────────

/** Returns the translated treatment name for the given slug and locale.
 *  Falls back to the English name in the map, then returns null (caller should use DB title). */
export function getTreatmentName(slug: string, locale: Locale): string | null {
  const meta = CONTENT[slug];
  if (!meta?.names) return null;
  return meta.names[locale] ?? meta.names.en ?? null;
}

/** Returns the rich "About" description for the given slug and locale.
 *  Falls back to English, then null (caller should use DB description). */
export function getTreatmentAbout(slug: string, locale: Locale): string | null {
  const meta = CONTENT[slug];
  if (!meta?.about) return null;
  return meta.about[locale] ?? meta.about.en ?? null;
}

/** Returns the list of common procedures for a treatment slug. */
export function getTreatmentProcedures(slug: string): string[] {
  return CONTENT[slug]?.procedures ?? [];
}
