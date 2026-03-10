import type { SmartListing } from "@/components/phase1/types";

export const quickPrompts = [
  "Chest pain since morning",
  "Best cardiologist Mumbai",
  "Knee replacement in Pune",
  "MRI scan near me",
  "Mujhe seene mein dard ho raha hai",
];

export const smartBrowseData: Record<string, SmartListing[]> = {
  hospital: [
    {
      id: "apollo-pune",
      name: "Apollo Hospitals Pune",
      location: "Wakad, Pune",
      tags: ["Multi-Speciality", "NABH", "24/7 ICU"],
      rating: "4.9",
      reviews: "2.3k",
      kind: "hospital",
    },
    {
      id: "fortis-vashi",
      name: "Fortis Hiranandani Hospital",
      location: "Vashi, Navi Mumbai",
      tags: ["Trauma", "Cardiac", "JCI"],
      rating: "4.8",
      reviews: "1.8k",
      kind: "hospital",
    },
    {
      id: "manipal-whitefield",
      name: "Manipal Hospital",
      location: "Whitefield, Bengaluru",
      tags: ["Oncology", "Transplant", "Neurology"],
      rating: "4.7",
      reviews: "3.1k",
      kind: "hospital",
    },
  ],
  cardiology: [
    {
      id: "cardio-apollo",
      name: "Apollo Heart Centre",
      location: "Pune",
      tags: ["Angioplasty", "Bypass", "Echo"],
      rating: "4.9",
      reviews: "2.1k",
      kind: "hospital",
    },
    {
      id: "dr-priya",
      name: "Dr. Priya Verma",
      location: "Koregaon Park, Pune",
      tags: ["Cardiology", "ECG", "OPD"],
      rating: "4.9",
      reviews: "680",
      kind: "doctor",
    },
  ],
  ortho: [
    {
      id: "ortho-manipal",
      name: "Manipal Orthopaedics",
      location: "Kharadi, Pune",
      tags: ["Knee Replacement", "Spine", "Sports Injury"],
      rating: "4.8",
      reviews: "2.0k",
      kind: "hospital",
    },
    {
      id: "dr-raj-ortho",
      name: "Dr. Raj Kulkarni",
      location: "Shivajinagar, Pune",
      tags: ["Joint Replacement", "Arthroscopy"],
      rating: "4.9",
      reviews: "1.2k",
      kind: "doctor",
    },
  ],
  diagnostic: [
    {
      id: "lal-path",
      name: "Dr. Lal PathLabs",
      location: "Pan India",
      tags: ["Blood Test", "Home Collection", "NABL"],
      rating: "4.6",
      reviews: "12.1k",
      kind: "lab",
    },
    {
      id: "metropolis",
      name: "Metropolis Healthcare",
      location: "Mumbai & Pan India",
      tags: ["Genomics", "Pathology", "Radiology"],
      rating: "4.7",
      reviews: "5.1k",
      kind: "lab",
    },
  ],
};

export const categories = [
  { key: "hospital", label: "Hospitals" },
  { key: "cardiology", label: "Cardiology" },
  { key: "ortho", label: "Orthopaedics" },
  { key: "diagnostic", label: "Diagnostics" },
] as const;


