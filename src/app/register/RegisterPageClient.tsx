"use client";

import Link from "next/link";
import { useState } from "react";

import { RegistrationModal } from "@/components/registration/RegistrationModal";
import { useTranslations } from "@/i18n/LocaleContext";

export default function RegisterPageClient() {
  const [open, setOpen] = useState(false);
  const { t } = useTranslations();

  return (
    <main
      style={{
        minHeight: "100dvh",
        background:
          "radial-gradient(1200px 400px at 100% -10%, rgba(0,184,150,0.16), transparent 60%), radial-gradient(700px 260px at 0% -8%, rgba(59,130,246,0.14), transparent 60%), #030a16",
        color: "#e8eef8",
        padding: "86px 20px 60px",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
      }}
    >
      <section
        style={{
          width: "min(560px, 100%)",
          display: "grid",
          gap: "28px",
          textAlign: "center",
        }}
      >
        {/* Kicker */}
        <span
          style={{
            display: "inline-flex",
            alignSelf: "center",
            justifyContent: "center",
            gap: "8px",
            borderRadius: "999px",
            border: "1px solid rgba(0,212,176,0.34)",
            padding: "4px 14px",
            fontSize: "11px",
            color: "#4dffd8",
            textTransform: "uppercase",
            letterSpacing: "0.08em",
          }}
        >
          Free Tier · Always Available
        </span>

        {/* Heading */}
        <div>
          <h1
            style={{
              margin: 0,
              fontFamily: "var(--font-serif), serif",
              fontSize: "clamp(32px, 5.5vw, 52px)",
              lineHeight: 1.05,
              letterSpacing: "-0.02em",
              color: "#fff",
            }}
          >
            {t("registration.title")}
          </h1>
          <p
            style={{
              marginTop: "12px",
              fontSize: "16px",
              color: "rgba(232,238,248,0.7)",
              lineHeight: 1.6,
            }}
          >
            {t("registration.subtitle")}
          </p>
        </div>

        {/* Steps */}
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(3, 1fr)",
            gap: "12px",
          }}
        >
          {[
            { step: "1", label: t("registration.step1Label") },
            { step: "2", label: t("registration.step2Label") },
            { step: "3", label: t("registration.step3Label") },
          ].map(({ step, label }) => (
            <div
              key={step}
              style={{
                borderRadius: "14px",
                border: "1px solid rgba(255,255,255,0.1)",
                background: "rgba(255,255,255,0.04)",
                padding: "16px 10px",
                display: "flex",
                flexDirection: "column",
                alignItems: "center",
                gap: "8px",
              }}
            >
              <span
                style={{
                  width: "32px",
                  height: "32px",
                  borderRadius: "50%",
                  background: "rgba(0,184,150,0.2)",
                  border: "1px solid rgba(0,184,150,0.4)",
                  color: "#4dffd8",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  fontSize: "13px",
                  fontWeight: 700,
                }}
              >
                {step}
              </span>
              <span style={{ fontSize: "12px", color: "rgba(232,238,248,0.8)", fontWeight: 500 }}>
                {label}
              </span>
            </div>
          ))}
        </div>

        {/* Perks */}
        <ul
          style={{
            listStyle: "none",
            margin: 0,
            padding: 0,
            display: "grid",
            gap: "8px",
            textAlign: "left",
          }}
        >
          {[
            "✓ Basic hospital profile — free forever",
            "✓ Up to 5 affiliated doctor slots",
            "✓ Map-ready with Google directions",
            "✓ AI-enriched from public data",
            "✓ Zero admin steps — instant approval",
          ].map((item) => (
            <li
              key={item}
              style={{
                fontSize: "13px",
                color: "rgba(232,238,248,0.75)",
                display: "flex",
                alignItems: "center",
                gap: "8px",
              }}
            >
              {item}
            </li>
          ))}
        </ul>

        {/* CTA */}
        <div style={{ display: "flex", gap: "12px", justifyContent: "center", flexWrap: "wrap" }}>
          <button
            type="button"
            onClick={() => setOpen(true)}
            style={{
              padding: "14px 28px",
              borderRadius: "999px",
              background: "linear-gradient(120deg, #00b896, #00d4b0)",
              color: "#03231d",
              fontWeight: 700,
              fontSize: "15px",
              border: "none",
              cursor: "pointer",
              fontFamily: "inherit",
            }}
          >
            {t("registration.title")} →
          </button>
          <Link
            href="/hospitals"
            style={{
              padding: "14px 24px",
              borderRadius: "999px",
              border: "1px solid rgba(255,255,255,0.14)",
              background: "rgba(255,255,255,0.06)",
              color: "#d5e2f8",
              textDecoration: "none",
              fontSize: "14px",
            }}
          >
            Browse Hospitals
          </Link>
        </div>

        <p style={{ fontSize: "11px", color: "rgba(232,238,248,0.4)", marginTop: "-8px" }}>
          Already registered?{" "}
          <Link href="/portal/login" style={{ color: "#4dffd8", textDecoration: "none" }}>
            Sign in to your portal →
          </Link>
        </p>
      </section>

      <RegistrationModal isOpen={open} onClose={() => setOpen(false)} />
    </main>
  );
}
