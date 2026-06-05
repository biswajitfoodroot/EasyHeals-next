"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { easyHealsPublicData } from "@/data/easyhealsPublicData";
import { useTranslations } from "@/i18n/LocaleContext";
import styles from "./footer.module.css";

const HIDDEN_PREFIXES = [
  "/admin", "/portal", "/provider-management",
  "/dashboard", "/login", "/unauthorized",
];

export function SiteFooter() {
  const pathname = usePathname();
  const { t } = useTranslations();

  if (HIDDEN_PREFIXES.some((p) => pathname.startsWith(p))) return null;

  const phone = easyHealsPublicData.contact.phone;
  const phoneTel = phone.replace(/-/g, "");

  return (
    <footer className={styles.footer}>
      <div className={styles.inner}>

        {/* ── Top grid ── */}
        <div className={styles.grid}>

          {/* ① Brand + contact + social */}
          <div className={styles.brandCol}>
            <div className={styles.brandLeft}>
              <Link href="/" className={styles.brandLink}>
                <img src="/logo.svg" alt="EasyHeals" />
                <span className={styles.brandName}>Easy<span>Heals</span></span>
              </Link>
              <p className={styles.tagline}>
                {t("footer.tagline")}
              </p>
            </div>

            <div className={styles.contact}>
              <a href={`tel:${phoneTel}`} className={styles.contactItem}>
                <span className={styles.contactIcon}>📞</span>{phone}
              </a>
              <a href={`mailto:${easyHealsPublicData.contact.email}`} className={styles.contactItem}>
                <span className={styles.contactIcon}>✉️</span>{easyHealsPublicData.contact.email}
              </a>
              <span className={styles.contactItem}>
                <span className={styles.contactIcon}>📍</span>{easyHealsPublicData.contact.address}
              </span>
            </div>

            <div className={styles.social}>
              <a href="https://linkedin.com/company/easyheals" target="_blank" rel="noopener noreferrer" className={styles.socialBtn} aria-label="LinkedIn">
                <svg width="15" height="15" viewBox="0 0 24 24" fill="currentColor">
                  <path d="M16 8a6 6 0 016 6v7h-4v-7a2 2 0 00-2-2 2 2 0 00-2 2v7h-4v-7a6 6 0 016-6zM2 9h4v12H2z"/>
                  <circle cx="4" cy="4" r="2"/>
                </svg>
              </a>
              <a href="https://twitter.com/easyheals" target="_blank" rel="noopener noreferrer" className={styles.socialBtn} aria-label="Twitter">
                <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor">
                  <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z"/>
                </svg>
              </a>
              <a href="https://instagram.com/easyheals" target="_blank" rel="noopener noreferrer" className={styles.socialBtn} aria-label="Instagram">
                <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <rect x="2" y="2" width="20" height="20" rx="5" ry="5"/>
                  <path d="M16 11.37A4 4 0 1112.63 8 4 4 0 0116 11.37z"/>
                  <line x1="17.5" y1="6.5" x2="17.51" y2="6.5"/>
                </svg>
              </a>
              <a href="https://wa.me/919175576299" target="_blank" rel="noopener noreferrer" className={styles.socialBtn} aria-label="WhatsApp">
                <svg width="15" height="15" viewBox="0 0 24 24" fill="currentColor">
                  <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z"/>
                </svg>
              </a>
            </div>
          </div>

          {/* ② Platform links */}
          <div className={styles.linkCol}>
            <h4 className={styles.colHeading}>{t("footer.platformHeading")}</h4>
            <Link href="/hospitals" className={styles.link}>{t("nav.hospitals")}</Link>
            <Link href="/doctors" className={styles.link}>{t("nav.doctors")}</Link>
            <Link href="/treatments" className={styles.link}>{t("nav.treatments")}</Link>
            <Link href="/diagnostics" className={styles.link}>{t("nav.diagnostics")}</Link>
            <Link href="/ask" className={styles.link}>{t("footer.aiAssistant")}</Link>
          </div>

          {/* ③ Legal */}
          <div className={styles.linkCol}>
            <h4 className={styles.colHeading}>{t("footer.legalHeading")}</h4>
            <Link href="/privacy-policy" className={styles.link}>{t("footer.privacyPolicy")}</Link>
            <Link href="/terms" className={styles.link}>{t("footer.termsConditions")}</Link>
            <Link href="/register" className={styles.ctaLink}>
              {t("footer.listHospitalFree")}
            </Link>
          </div>

          {/* ④ Company */}
          <div className={styles.linkCol}>
            <h4 className={styles.colHeading}>{t("footer.companyHeading")}</h4>
            <Link href="/ask" className={styles.link}>{t("footer.aboutEasyHeals")}</Link>
            <Link href="/hospitals" className={styles.link}>{t("footer.browseHospitals")}</Link>
            <Link href="/doctors" className={styles.link}>{t("footer.findDoctors")}</Link>
            <a href="mailto:sales@easyheals.com" className={styles.link}>{t("footer.partnerWithUs")}</a>
          </div>

        </div>

        {/* ── Bottom bar ── */}
        <div className={styles.bottomBar}>
          <p className={styles.copyright}>
            © {new Date().getFullYear()} EasyHeals Technologies Pvt. Ltd. {t("footer.allRightsReserved")}
          </p>
          <div className={styles.incubation}>
            <b>{t("footer.supportedIncubatedAt")}</b>
            <span>IIM Lucknow · IIT Mandi · IIHMR · Deshpande Foundation · MSMF</span>
          </div>
        </div>

      </div>
    </footer>
  );
}
