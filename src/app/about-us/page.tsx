import type { Metadata } from "next";
import Link from "next/link";
import s from "./about-us.module.css";
import ts from "@/components/homepage/homepage.module.css";

export const metadata: Metadata = {
  title: "About Us | EasyHeals",
  description:
    "Learn about EasyHeals — India's AI-powered healthcare discovery platform. Our mission, founding team, and the values that drive us.",
};

const STATS = [
  { value: "12,000+", label: "Verified Hospitals" },
  { value: "5,000+",  label: "Specialist Doctors" },
  { value: "50+",     label: "Cities Covered" },
  { value: "9",       label: "Languages Supported" },
];

const VALUES = [
  { icon: "🤝", title: "Accessibility First",    desc: "Every patient deserves frictionless access to quality healthcare, regardless of language or location." },
  { icon: "✅", title: "Trust & Transparency",   desc: "Only verified, community-reviewed hospitals and doctors — no pay-to-rank listings." },
  { icon: "🤖", title: "AI for Good",             desc: "Our Gemini-powered AI understands real people in their own language, not just English search terms." },
  { icon: "💚", title: "Free for Patients",       desc: "EasyHeals is and always will be free for patients. Healthcare discovery should never carry a price tag." },
];

const TEAM = [
  { name: "Biswajit Saha",     role: "Founder & CEO", avatar: "BS", color: "#1B8A4A", bio: "Drives product strategy and vision, bringing 20+ years of healthcare and technology leadership to EasyHeals." },
  { name: "Sharvari Malushte", role: "Founder & COO", avatar: "SM", color: "#0369A1", bio: "Leads operations and partnerships, ensuring EasyHeals delivers seamless healthcare access across every city." },
  { name: "Raman Chirania",    role: "Founder & CTO", avatar: "RC", color: "#7C3AED", bio: "Architects the AI and engineering platform that powers multilingual healthcare discovery at scale." },
];

export default function AboutUsPage() {
  return (
    <main style={{ minHeight: "100vh", background: "#f8faf9" }}>

      {/* ── Back nav ── */}
      <div className={s.wrap} style={{ paddingTop: 24, paddingBottom: 0 }}>
        <Link href="/" style={{ color: "#1B8A4A", fontWeight: 600, fontSize: 14, textDecoration: "none", display: "inline-flex", alignItems: "center", gap: 6 }}>
          ← Back to Home
        </Link>
      </div>

      {/* ── Hero ── */}
      <section style={{
        background: "linear-gradient(135deg, #0F2118 0%, #1a3d28 60%, #1B8A4A 100%)",
        color: "#fff",
        padding: "72px 24px 64px",
        textAlign: "center",
        marginTop: 20,
      }}>
        <div style={{ maxWidth: 680, margin: "0 auto" }}>
          <span style={{
            display: "inline-block",
            background: "rgba(255,255,255,0.12)",
            border: "1px solid rgba(255,255,255,0.2)",
            borderRadius: 99,
            padding: "5px 16px",
            fontSize: 12,
            fontWeight: 700,
            letterSpacing: "0.08em",
            textTransform: "uppercase",
            marginBottom: 20,
          }}>
            ✦ Our Story
          </span>
          <h1 style={{ fontFamily: "var(--font-bricolage), sans-serif", fontSize: "clamp(30px, 5vw, 48px)", fontWeight: 800, lineHeight: 1.1, letterSpacing: "-0.02em", marginBottom: 20 }}>
            Easy access to Healthcare
          </h1>
          <p style={{ fontSize: 17, lineHeight: 1.7, color: "rgba(255,255,255,0.82)", maxWidth: 560, margin: "0 auto" }}>
            India's AI-powered healthcare discovery platform — connecting patients to verified hospitals, specialist doctors, treatments and lab tests across 50+ cities, in their own language.
          </p>
        </div>
      </section>

      {/* ── Stats ── */}
      <div className={s.statsGrid}>
        {STATS.map((s2) => (
          <div key={s2.label} className={s.statItem}>
            <div className={s.statValue}>{s2.value}</div>
            <div className={s.statLabel}>{s2.label}</div>
          </div>
        ))}
      </div>

      {/* ── Mission ── */}
      <section className={s.section}>
        <div className={s.wrap}>
          <div className={s.missionGrid}>
            <div className={s.missionText}>
              <span className={s.sectionLabel}>Our Mission</span>
              <h2 className={s.sectionHeading} style={{ marginBottom: 0 }}>
                Affordable wellness solutions for everyone
              </h2>
              <p>
                EasyHeals was born from a simple belief: finding the right doctor or hospital should never be hard or expensive. Our team of healthcare consultants, engineers, strategists, and enthusiasts brings over 20 years of combined IT and healthcare expertise to build the platform India needs.
              </p>
              <p>
                We cover everything from routine health checkups to serious surgery — patients log on, discover the right care, book appointments, and share feedback, all in one place.
              </p>
            </div>
            <div className={s.missionCard}>
              {[
                { icon: "💊", text: "Treatments & Procedures" },
                { icon: "👨‍⚕️", text: "Doctor Appointments" },
                { icon: "🏥", text: "Hospital Appointments" },
                { icon: "🔬", text: "Lab Tests & Diagnostics" },
              ].map((item) => (
                <div key={item.text} className={s.missionCardItem}>
                  <span className={s.missionCardIcon}>{item.icon}</span>
                  <span className={s.missionCardText}>{item.text}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* ── Values ── */}
      <section className={s.section} style={{ background: "#fff", borderTop: "1px solid #e8f0ec", borderBottom: "1px solid #e8f0ec" }}>
        <div className={s.wrap}>
          <span className={s.sectionLabel}>What We Stand For</span>
          <h2 className={s.sectionHeading}>Our Values</h2>
          <div className={s.cardsGrid}>
            {VALUES.map((v) => (
              <div key={v.title} className={s.card}>
                <div className={s.cardIcon}>{v.icon}</div>
                <div className={s.cardTitle}>{v.title}</div>
                <div className={s.cardDesc}>{v.desc}</div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── Team ── */}
      <section className={s.section}>
        <div className={s.wrap}>
          <span className={s.sectionLabel}>The Founders</span>
          <h2 className={s.sectionHeading}>Meet the team</h2>
          <div className={s.teamGrid}>
            {TEAM.map((m) => (
              <div key={m.name} className={s.card}>
                <div className={s.teamAvatar} style={{ background: m.color }}>{m.avatar}</div>
                <div className={s.teamName}>{m.name}</div>
                <div className={s.teamRole} style={{ color: m.color }}>{m.role}</div>
                <div className={s.teamBio}>{m.bio}</div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── Incubators — homepage trust section style ── */}
      <section className={ts.trustSection} aria-label="Institutional support">
        <div className={ts.trustInner}>
          <h2 className={ts.trustLabel}>Supported &amp; Incubated at</h2>
          <div className={ts.trustLogos}>
            <div className={ts.trustBadge}>
              <img src="/logos/iiml.png" alt="IIM Lucknow" className={ts.trustLogo} />
              <div className={ts.trustBadgeText}><strong>IIM Lucknow</strong><small>Academic Partner</small></div>
            </div>
            <div className={ts.trustBadge}>
              <img src="/logos/iitmandi.png" alt="IIT Mandi" className={ts.trustLogo} />
              <div className={ts.trustBadgeText}><strong>IIT Mandi</strong><small>Research Partner</small></div>
            </div>
            <div className={ts.trustBadge}>
              <img src="/logos/iihmr.png" alt="IIHMR" className={ts.trustLogo} />
              <div className={ts.trustBadgeText}><strong>IIHMR</strong><small>Health Policy Partner</small></div>
            </div>
            <div className={ts.trustBadge}>
              <img src="/logos/deshpande-foundation.png" alt="Deshpande Foundation" className={ts.trustLogo} />
              <div className={ts.trustBadgeText}><strong>Deshpande Foundation</strong><small>Incubator</small></div>
            </div>
            <div className={ts.trustBadge}>
              <img src="/logos/msmf.png" alt="MSMF" className={ts.trustLogo} />
              <div className={ts.trustBadgeText}><strong>MSMF</strong><small>Healthcare Incubator</small></div>
            </div>
          </div>
        </div>
      </section>

      {/* ── Contact ── */}
      <section className={s.section}>
        <div className={s.wrap}>
          <div className={s.contactCard}>
            <div>
              <h2 style={{ fontFamily: "var(--font-bricolage), sans-serif", fontSize: 22, fontWeight: 800, color: "#0F2118", marginBottom: 16 }}>
                Get in touch
              </h2>
              <div className={s.contactLinks}>
                <a href="tel:+919175576299" className={s.contactLink}>📞 +91-9175576299</a>
                <a href="mailto:sales@easyheals.com" className={s.contactLink}>✉️ sales@easyheals.com</a>
                <span className={s.contactAddress}>📍 Pimple Saudagar, Pune 411027</span>
              </div>
            </div>
            <div className={s.ctaRow}>
              <Link href="/ask" className={s.ctaPrimary}>Try AI Health Assistant →</Link>
              <Link href="/register" className={s.ctaSecondary}>List Your Hospital</Link>
            </div>
          </div>
        </div>
      </section>

    </main>
  );
}
