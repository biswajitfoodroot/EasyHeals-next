export type Locale = "en" | "hi" | "mr" | "ta" | "bn";

export const LOCALES: { code: Locale; label: string; nativeLabel: string }[] = [
  { code: "en", label: "English", nativeLabel: "English" },
  { code: "hi", label: "Hindi", nativeLabel: "हिन्दी" },
  { code: "mr", label: "Marathi", nativeLabel: "मराठी" },
  { code: "ta", label: "Tamil", nativeLabel: "தமிழ்" },
  { code: "bn", label: "Bengali", nativeLabel: "বাংলা" },
];

export type Dict = {
  nav: {
    hospitals: string;
    doctors: string;
    treatments: string;
    findCare: string;
    register: string;
    changeLanguage: string;
  };
  search: {
    placeholder: string;
    send: string;
    thinking: string;
    greeting: string;
    aiChat: string;
    symptoms: string;
    nameSearch: string;
    noResults: string;
    refineCity: string;
  };
  common: {
    bookAppointment: string;
    callNow: string;
    getDirections: string;
    viewProfile: string;
    verified: string;
    communityVerified: string;
    loading: string;
    error: string;
    yearsExp: string;
    fee: string;
    experience: string;
    priceOnRequest: string;
    allCities: string;
    allDepartments: string;
    noResults: string;
    editHistory: string;
    suggestEdit: string;
    save: string;
    cancel: string;
    search: string;
    rating: string;
    open: string;
    directions: string;
    stay: string;
    bookPackage: string;
  };
  hospital: {
    directoryTitle: string;
    directoryDescription: string;
    searchPlaceholder: string;
    tabOverview: string;
    tabDoctors: string;
    tabPackages: string;
    tabServices: string;
    tabReviews: string;
    tabLocation: string;
    affiliatedDoctors: string;
    affiliatedDoctorsHint: string;
    noPackages: string;
    nearby: string;
    profileOverview: string;
    hospitalData: string;
    ratingsTitle: string;
    ratingsReviewNote: string;
    locationTitle: string;
    largerMap: string;
    kicker: string;
  };
  doctor: {
    directoryTitle: string;
    directoryDescription: string;
    searchPlaceholder: string;
    tabOverview: string;
    tabAffiliations: string;
    tabSchedule: string;
    tabReviews: string;
    qualifications: string;
    languages: string;
    specialties: string;
    consultationFee: string;
    aiReviewSummary: string;
    noAffiliations: string;
    ratingsTitle: string;
    ratingsNote: string;
    kicker: string;
  };
  treatment: {
    tabOverview: string;
    tabHospitals: string;
    tabDoctors: string;
    availableAt: string;
    specialists: string;
    noHospitals: string;
    noDoctors: string;
  };
  registration: {
    title: string;
    subtitle: string;
    step1Label: string;
    step2Label: string;
    step3Label: string;
    searchHint: string;
    claimExisting: string;
    createNew: string;
    getOtp: string;
    verifyComplete: string;
    successTitle: string;
    successMessage: string;
  };
};

const en: Dict = {
  nav: {
    hospitals: "Hospitals",
    doctors: "Doctors",
    treatments: "Treatments",
    findCare: "Find Care",
    register: "Register Hospital",
    changeLanguage: "Language",
  },
  search: {
    placeholder: "Type symptoms, doctor name, or ask anything...",
    send: "Send",
    thinking: "Thinking...",
    greeting: "Hello! I am your EasyHeals AI. Tell me your symptoms or ask for a hospital/doctor in your language.",
    aiChat: "AI Chat",
    symptoms: "Symptoms",
    nameSearch: "Name Search",
    noResults: "No results found. Try adding a city or specialty.",
    refineCity: "Which city should I prioritize?",
  },
  common: {
    bookAppointment: "Book Appointment",
    callNow: "Call Now",
    getDirections: "Get Directions",
    viewProfile: "View Profile",
    verified: "Verified",
    communityVerified: "Community Verified",
    loading: "Loading...",
    error: "Something went wrong. Please try again.",
    yearsExp: "yrs exp",
    fee: "Fee",
    experience: "Experience",
    priceOnRequest: "Price on request",
    allCities: "All Cities",
    allDepartments: "All Departments",
    noResults: "No matches found for this filter.",
    editHistory: "Edit History",
    suggestEdit: "Suggest Edit",
    save: "Save",
    cancel: "Cancel",
    search: "Search",
    rating: "Rating",
    open: "Open",
    directions: "Directions",
    stay: "Stay",
    bookPackage: "Book This Package",
  },
  hospital: {
    directoryTitle: "Private Hospitals Across India",
    directoryDescription: "Search verified private hospitals by city and specialty, then open profile pages with map directions and affiliated doctors.",
    searchPlaceholder: "Search hospital, specialty, city",
    tabOverview: "Overview",
    tabDoctors: "Doctors",
    tabPackages: "Packages & Pricing",
    tabServices: "Services",
    tabReviews: "Reviews",
    tabLocation: "Location",
    affiliatedDoctors: "Affiliated Doctors",
    affiliatedDoctorsHint: "Click any doctor to open the detailed profile with all affiliated hospitals.",
    noPackages: "No packages added yet. Contact the hospital for pricing.",
    nearby: "Also Nearby",
    profileOverview: "Profile Overview",
    hospitalData: "Hospital Data",
    ratingsTitle: "Ratings & Community Trust",
    ratingsReviewNote: "Review system in this phase shows aggregate score and trust signals. Verified patient review workflow is in the next planned sprint.",
    locationTitle: "Location & Navigation",
    largerMap: "Larger Map",
    kicker: "Hospital Profile",
  },
  doctor: {
    directoryTitle: "Doctors Across India",
    directoryDescription: "Browse verified doctors by specialization, city, and hospital affiliation.",
    searchPlaceholder: "Search doctor, specialty, city",
    tabOverview: "Overview",
    tabAffiliations: "Affiliated Hospitals",
    tabSchedule: "Schedule & Fees",
    tabReviews: "Reviews",
    qualifications: "Qualifications",
    languages: "Languages",
    specialties: "Specialties",
    consultationFee: "Consultation Fee",
    aiReviewSummary: "AI Review Summary",
    noAffiliations: "No hospital affiliations added yet.",
    ratingsTitle: "Ratings & Reviews",
    ratingsNote: "Verified patient review workflow is in the next planned sprint.",
    kicker: "Doctor Profile",
  },
  treatment: {
    tabOverview: "Overview",
    tabHospitals: "Hospitals",
    tabDoctors: "Doctors",
    availableAt: "Available at",
    specialists: "Specialists",
    noHospitals: "No hospitals linked to this treatment yet.",
    noDoctors: "No doctors linked to this treatment yet.",
  },
  registration: {
    title: "Register Your Hospital",
    subtitle: "Free onboarding. OTP verified. Live in minutes.",
    step1Label: "Search & Match",
    step2Label: "Fill Details",
    step3Label: "OTP Verify",
    searchHint: "Search for your hospital by name and city.",
    claimExisting: "Claim Existing",
    createNew: "Create New Listing",
    getOtp: "Get OTP",
    verifyComplete: "Verify & Complete",
    successTitle: "You're live!",
    successMessage: "Your hospital profile is now active on EasyHeals.",
  },
};

const hi: Dict = {
  nav: {
    hospitals: "अस्पताल",
    doctors: "डॉक्टर",
    treatments: "उपचार",
    findCare: "देखभाल खोजें",
    register: "अस्पताल पंजीकृत करें",
    changeLanguage: "भाषा",
  },
  search: {
    placeholder: "लक्षण, डॉक्टर का नाम, या कुछ भी पूछें...",
    send: "भेजें",
    thinking: "सोच रहा हूं...",
    greeting: "नमस्ते! मैं आपका EasyHeals AI हूं। मुझे अपने लक्षण बताएं या अपनी भाषा में अस्पताल/डॉक्टर के बारे में पूछें।",
    aiChat: "AI चैट",
    symptoms: "लक्षण",
    nameSearch: "नाम खोज",
    noResults: "कोई परिणाम नहीं मिला। शहर या विशेषता जोड़कर देखें।",
    refineCity: "किस शहर को प्राथमिकता दें?",
  },
  common: {
    bookAppointment: "अपॉइंटमेंट बुक करें",
    callNow: "अभी कॉल करें",
    getDirections: "दिशा प्राप्त करें",
    viewProfile: "प्रोफ़ाइल देखें",
    verified: "सत्यापित",
    communityVerified: "समुदाय द्वारा सत्यापित",
    loading: "लोड हो रहा है...",
    error: "कुछ गलत हो गया। कृपया पुनः प्रयास करें।",
    yearsExp: "वर्ष अनुभव",
    fee: "शुल्क",
    experience: "अनुभव",
    priceOnRequest: "कीमत अनुरोध पर",
    allCities: "सभी शहर",
    allDepartments: "सभी विभाग",
    noResults: "इस फ़िल्टर के लिए कोई परिणाम नहीं मिला।",
    editHistory: "संपादन इतिहास",
    suggestEdit: "संपादन सुझाएं",
    save: "सहेजें",
    cancel: "रद्द करें",
    search: "खोजें",
    rating: "रेटिंग",
    open: "खोलें",
    directions: "दिशा",
    stay: "ठहरना",
    bookPackage: "यह पैकेज बुक करें",
  },
  hospital: {
    directoryTitle: "भारत भर के निजी अस्पताल",
    directoryDescription: "शहर और विशेषता के आधार पर सत्यापित निजी अस्पताल खोजें।",
    searchPlaceholder: "अस्पताल, विशेषता, शहर खोजें",
    tabOverview: "अवलोकन",
    tabDoctors: "डॉक्टर",
    tabPackages: "पैकेज और मूल्य",
    tabServices: "सेवाएं",
    tabReviews: "समीक्षाएं",
    tabLocation: "स्थान",
    affiliatedDoctors: "संबद्ध डॉक्टर",
    affiliatedDoctorsHint: "विस्तृत प्रोफ़ाइल देखने के लिए किसी भी डॉक्टर पर क्लिक करें।",
    noPackages: "अभी तक कोई पैकेज नहीं जोड़ा गया। मूल्य के लिए अस्पताल से संपर्क करें।",
    nearby: "नज़दीक भी",
    profileOverview: "प्रोफ़ाइल अवलोकन",
    hospitalData: "अस्पताल डेटा",
    ratingsTitle: "रेटिंग और सामुदायिक विश्वास",
    ratingsReviewNote: "इस चरण में समीक्षा प्रणाली समग्र स्कोर और विश्वास संकेत दिखाती है।",
    locationTitle: "स्थान और नेविगेशन",
    largerMap: "बड़ा नक्शा",
    kicker: "अस्पताल प्रोफ़ाइल",
  },
  doctor: {
    directoryTitle: "भारत भर के डॉक्टर",
    directoryDescription: "विशेषज्ञता, शहर और अस्पताल संबद्धता के आधार पर सत्यापित डॉक्टर खोजें।",
    searchPlaceholder: "डॉक्टर, विशेषता, शहर खोजें",
    tabOverview: "अवलोकन",
    tabAffiliations: "संबद्ध अस्पताल",
    tabSchedule: "शेड्यूल और शुल्क",
    tabReviews: "समीक्षाएं",
    qualifications: "योग्यताएं",
    languages: "भाषाएं",
    specialties: "विशेषताएं",
    consultationFee: "परामर्श शुल्क",
    aiReviewSummary: "AI समीक्षा सारांश",
    noAffiliations: "अभी तक कोई अस्पताल संबद्धता नहीं जोड़ी गई।",
    ratingsTitle: "रेटिंग और समीक्षाएं",
    ratingsNote: "सत्यापित रोगी समीक्षा वर्कफ़्लो अगले स्प्रिंट में है।",
    kicker: "डॉक्टर प्रोफ़ाइल",
  },
  treatment: {
    tabOverview: "अवलोकन",
    tabHospitals: "अस्पताल",
    tabDoctors: "डॉक्टर",
    availableAt: "यहाँ उपलब्ध",
    specialists: "विशेषज्ञ",
    noHospitals: "अभी तक इस उपचार से कोई अस्पताल नहीं जोड़ा गया।",
    noDoctors: "अभी तक इस उपचार से कोई डॉक्टर नहीं जोड़ा गया।",
  },
  registration: {
    title: "अपना अस्पताल पंजीकृत करें",
    subtitle: "मुफ़्त ऑनबोर्डिंग। OTP सत्यापित। मिनटों में लाइव।",
    step1Label: "खोजें और मिलाएं",
    step2Label: "विवरण भरें",
    step3Label: "OTP सत्यापन",
    searchHint: "नाम और शहर से अपना अस्पताल खोजें।",
    claimExisting: "मौजूदा का दावा करें",
    createNew: "नई लिस्टिंग बनाएं",
    getOtp: "OTP प्राप्त करें",
    verifyComplete: "सत्यापित करें और पूरा करें",
    successTitle: "आप लाइव हैं!",
    successMessage: "आपकी अस्पताल प्रोफ़ाइल अब EasyHeals पर सक्रिय है।",
  },
};

const mr: Dict = {
  nav: {
    hospitals: "रुग्णालये",
    doctors: "डॉक्टर",
    treatments: "उपचार",
    findCare: "काळजी शोधा",
    register: "रुग्णालय नोंदणी",
    changeLanguage: "भाषा",
  },
  search: {
    placeholder: "लक्षणे, डॉक्टरचे नाव किंवा काहीही विचारा...",
    send: "पाठवा",
    thinking: "विचार करत आहे...",
    greeting: "नमस्कार! मी तुमचा EasyHeals AI आहे. मला तुमची लक्षणे सांगा किंवा तुमच्या भाषेत रुग्णालय/डॉक्टरबद्दल विचारा.",
    aiChat: "AI चॅट",
    symptoms: "लक्षणे",
    nameSearch: "नाव शोध",
    noResults: "कोणतेही परिणाम मिळाले नाहीत. शहर किंवा विशेषता जोडून पाहा.",
    refineCity: "कोणत्या शहराला प्राधान्य द्यायचे?",
  },
  common: {
    bookAppointment: "अपॉइंटमेंट बुक करा",
    callNow: "आता कॉल करा",
    getDirections: "दिशा मिळवा",
    viewProfile: "प्रोफाइल पहा",
    verified: "सत्यापित",
    communityVerified: "समुदायाने सत्यापित",
    loading: "लोड होत आहे...",
    error: "काहीतरी चुकले. कृपया पुन्हा प्रयत्न करा.",
    yearsExp: "वर्षे अनुभव",
    fee: "शुल्क",
    experience: "अनुभव",
    priceOnRequest: "किंमत विनंतीवर",
    allCities: "सर्व शहरे",
    allDepartments: "सर्व विभाग",
    noResults: "या फिल्टरसाठी कोणते परिणाम मिळाले नाहीत.",
    editHistory: "संपादन इतिहास",
    suggestEdit: "संपादन सुझाएं",
    save: "जतन करा",
    cancel: "रद्द करा",
    search: "शोधा",
    rating: "रेटिंग",
    open: "उघडा",
    directions: "दिशा",
    stay: "मुक्काम",
    bookPackage: "हे पॅकेज बुक करा",
  },
  hospital: {
    directoryTitle: "भारतभरातील खाजगी रुग्णालये",
    directoryDescription: "शहर आणि विशेषतेनुसार सत्यापित खाजगी रुग्णालये शोधा।",
    searchPlaceholder: "रुग्णालय, विशेषता, शहर शोधा",
    tabOverview: "आढावा",
    tabDoctors: "डॉक्टर",
    tabPackages: "पॅकेज आणि किंमत",
    tabServices: "सेवा",
    tabReviews: "समीक्षा",
    tabLocation: "स्थान",
    affiliatedDoctors: "संलग्न डॉक्टर",
    affiliatedDoctorsHint: "तपशीलवार प्रोफाइल पाहण्यासाठी कोणत्याही डॉक्टरवर क्लिक करा.",
    noPackages: "अजून कोणतेही पॅकेज जोडलेले नाहीत. किंमतीसाठी रुग्णालयाशी संपर्क साधा.",
    nearby: "जवळपास देखील",
    profileOverview: "प्रोफाइल आढावा",
    hospitalData: "रुग्णालय डेटा",
    ratingsTitle: "रेटिंग आणि समुदाय विश्वास",
    ratingsReviewNote: "या टप्प्यात पुनरावलोकन प्रणाली एकत्रित स्कोर दाखवते.",
    locationTitle: "स्थान आणि नेव्हिगेशन",
    largerMap: "मोठा नकाशा",
    kicker: "रुग्णालय प्रोफाइल",
  },
  doctor: {
    directoryTitle: "भारतभरातील डॉक्टर",
    directoryDescription: "विशेषता, शहर आणि रुग्णालय संलग्नतेनुसार सत्यापित डॉक्टर शोधा.",
    searchPlaceholder: "डॉक्टर, विशेषता, शहर शोधा",
    tabOverview: "आढावा",
    tabAffiliations: "संलग्न रुग्णालये",
    tabSchedule: "वेळापत्रक आणि शुल्क",
    tabReviews: "समीक्षा",
    qualifications: "पात्रता",
    languages: "भाषा",
    specialties: "विशेषता",
    consultationFee: "सल्लागार शुल्क",
    aiReviewSummary: "AI समीक्षा सारांश",
    noAffiliations: "अजून कोणतीही रुग्णालय संलग्नता जोडलेली नाही.",
    ratingsTitle: "रेटिंग आणि समीक्षा",
    ratingsNote: "सत्यापित रुग्ण समीक्षा वर्कफ्लो पुढील स्प्रिंटमध्ये आहे.",
    kicker: "डॉक्टर प्रोफाइल",
  },
  treatment: {
    tabOverview: "आढावा",
    tabHospitals: "रुग्णालये",
    tabDoctors: "डॉक्टर",
    availableAt: "येथे उपलब्ध",
    specialists: "तज्ञ",
    noHospitals: "अजून या उपचारासाठी कोणतेही रुग्णालय जोडलेले नाही.",
    noDoctors: "अजून या उपचारासाठी कोणताही डॉक्टर जोडलेला नाही.",
  },
  registration: {
    title: "तुमचे रुग्णालय नोंदणी करा",
    subtitle: "मोफत ऑनबोर्डिंग. OTP सत्यापित. काही मिनिटांत लाइव्ह.",
    step1Label: "शोधा आणि जुळवा",
    step2Label: "तपशील भरा",
    step3Label: "OTP सत्यापन",
    searchHint: "नाव आणि शहराने तुमचे रुग्णालय शोधा.",
    claimExisting: "विद्यमान दावा करा",
    createNew: "नवीन नोंद तयार करा",
    getOtp: "OTP मिळवा",
    verifyComplete: "सत्यापित करा आणि पूर्ण करा",
    successTitle: "तुम्ही लाइव्ह आहात!",
    successMessage: "तुमची रुग्णालय प्रोफाइल आता EasyHeals वर सक्रिय आहे.",
  },
};

const ta: Dict = {
  nav: {
    hospitals: "மருத்துவமனைகள்",
    doctors: "மருத்துவர்கள்",
    treatments: "சிகிச்சைகள்",
    findCare: "சிகிச்சை தேடு",
    register: "மருத்துவமனை பதிவு",
    changeLanguage: "மொழி",
  },
  search: {
    placeholder: "அறிகுறிகள், மருத்துவர் பெயர் அல்லது எதையும் கேளுங்கள்...",
    send: "அனுப்பு",
    thinking: "யோசிக்கிறேன்...",
    greeting: "வணக்கம்! நான் உங்கள் EasyHeals AI. உங்கள் அறிகுறிகளை சொல்லுங்கள் அல்லது உங்கள் மொழியில் மருத்துவமனை/மருத்துவர் பற்றி கேளுங்கள்.",
    aiChat: "AI அரட்டை",
    symptoms: "அறிகுறிகள்",
    nameSearch: "பெயர் தேடல்",
    noResults: "முடிவுகள் எதுவும் இல்லை. நகரம் அல்லது சிறப்பை சேர்க்க முயற்சிக்கவும்.",
    refineCity: "எந்த நகரத்திற்கு முன்னுரிமை தர வேண்டும்?",
  },
  common: {
    bookAppointment: "சந்திப்பு பதிவு செய்க",
    callNow: "இப்போது அழை",
    getDirections: "வழிகாட்டல் பெறு",
    viewProfile: "சுயவிவரம் பார்க்க",
    verified: "சரிபார்க்கப்பட்டது",
    communityVerified: "சமூகத்தால் சரிபார்க்கப்பட்டது",
    loading: "ஏற்றுகிறது...",
    error: "ஏதோ தவறு நடந்தது. மீண்டும் முயற்சிக்கவும்.",
    yearsExp: "ஆண்டு அனுபவம்",
    fee: "கட்டணம்",
    experience: "அனுபவம்",
    priceOnRequest: "கோரிக்கையில் விலை",
    allCities: "அனைத்து நகரங்கள்",
    allDepartments: "அனைத்து துறைகள்",
    noResults: "இந்த வடிப்பானுக்கு பொருத்தங்கள் எதுவும் இல்லை.",
    editHistory: "திருத்த வரலாறு",
    suggestEdit: "திருத்தம் பரிந்துரைக்க",
    save: "சேமி",
    cancel: "ரத்து செய்",
    search: "தேடு",
    rating: "மதிப்பீடு",
    open: "திற",
    directions: "வழிகாட்டல்",
    stay: "தங்குதல்",
    bookPackage: "இந்த தொகுப்பை பதிவு செய்க",
  },
  hospital: {
    directoryTitle: "இந்தியா முழுவதும் தனியார் மருத்துவமனைகள்",
    directoryDescription: "நகரம் மற்றும் சிறப்பு மூலம் சரிபார்க்கப்பட்ட தனியார் மருத்துவமனைகளை தேடுங்கள்.",
    searchPlaceholder: "மருத்துவமனை, சிறப்பு, நகரம் தேடு",
    tabOverview: "கண்ணோட்டம்",
    tabDoctors: "மருத்துவர்கள்",
    tabPackages: "தொகுப்புகள் & விலை",
    tabServices: "சேவைகள்",
    tabReviews: "மதிப்புரைகள்",
    tabLocation: "இடம்",
    affiliatedDoctors: "இணைக்கப்பட்ட மருத்துவர்கள்",
    affiliatedDoctorsHint: "விரிவான சுயவிவரம் பார்க்க எந்த மருத்துவரையும் கிளிக் செய்யுங்கள்.",
    noPackages: "இன்னும் எந்த தொகுப்பும் சேர்க்கப்படவில்லை.",
    nearby: "அருகிலும் உள்ளது",
    profileOverview: "சுயவிவர கண்ணோட்டம்",
    hospitalData: "மருத்துவமனை தரவு",
    ratingsTitle: "மதிப்பீடுகள் & சமூக நம்பிக்கை",
    ratingsReviewNote: "இந்த கட்டத்தில் மதிப்பாய்வு அமைப்பு மொத்த மதிப்பெண்ணை காட்டுகிறது.",
    locationTitle: "இடம் & வழிசெலுத்தல்",
    largerMap: "பெரிய வரைபடம்",
    kicker: "மருத்துவமனை சுயவிவரம்",
  },
  doctor: {
    directoryTitle: "இந்தியா முழுவதும் மருத்துவர்கள்",
    directoryDescription: "சிறப்பு, நகரம் மற்றும் மருத்துவமனை இணைப்பு மூலம் சரிபார்க்கப்பட்ட மருத்துவர்களை தேடுங்கள்.",
    searchPlaceholder: "மருத்துவர், சிறப்பு, நகரம் தேடு",
    tabOverview: "கண்ணோட்டம்",
    tabAffiliations: "இணைக்கப்பட்ட மருத்துவமனைகள்",
    tabSchedule: "அட்டவணை & கட்டணம்",
    tabReviews: "மதிப்புரைகள்",
    qualifications: "தகுதிகள்",
    languages: "மொழிகள்",
    specialties: "சிறப்புகள்",
    consultationFee: "ஆலோசனை கட்டணம்",
    aiReviewSummary: "AI மதிப்பாய்வு சுருக்கம்",
    noAffiliations: "இன்னும் எந்த மருத்துவமனை இணைப்பும் சேர்க்கப்படவில்லை.",
    ratingsTitle: "மதிப்பீடுகள் & மதிப்புரைகள்",
    ratingsNote: "சரிபார்க்கப்பட்ட நோயாளி மதிப்பாய்வு அடுத்த ஸ்பிரிண்டில் உள்ளது.",
    kicker: "மருத்துவர் சுயவிவரம்",
  },
  treatment: {
    tabOverview: "கண்ணோட்டம்",
    tabHospitals: "மருத்துவமனைகள்",
    tabDoctors: "மருத்துவர்கள்",
    availableAt: "இங்கே கிடைக்கும்",
    specialists: "நிபுணர்கள்",
    noHospitals: "இன்னும் இந்த சிகிச்சைக்கு மருத்துவமனை இணைக்கப்படவில்லை.",
    noDoctors: "இன்னும் இந்த சிகிச்சைக்கு மருத்துவர் இணைக்கப்படவில்லை.",
  },
  registration: {
    title: "உங்கள் மருத்துவமனையை பதிவு செய்யுங்கள்",
    subtitle: "இலவச ஆன்போர்டிங். OTP சரிபார்க்கப்பட்டது. நிமிடங்களில் நேரலை.",
    step1Label: "தேடு & பொருத்து",
    step2Label: "விவரங்களை நிரப்பு",
    step3Label: "OTP சரிபார்ப்பு",
    searchHint: "பெயர் மற்றும் நகரம் மூலம் உங்கள் மருத்துவமனையை தேடுங்கள்.",
    claimExisting: "ஏற்கனவே உள்ளதை கோரு",
    createNew: "புதிய பட்டியல் உருவாக்கு",
    getOtp: "OTP பெறு",
    verifyComplete: "சரிபார்த்து முடி",
    successTitle: "நீங்கள் நேரலையில் இருக்கிறீர்கள்!",
    successMessage: "உங்கள் மருத்துவமனை சுயவிவரம் EasyHeals இல் செயலில் உள்ளது.",
  },
};

const bn: Dict = {
  nav: {
    hospitals: "হাসপাতাল",
    doctors: "ডাক্তার",
    treatments: "চিকিৎসা",
    findCare: "সেবা খুঁজুন",
    register: "হাসপাতাল নিবন্ধন",
    changeLanguage: "ভাষা",
  },
  search: {
    placeholder: "লক্ষণ, ডাক্তারের নাম বা যেকোনো কিছু জিজ্ঞাসা করুন...",
    send: "পাঠান",
    thinking: "ভাবছি...",
    greeting: "নমস্কার! আমি আপনার EasyHeals AI। আমাকে আপনার লক্ষণ বলুন বা আপনার ভাষায় হাসপাতাল/ডাক্তার সম্পর্কে জিজ্ঞাসা করুন।",
    aiChat: "AI চ্যাট",
    symptoms: "লক্ষণ",
    nameSearch: "নাম অনুসন্ধান",
    noResults: "কোনো ফলাফল পাওয়া যায়নি। শহর বা বিশেষত্ব যোগ করুন।",
    refineCity: "কোন শহরকে অগ্রাধিকার দিতে হবে?",
  },
  common: {
    bookAppointment: "অ্যাপয়েন্টমেন্ট বুক করুন",
    callNow: "এখনই কল করুন",
    getDirections: "দিকনির্দেশনা পান",
    viewProfile: "প্রোফাইল দেখুন",
    verified: "যাচাইকৃত",
    communityVerified: "সম্প্রদায় যাচাইকৃত",
    loading: "লোড হচ্ছে...",
    error: "কিছু একটা ভুল হয়েছে। আবার চেষ্টা করুন।",
    yearsExp: "বছর অভিজ্ঞতা",
    fee: "ফি",
    experience: "অভিজ্ঞতা",
    priceOnRequest: "অনুরোধে মূল্য",
    allCities: "সব শহর",
    allDepartments: "সব বিভাগ",
    noResults: "এই ফিল্টারের জন্য কোনো মিল পাওয়া যায়নি।",
    editHistory: "সম্পাদনার ইতিহাস",
    suggestEdit: "সম্পাদনা সুপারিশ",
    save: "সংরক্ষণ করুন",
    cancel: "বাতিল করুন",
    search: "অনুসন্ধান",
    rating: "রেটিং",
    open: "খুলুন",
    directions: "দিকনির্দেশনা",
    stay: "থাকা",
    bookPackage: "এই প্যাকেজ বুক করুন",
  },
  hospital: {
    directoryTitle: "ভারত জুড়ে বেসরকারি হাসপাতাল",
    directoryDescription: "শহর ও বিশেষত্ব অনুযায়ী যাচাইকৃত বেসরকারি হাসপাতাল খুঁজুন।",
    searchPlaceholder: "হাসপাতাল, বিশেষত্ব, শহর অনুসন্ধান করুন",
    tabOverview: "সংক্ষিপ্ত বিবরণ",
    tabDoctors: "ডাক্তার",
    tabPackages: "প্যাকেজ ও মূল্য",
    tabServices: "সেবাসমূহ",
    tabReviews: "পর্যালোচনা",
    tabLocation: "অবস্থান",
    affiliatedDoctors: "অনুমোদিত ডাক্তার",
    affiliatedDoctorsHint: "বিস্তারিত প্রোফাইল দেখতে যেকোনো ডাক্তারে ক্লিক করুন।",
    noPackages: "এখনও কোনো প্যাকেজ যোগ করা হয়নি।",
    nearby: "কাছেও আছে",
    profileOverview: "প্রোফাইল সংক্ষিপ্ত বিবরণ",
    hospitalData: "হাসপাতাল ডেটা",
    ratingsTitle: "রেটিং ও সম্প্রদায়ের আস্থা",
    ratingsReviewNote: "এই পর্যায়ে পর্যালোচনা সিস্টেম সামগ্রিক স্কোর দেখায়।",
    locationTitle: "অবস্থান ও নেভিগেশন",
    largerMap: "বড় মানচিত্র",
    kicker: "হাসপাতাল প্রোফাইল",
  },
  doctor: {
    directoryTitle: "ভারত জুড়ে ডাক্তার",
    directoryDescription: "বিশেষত্ব, শহর ও হাসপাতাল সংযুক্তি অনুযায়ী যাচাইকৃত ডাক্তার খুঁজুন।",
    searchPlaceholder: "ডাক্তার, বিশেষত্ব, শহর অনুসন্ধান করুন",
    tabOverview: "সংক্ষিপ্ত বিবরণ",
    tabAffiliations: "অনুমোদিত হাসপাতাল",
    tabSchedule: "সময়সূচি ও ফি",
    tabReviews: "পর্যালোচনা",
    qualifications: "যোগ্যতা",
    languages: "ভাষাসমূহ",
    specialties: "বিশেষত্বসমূহ",
    consultationFee: "পরামর্শ ফি",
    aiReviewSummary: "AI পর্যালোচনা সারাংশ",
    noAffiliations: "এখনও কোনো হাসপাতাল সংযুক্তি যোগ করা হয়নি।",
    ratingsTitle: "রেটিং ও পর্যালোচনা",
    ratingsNote: "যাচাইকৃত রোগীর পর্যালোচনা পরবর্তী স্প্রিন্টে আসবে।",
    kicker: "ডাক্তার প্রোফাইল",
  },
  treatment: {
    tabOverview: "সংক্ষিপ্ত বিবরণ",
    tabHospitals: "হাসপাতাল",
    tabDoctors: "ডাক্তার",
    availableAt: "এখানে পাওয়া যায়",
    specialists: "বিশেষজ্ঞ",
    noHospitals: "এখনও এই চিকিৎসার জন্য কোনো হাসপাতাল যোগ করা হয়নি।",
    noDoctors: "এখনও এই চিকিৎসার জন্য কোনো ডাক্তার যোগ করা হয়নি।",
  },
  registration: {
    title: "আপনার হাসপাতাল নিবন্ধন করুন",
    subtitle: "বিনামূল্যে অনবোর্ডিং। OTP যাচাইকৃত। মিনিটের মধ্যে লাইভ।",
    step1Label: "খুঁজুন ও মিলান",
    step2Label: "বিবরণ পূরণ করুন",
    step3Label: "OTP যাচাই",
    searchHint: "নাম ও শহর দিয়ে আপনার হাসপাতাল খুঁজুন।",
    claimExisting: "বিদ্যমান দাবি করুন",
    createNew: "নতুন তালিকা তৈরি করুন",
    getOtp: "OTP পান",
    verifyComplete: "যাচাই করুন ও সম্পন্ন করুন",
    successTitle: "আপনি লাইভ!",
    successMessage: "আপনার হাসপাতাল প্রোফাইল এখন EasyHeals-এ সক্রিয়।",
  },
};

export const dictionaries: Record<Locale, Dict> = { en, hi, mr, ta, bn };

// Utility: navigate nested object by dot-notation key
export function getTranslation(dict: Dict, path: string): string {
  const value = path.split(".").reduce<unknown>((obj, key) => {
    if (obj && typeof obj === "object") return (obj as Record<string, unknown>)[key];
    return undefined;
  }, dict);
  return typeof value === "string" ? value : path;
}
