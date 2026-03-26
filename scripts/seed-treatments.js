require('dotenv').config({ path: '.env.local' });
const { createClient } = require('@libsql/client');
const { randomUUID: uuid } = require('crypto');

const db = createClient({ url: process.env.TURSO_DATABASE_URL, authToken: process.env.TURSO_AUTH_TOKEN });

function slug(title) {
  return title.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
}

const SPECIALTIES = [
  ["Cardiology", "Diagnosis and treatment of heart and blood vessel diseases including coronary artery disease, heart failure, and arrhythmias."],
  ["Neurology", "Medical care for the brain, spinal cord, nerves, and muscles — including stroke, epilepsy, Parkinson's, and multiple sclerosis."],
  ["Orthopaedics", "Surgical and non-surgical treatment of the musculoskeletal system — bones, joints, ligaments, tendons, and spine."],
  ["Gastroenterology", "Diagnosis and treatment of digestive system disorders including stomach, liver, pancreas, intestines, and colon."],
  ["Pulmonology", "Care for respiratory conditions affecting the lungs and breathing — asthma, COPD, tuberculosis, and sleep apnoea."],
  ["Nephrology", "Management of kidney diseases, chronic kidney disease, kidney failure, and dialysis support."],
  ["Oncology", "Diagnosis and treatment of all types of cancer using chemotherapy, targeted therapy, immunotherapy, and radiation."],
  ["Ophthalmology", "Eye care including cataract, glaucoma, retinal disorders, LASIK, and corneal transplants."],
  ["Dermatology", "Skin, hair, and nail conditions — acne, eczema, psoriasis, hair loss, and cosmetic dermatology."],
  ["Endocrinology", "Treatment of hormonal and metabolic disorders — diabetes, thyroid disease, PCOS, and adrenal conditions."],
  ["Rheumatology", "Care for autoimmune and inflammatory joint diseases — arthritis, lupus, ankylosing spondylitis, and gout."],
  ["Urology", "Urinary tract and male reproductive health — kidney stones, prostate issues, bladder conditions, and incontinence."],
  ["Gynaecology & Obstetrics", "Women's reproductive health, pregnancy, childbirth, and conditions like PCOS, fibroids, and endometriosis."],
  ["Paediatrics", "Complete medical care for infants, children, and adolescents — growth, vaccinations, infections, and developmental issues."],
  ["Psychiatry", "Mental health conditions including depression, anxiety, bipolar disorder, schizophrenia, OCD, and PTSD."],
  ["ENT (Ear, Nose & Throat)", "Treatment of ear, nose, throat, head, and neck disorders — sinusitis, hearing loss, tonsils, and voice problems."],
  ["General Surgery", "Surgical management of abdominal, hernia, gallbladder, appendix, thyroid, and soft tissue conditions."],
  ["Cardiothoracic Surgery", "Open-heart and chest surgeries including bypass, valve replacement, and lung resection."],
  ["Neurosurgery", "Surgical treatment of brain tumours, spinal cord disorders, aneurysms, and hydrocephalus."],
  ["Plastic & Reconstructive Surgery", "Cosmetic and reconstructive procedures — rhinoplasty, breast reconstruction, burn care, and scar revision."],
  ["Haematology", "Blood disorders including anaemia, leukaemia, lymphoma, thalassaemia, and clotting diseases."],
  ["Hepatology", "Specialised liver care — hepatitis, cirrhosis, fatty liver disease, and liver transplant evaluation."],
  ["Transplant Medicine", "Organ transplantation including kidney, liver, heart, and bone marrow transplants — pre and post care."],
  ["Vascular Surgery", "Treatment of vascular conditions — varicose veins, aortic aneurysm, peripheral artery disease, and deep vein thrombosis."],
  ["Spine Surgery", "Surgical correction of spinal disorders — disc herniation, scoliosis, spinal stenosis, and vertebral fractures."],
  ["Sports Medicine", "Injury prevention, rehabilitation, and performance optimisation for athletes and active individuals."],
  ["Physical Medicine & Rehabilitation", "Restoring function and quality of life after injury, stroke, or surgery through physiotherapy and rehab."],
  ["Geriatrics", "Holistic healthcare for elderly patients managing multiple chronic conditions, falls, and cognitive decline."],
  ["Reproductive Medicine & IVF", "Fertility diagnosis and assisted reproduction — IVF, IUI, egg freezing, and treatment of infertility causes."],
  ["Anaesthesiology", "Perioperative care including general, regional, and local anaesthesia and pain management."],
  ["Emergency Medicine", "Immediate care for acute injuries, trauma, chest pain, stroke, and life-threatening emergencies."],
  ["Radiology & Imaging", "Medical imaging services — X-ray, CT scan, MRI, ultrasound, mammography, and nuclear medicine."],
  ["Neonatology", "Intensive care for premature and critically ill newborns in the NICU."],
  ["Paediatric Surgery", "Surgical treatment of congenital and acquired conditions in infants and children."],
  ["Colorectal Surgery", "Surgical management of colon, rectum, and anal disorders including colorectal cancer, Crohn's disease, and IBD."],
  ["Bariatric Surgery", "Weight loss surgeries including sleeve gastrectomy, gastric bypass, and adjustable gastric band for obesity."],
  ["Dental & Oral Surgery", "Comprehensive dental care — root canal, dental implants, braces, jaw surgery, and oral cancer treatment."],
  ["Immunology & Allergy", "Diagnosis and management of immune system disorders, allergies, asthma, and autoimmune diseases."],
  ["Palliative Care", "Comfort-focused care for patients with serious illness — pain management, emotional support, and quality of life."],
  ["General Medicine & Internal Medicine", "Diagnosis and management of complex adult medical conditions across all organ systems."],
  ["Nutrition & Dietetics", "Medical nutrition therapy for diabetes, obesity, kidney disease, cancer, and post-surgical recovery."],
];

const TREATMENTS = [
  ["Angioplasty & Stenting", "treatment", "A minimally invasive procedure to open blocked coronary arteries using a balloon catheter and placing a stent to restore blood flow."],
  ["Bypass Surgery (CABG)", "treatment", "Coronary artery bypass grafting using a healthy blood vessel graft to restore blood flow around blocked coronary arteries."],
  ["Knee Replacement", "treatment", "Surgical replacement of a damaged knee joint with an artificial implant — total or partial — to relieve pain and restore mobility."],
  ["Hip Replacement", "treatment", "Replacement of the damaged hip joint with a prosthetic implant to eliminate pain from arthritis or injury."],
  ["Cataract Surgery", "treatment", "Removal of the clouded natural eye lens and replacement with an intraocular lens to restore clear vision."],
  ["Dialysis", "treatment", "A kidney replacement therapy that filters waste products and excess fluid from the blood when kidneys can no longer function."],
  ["Chemotherapy", "treatment", "Drug-based cancer treatment that kills or slows the growth of rapidly dividing cancer cells throughout the body."],
  ["Radiotherapy", "treatment", "Use of high-energy radiation to destroy cancer cells and shrink tumours — often combined with surgery or chemotherapy."],
  ["MRI Scan", "treatment", "Magnetic resonance imaging produces detailed images of organs, soft tissues, and the nervous system without radiation."],
  ["CT Scan", "treatment", "Computerised tomography creates cross-sectional images of the body for rapid diagnosis of injuries, tumours, and organ conditions."],
  ["Ultrasound Scan", "treatment", "Real-time imaging using sound waves to examine abdominal organs, heart, blood vessels, pregnancy, and soft tissues."],
  ["Endoscopy", "treatment", "A flexible camera procedure to visualise and treat the digestive tract — upper GI endoscopy and colonoscopy."],
  ["Laparoscopy", "treatment", "Minimally invasive keyhole surgery used for diagnosis and treatment of abdominal and pelvic conditions."],
  ["Hernia Repair", "treatment", "Surgical correction of hernia — inguinal, umbilical, hiatal, or ventral — using open or laparoscopic technique."],
  ["Appendectomy", "treatment", "Surgical removal of an inflamed appendix, performed as an emergency procedure to prevent rupture."],
  ["Hysterectomy", "treatment", "Surgical removal of the uterus, performed for fibroids, cancer, endometriosis, or chronic pelvic pain."],
  ["Caesarean Section", "treatment", "Surgical delivery of a baby through an incision in the mother's abdomen and uterus when normal delivery is not feasible."],
  ["IVF (In Vitro Fertilisation)", "treatment", "Assisted reproduction where eggs are fertilised outside the body and embryos are transferred to the uterus to achieve pregnancy."],
  ["Kidney Transplant", "treatment", "Surgical placement of a healthy donor kidney to replace a failed kidney — significantly improves quality of life and survival."],
  ["Liver Transplant", "treatment", "Replacing a diseased liver with a healthy one from a living or deceased donor — performed for cirrhosis or liver failure."],
  ["Bone Marrow Transplant", "treatment", "Infusion of healthy stem cells to replace damaged bone marrow — used for leukaemia, lymphoma, and other blood disorders."],
  ["Heart Valve Replacement", "treatment", "Surgical repair or replacement of diseased heart valves — aortic, mitral, pulmonary, or tricuspid — using tissue or mechanical valves."],
  ["Spinal Fusion", "treatment", "Surgical joining of two or more vertebrae to stabilise the spine and relieve pain from disc disease or spinal deformity."],
  ["Rhinoplasty", "treatment", "Cosmetic or reconstructive nose surgery to change shape, improve function, or correct trauma and congenital defects."],
  ["LASIK Eye Surgery", "treatment", "Laser vision correction procedure reshaping the cornea to reduce or eliminate the need for glasses or contact lenses."],
  ["Hair Transplant", "treatment", "Surgical restoration of hair using FUE or FUT technique to treat androgenetic alopecia and balding."],
  ["Tonsillectomy", "treatment", "Surgical removal of the tonsils to treat recurrent tonsillitis, sleep apnoea, or obstructive breathing."],
  ["Gallbladder Removal (Cholecystectomy)", "treatment", "Laparoscopic or open removal of the gallbladder, most often performed for gallstones causing pain or complications."],
  ["Root Canal Treatment", "treatment", "Dental procedure to save an infected or damaged tooth by removing the pulp, cleaning the canals, and sealing the tooth."],
  ["Dental Implants", "treatment", "Permanent replacement of missing teeth using titanium implants fused with the jawbone, topped with a crown."],
  ["Pacemaker Implantation", "treatment", "Implantation of a small device to regulate slow or irregular heartbeat by sending electrical signals to the heart."],
  ["Aneurysm Repair", "treatment", "Surgical or endovascular repair of an aortic or brain aneurysm to prevent life-threatening rupture."],
  ["Corneal Transplant", "treatment", "Replacement of damaged corneal tissue with healthy donor cornea to restore vision in cases of keratoconus or scarring."],
  ["Deep Brain Stimulation", "treatment", "Neurosurgical procedure implanting electrodes in specific brain areas to control symptoms of Parkinson's, tremors, or dystonia."],
  ["Bariatric Weight Loss Surgery", "treatment", "Weight loss surgery — sleeve gastrectomy, gastric bypass, or banding — for severe obesity to achieve sustained weight reduction."],
  ["Cochlear Implant", "treatment", "Electronic device surgically implanted to provide sound perception for people with severe to profound hearing loss."],
  ["Prostatectomy", "treatment", "Surgical removal of the prostate gland — radical or robotic-assisted — for prostate cancer or benign prostatic hyperplasia."],
  ["Mastectomy", "treatment", "Surgical removal of one or both breasts, performed for breast cancer treatment or prevention in high-risk individuals."],
  ["Colonoscopy", "treatment", "Endoscopic examination of the entire colon to detect polyps, colorectal cancer, and inflammatory bowel disease."],
  ["Blood Test (Pathology)", "treatment", "Laboratory analysis of blood samples to diagnose infections, anaemia, organ function, hormones, and disease markers."],
  ["ECG (Electrocardiogram)", "treatment", "Non-invasive test recording the electrical activity of the heart to detect arrhythmias, heart attacks, and cardiac conditions."],
  ["Echocardiogram", "treatment", "Ultrasound imaging of the heart to assess its structure, function, valves, and blood flow in real time."],
  ["Physiotherapy & Rehabilitation", "treatment", "Therapeutic exercises and manual techniques to restore movement, reduce pain, and improve function after injury or surgery."],
  ["ICU & Critical Care", "treatment", "Intensive monitoring and life-support care for critically ill patients requiring ventilators, vasopressors, and continuous observation."],
  ["Normal Delivery (VBAC)", "treatment", "Vaginal delivery of a baby with or without medical assistance, monitored closely by an obstetrician and midwife team."],
  ["Vaccination & Immunisation", "treatment", "Administration of vaccines to prevent infectious diseases — childhood immunisation schedule, travel vaccines, and adult boosters."],
  ["Full Body Health Checkup", "treatment", "Comprehensive preventive health screening including blood tests, imaging, ECG, and specialist consultations."],
  ["Prostate Biopsy", "treatment", "Tissue sampling from the prostate gland to diagnose prostate cancer or assess suspicious PSA elevation."],
  ["Liposuction", "treatment", "Cosmetic procedure removing stubborn fat deposits from abdomen, thighs, arms, or neck using suction-assisted technique."],
  ["Thyroidectomy", "treatment", "Surgical removal of part or all of the thyroid gland for thyroid cancer, goitre, or hyperthyroidism."],
  ["Gastric Sleeve Surgery", "treatment", "Bariatric procedure removing about 80% of the stomach to restrict food intake and trigger significant weight loss."],
  ["Endoscopic Sinus Surgery", "treatment", "Minimally invasive surgery to remove blockages, polyps, or diseased tissue from the sinuses to improve breathing."],
  ["Knee Arthroscopy", "treatment", "Keyhole surgery of the knee to diagnose and treat meniscus tears, ligament damage, and cartilage problems."],
  ["Varicocelectomy", "treatment", "Surgical correction of enlarged veins in the scrotum to improve male fertility and relieve testicular pain."],
  ["Cystoscopy", "treatment", "Endoscopic examination of the bladder and urethra to diagnose tumours, stones, infections, and strictures."],
  ["ERCP", "treatment", "Endoscopic procedure to examine and treat bile duct and pancreatic duct conditions including stones and strictures."],
  ["Lithotripsy", "treatment", "Non-invasive or minimally invasive breaking of kidney stones or gallstones using shock waves or laser energy."],
  ["Bronchoscopy", "treatment", "Flexible camera examination of the airways and lungs to diagnose infections, tumours, foreign bodies, and bleeding."],
  ["Percutaneous Coronary Intervention", "procedure", "Catheter-based procedure to open blocked coronary arteries, often with stent placement, avoiding open-heart surgery."],
  ["Robotic Surgery", "procedure", "Minimally invasive surgery performed with robotic arm assistance, offering greater precision and faster recovery."],
  ["Stem Cell Therapy", "procedure", "Infusion of stem cells to treat blood cancers, autoimmune conditions, and degenerative diseases."],
  ["Platelet Rich Plasma (PRP) Therapy", "procedure", "Injection of concentrated platelets from the patient's own blood to accelerate healing in joints, tendons, and hair restoration."],
  ["Extracorporeal Membrane Oxygenation (ECMO)", "procedure", "Advanced life support providing heart and lung bypass for severe cardiac or respiratory failure."],
];

async function run() {
  console.log('Deleting all existing taxonomy_nodes...');
  await db.execute('DELETE FROM taxonomy_nodes');

  const all = [
    ...SPECIALTIES.map(([title, desc]) => ({ title, description: desc, type: 'specialty' })),
    ...TREATMENTS.map(([title, type, desc]) => ({ title, description: desc, type })),
  ];

  console.log(`Inserting ${all.length} taxonomy nodes...`);
  for (const item of all) {
    const id = uuid();
    const s = slug(item.title);
    await db.execute({
      sql: 'INSERT INTO taxonomy_nodes (id, slug, title, description, type, is_active, created_at) VALUES (?, ?, ?, ?, ?, 1, ?)',
      args: [id, s, item.title, item.description, item.type, Date.now()],
    });
  }
  console.log('Done! Total:', all.length);
}

run().catch(console.error);
