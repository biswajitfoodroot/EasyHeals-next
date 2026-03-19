import React from 'react';

type HospitalTrustData = {
  accreditations?: string[];
  verified?: boolean;
  lastVerifiedAt?: string | null;
  patientsHelped?: number | null;
};

type DoctorTrustData = {
  qualifications?: string[];
  registrationNumber?: string | null;
  yearsOfExperience?: number | null;
  patientsHelped?: number | null;
};

export const TrustBadges = ({
  type,
  hospital,
  doctor,
  analyticsConsentGranted = false
}: {
  type: "hospital" | "doctor",
  hospital?: HospitalTrustData,
  doctor?: DoctorTrustData,
  analyticsConsentGranted?: boolean
}) => {
  if (type === "hospital" && hospital) {
    const verifiedDate = hospital.lastVerifiedAt 
      ? new Date(hospital.lastVerifiedAt).toLocaleDateString('en-US', { month: 'short', year: 'numeric' })
      : null;

    return (
      <div className="flex flex-wrap gap-2 text-xs font-medium">
        {hospital.accreditations?.map(acc => (
          <span key={acc} className="px-2 py-1 bg-teal-900/40 text-teal-300 border border-teal-700 rounded-md shadow-sm">
            ✓ {acc}
          </span>
        ))}
        {hospital.verified && (
          <span className="px-2 py-1 bg-blue-900/40 text-blue-300 border border-blue-700 rounded-md shadow-sm">
            ✓ Verified by EasyHeals
          </span>
        )}
        {verifiedDate && (
          <span className="px-2 py-1 bg-slate-800/60 text-slate-400 border border-slate-600 rounded-md shadow-sm">
            Last verified: {verifiedDate}
          </span>
        )}
        {analyticsConsentGranted && hospital.patientsHelped && (
          <span className="px-2 py-1 bg-amber-900/40 text-amber-300 border border-amber-700 rounded-md shadow-sm">
            {hospital.patientsHelped} patients helped
          </span>
        )}
      </div>
    );
  }

  if (type === "doctor" && doctor) {
    return (
      <div className="flex flex-wrap gap-2 text-xs font-medium">
        {doctor.qualifications?.map(qual => (
          <span key={qual} className="px-2 py-1 bg-indigo-900/40 text-indigo-300 border border-indigo-700 rounded-md shadow-sm">
            {qual}
          </span>
        ))}
        {doctor.registrationNumber && (
          <span className="px-2 py-1 bg-slate-800/60 text-slate-400 border border-slate-600 rounded-md shadow-sm">
            Reg: {doctor.registrationNumber}
          </span>
        )}
        {doctor.yearsOfExperience && (
          <span className="px-2 py-1 bg-emerald-900/40 text-emerald-300 border border-emerald-700 rounded-md shadow-sm">
            {doctor.yearsOfExperience} years exp
          </span>
        )}
        {analyticsConsentGranted && doctor.patientsHelped && (
          <span className="px-2 py-1 bg-amber-900/40 text-amber-300 border border-amber-700 rounded-md shadow-sm">
            {doctor.patientsHelped} patients helped
          </span>
        )}
      </div>
    );
  }

  return null;
};
