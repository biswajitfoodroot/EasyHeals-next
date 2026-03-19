"use client";

import Link from "next/link";
import { useTranslations } from "@/i18n/LocaleContext";

type TaxonomyItem = {
  id: string;
  slug: string;
  title: string;
  description: string | null;
  type: string | null;
};

type GroupedItems = Record<string, TaxonomyItem[]>;

export function TreatmentsClient({
  grouped,
  types,
  totalCount,
}: {
  grouped: GroupedItems;
  types: string[];
  totalCount: number;
}) {
  const { t } = useTranslations();

  const typeLabel: Record<string, string> = {
    specialty:  t("treatment.typeSpecialty"),
    treatment:  t("treatment.typeTreatment"),
    procedure:  t("treatment.typeProcedure"),
    condition:  t("treatment.typeCondition"),
    department: t("treatment.typeDepartment"),
  };

  return (
    <main
      style={{
        minHeight: "100dvh",
        background:
          "radial-gradient(1200px 400px at 100% -10%, rgba(0,184,150,0.16), transparent 60%), radial-gradient(700px 260px at 0% -8%, rgba(59,130,246,0.14), transparent 60%), #030a16",
        color: "#e8eef8",
        padding: "86px 20px 48px",
      }}
    >
      <div style={{ width: "min(1180px, 100%)", margin: "0 auto", display: "grid", gap: "32px" }}>

        {/* Header */}
        <div>
          <p style={{ margin: 0, textTransform: "uppercase", letterSpacing: "0.08em", fontWeight: 700, color: "#4dffd6", fontSize: "0.76rem" }}>
            Healthcare Directory
          </p>
          <h1 style={{ margin: "8px 0 12px", fontSize: "clamp(1.6rem, 4vw, 2.4rem)", fontWeight: 800, letterSpacing: "-0.02em" }}>
            {t("treatment.directoryTitle")}
          </h1>
          <p style={{ margin: 0, color: "rgba(232,238,248,0.6)", fontSize: "1rem" }}>
            {totalCount} healthcare categories · {t("treatment.directoryDescription").split(".")[0]}
          </p>
        </div>

        {/* Groups */}
        {types.map((type) => (
          <section key={type}>
            <h2 style={{ margin: "0 0 16px", fontSize: "1rem", fontWeight: 700, color: "rgba(232,238,248,0.55)", textTransform: "uppercase", letterSpacing: "0.06em" }}>
              {typeLabel[type] ?? type}
            </h2>
            <div
              style={{
                display: "grid",
                gridTemplateColumns: "repeat(auto-fill, minmax(240px, 1fr))",
                gap: "12px",
              }}
            >
              {(grouped[type] ?? []).map((item) => (
                <Link
                  key={item.id}
                  href={`/treatments/${item.slug}`}
                  style={{
                    display: "block",
                    background: "linear-gradient(135deg, rgba(7,25,50,0.92), rgba(6,47,54,0.72))",
                    border: "1px solid rgba(255,255,255,0.08)",
                    borderRadius: "14px",
                    padding: "16px 18px",
                    textDecoration: "none",
                    color: "#e8eef8",
                    transition: "border-color 0.2s",
                  }}
                >
                  <strong style={{ display: "block", fontSize: "0.95rem", marginBottom: "6px" }}>{item.title}</strong>
                  {item.description && (
                    <p style={{ margin: 0, fontSize: "0.8rem", color: "rgba(232,238,248,0.55)", lineHeight: 1.45 }}>
                      {item.description.slice(0, 80)}{item.description.length > 80 ? "…" : ""}
                    </p>
                  )}
                  <span style={{ display: "inline-block", marginTop: "10px", fontSize: "0.78rem", color: "#4dffd6", fontWeight: 600 }}>
                    {t("common.viewProfile")} →
                  </span>
                </Link>
              ))}
            </div>
          </section>
        ))}

        {totalCount === 0 && (
          <p style={{ color: "rgba(232,238,248,0.5)", textAlign: "center", padding: "4rem 0" }}>
            No treatment categories found. Add them via the admin taxonomy tab.
          </p>
        )}
      </div>
    </main>
  );
}
