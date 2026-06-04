/**
 * Symptom flow definitions for the structured chatbot questionnaire.
 * Each flow = 3–5 clinical questions → specialty recommendation + lead capture.
 */

export type SymptomQuestion = {
  id: string;
  text: string;
  options: string[];
};

export type SymptomFlow = {
  id: string;
  label: string;
  icon: string;
  specialty: string;
  specialtyKey: string;
  conditions: string[];
  urgency: "routine" | "soon" | "urgent";
  urgencyNote: string;
  questions: SymptomQuestion[];
};

export const SYMPTOM_FLOWS: SymptomFlow[] = [
  {
    id: "stomach_pain",
    label: "Stomach pain",
    icon: "🫁",
    specialty: "Gastroenterologist",
    specialtyKey: "gastroenterology",
    conditions: ["Acidity / GERD", "Gastritis", "Indigestion", "IBS"],
    urgency: "soon",
    urgencyNote: "See a doctor if pain is severe or lasts more than 3 days",
    questions: [
      { id: "location", text: "Where is the pain?", options: ["Upper abdomen", "Lower abdomen", "Left side", "Right side", "All over"] },
      { id: "timing", text: "When does it happen?", options: ["After meals", "Empty stomach", "Anytime", "Only at night"] },
      { id: "type", text: "What type of pain?", options: ["Burning", "Sharp", "Dull ache", "Cramping"] },
      { id: "duration", text: "How long has this been?", options: ["Just started", "2–3 days", "More than a week", "On and off for months"] },
      { id: "other", text: "Any other symptoms?", options: ["Nausea / vomiting", "Fever", "Bloating", "Loss of appetite", "None"] },
    ],
  },
  {
    id: "chest_pain",
    label: "Chest pain",
    icon: "❤️",
    specialty: "Cardiologist",
    specialtyKey: "cardiology",
    conditions: ["Angina", "Acid reflux (GERD)", "Muscle strain", "Anxiety / stress"],
    urgency: "urgent",
    urgencyNote: "⚠️ Severe pain with sweating or breathlessness — call 112 immediately",
    questions: [
      { id: "severity", text: "How severe is the pain?", options: ["Mild discomfort", "Moderate", "Severe"] },
      { id: "radiation", text: "Does the pain spread anywhere?", options: ["To left arm", "To jaw / neck", "To back", "Stays in chest only"] },
      { id: "trigger", text: "When did it start?", options: ["During activity / exertion", "At rest", "After eating", "Came on suddenly"] },
      { id: "other", text: "Any of these also?", options: ["Sweating", "Breathlessness", "Palpitations", "Dizziness", "None"] },
    ],
  },
  {
    id: "headache",
    label: "Headache",
    icon: "🧠",
    specialty: "Neurologist",
    specialtyKey: "neurology",
    conditions: ["Migraine", "Tension headache", "Sinusitis", "Cluster headache"],
    urgency: "soon",
    urgencyNote: "Seek urgent care for sudden thunderclap headache or loss of vision",
    questions: [
      { id: "location", text: "Where is the headache?", options: ["Forehead / front", "One side only", "Back of head", "Whole head"] },
      { id: "type", text: "Type of pain?", options: ["Throbbing / pulsating", "Pressure / squeezing", "Sharp stabbing", "Dull constant ache"] },
      { id: "extra", text: "Any of these with it?", options: ["Light sensitivity", "Nausea", "Vision changes", "Neck stiffness", "None"] },
      { id: "duration", text: "How long does it last?", options: ["Few hours", "All day", "Multiple days", "Comes and goes"] },
    ],
  },
  {
    id: "joint_pain",
    label: "Joint / Back pain",
    icon: "🦴",
    specialty: "Orthopaedic Surgeon",
    specialtyKey: "orthopaedics",
    conditions: ["Arthritis", "Spondylosis / disc issue", "Muscle strain", "Ligament injury"],
    urgency: "routine",
    urgencyNote: "Consult soon if pain limits daily activities or is worsening",
    questions: [
      { id: "location", text: "Which area?", options: ["Knee", "Lower back / spine", "Hip", "Shoulder", "Ankle / foot"] },
      { id: "type", text: "What does it feel like?", options: ["Sharp pain", "Dull ache", "Morning stiffness", "Swelling + pain"] },
      { id: "trigger", text: "What makes it worse?", options: ["Walking / climbing stairs", "Morning on waking", "Sitting for long", "After exercise"] },
      { id: "duration", text: "How long has this been?", options: ["A few days", "Weeks", "Few months", "Over a year"] },
    ],
  },
  {
    id: "fever",
    label: "Fever / Cold",
    icon: "🌡️",
    specialty: "General Physician",
    specialtyKey: "general",
    conditions: ["Viral fever", "Dengue / Malaria", "Typhoid", "Flu / common cold"],
    urgency: "soon",
    urgencyNote: "See a doctor if fever is above 102°F or lasts more than 3 days",
    questions: [
      { id: "temp", text: "How high is the fever?", options: ["Mild (99–100°F)", "Moderate (100–102°F)", "High (above 102°F)", "Didn't measure"] },
      { id: "duration", text: "How many days?", options: ["Started today", "2–3 days", "More than 3 days", "Coming and going"] },
      { id: "other", text: "Other symptoms?", options: ["Body ache", "Chills / shivering", "Skin rash", "Sore throat", "None"] },
    ],
  },
  {
    id: "skin",
    label: "Skin problem",
    icon: "🩹",
    specialty: "Dermatologist",
    specialtyKey: "dermatology",
    conditions: ["Eczema / Dermatitis", "Fungal infection", "Psoriasis", "Allergic rash"],
    urgency: "routine",
    urgencyNote: "See a doctor urgently if rash spreads fast or comes with fever",
    questions: [
      { id: "type", text: "What does it look like?", options: ["Redness / rash", "Itchy dry patches", "Blisters", "Scaly / flaky skin"] },
      { id: "location", text: "Where on the body?", options: ["Face", "Arms / legs", "Scalp", "Chest / back", "Widespread"] },
      { id: "duration", text: "How long?", options: ["Just appeared", "A few days", "Weeks", "Keeps coming back"] },
    ],
  },
  {
    id: "womens_health",
    label: "Women's health",
    icon: "🌸",
    specialty: "Gynaecologist",
    specialtyKey: "gynaecology",
    conditions: ["PCOS / PCOD", "Uterine fibroids", "Menstrual irregularity", "UTI"],
    urgency: "soon",
    urgencyNote: "Most conditions are very treatable — early consultation helps",
    questions: [
      { id: "concern", text: "What is your main concern?", options: ["Irregular periods", "Severe cramps / pain", "PCOS / PCOD", "Pregnancy related", "Other"] },
      { id: "duration", text: "How long has this been?", options: ["Just started", "Few weeks", "Few months", "Over a year"] },
      { id: "other", text: "Any other symptoms?", options: ["Weight changes", "Excessive hair fall", "Acne", "Fatigue", "None"] },
    ],
  },
  {
    id: "eye",
    label: "Eye problem",
    icon: "👁️",
    specialty: "Ophthalmologist",
    specialtyKey: "ophthalmology",
    conditions: ["Conjunctivitis", "Dry eyes", "Refractive error", "Early cataract"],
    urgency: "soon",
    urgencyNote: "Seek urgent care for sudden vision loss or severe eye pain",
    questions: [
      { id: "symptom", text: "What is the issue?", options: ["Redness / itching", "Blurry vision", "Pain in eye", "Discharge / watering"] },
      { id: "which", text: "Which eye?", options: ["Left eye only", "Right eye only", "Both eyes"] },
      { id: "duration", text: "How long?", options: ["Started today", "2–3 days", "Weeks", "Ongoing for months"] },
    ],
  },
];

export const WHATSAPP_NUMBER = "919175576299";
export const CITIES = ["Mumbai", "Pune", "Delhi NCR", "Bangalore", "Hyderabad", "Chennai", "Kolkata", "Ahmedabad", "Other city"];
export const CALL_TIMES = ["Morning (9 AM–12 PM)", "Afternoon (12–5 PM)", "Evening (5–8 PM)", "Any time works"];
