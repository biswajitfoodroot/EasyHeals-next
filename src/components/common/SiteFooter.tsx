"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { easyHealsPublicData } from "@/data/easyhealsPublicData";

/**
 * Global Site Footer.
 * Hidden on admin, portal, and provider management endpoints.
 */
export function SiteFooter() {
  const pathname = usePathname();

  // Hide on admin/portal routes
  if (
    pathname.startsWith("/admin") ||
    pathname.startsWith("/portal") ||
    pathname.startsWith("/provider-management") ||
    pathname.startsWith("/dashboard") ||
    pathname.startsWith("/login") ||
    pathname.startsWith("/unauthorized")
  ) {
    return null;
  }

  return (
    <footer style={{ background: "#F8FAF9", borderTop: "1px solid #D0E4D8", padding: "60px 20px 30px", marginTop: "auto" }}>
      <div style={{ maxWidth: "1200px", margin: "0 auto" }}>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(250px, 1fr))", gap: "40px", marginBottom: "40px" }}>
          
          {/* Brand & Contact */}
          <div>
            <Link href="/" style={{ display: "inline-flex", alignItems: "center", gap: "6px", textDecoration: "none", color: "#1A2B23", marginBottom: "16px" }}>
              <img src="/logo.jpg" alt="EasyHeals" style={{ width: 28, height: 28, borderRadius: 6, objectFit: "contain" }} />
              <strong style={{ fontSize: "20px", fontFamily: "var(--font-bricolage), sans-serif", fontWeight: 800, letterSpacing: "-0.02em" }}>
                Easy<b style={{ color: "#1B8A4A" }}>Heals</b>
              </strong>
            </Link>
            <p style={{ fontSize: "14px", lineHeight: 1.6, color: "#5A7367", margin: "0 0 16px" }}>
              EasyHeals Technologies Pvt. Ltd.<br />
              India's AI-powered healthcare platform.
            </p>
            <p style={{ fontSize: "14px", lineHeight: 1.6, color: "#5A7367", margin: 0 }}>
              {easyHealsPublicData.contact.phone} <br />
              {easyHealsPublicData.contact.email} <br />
              {easyHealsPublicData.contact.address}
            </p>
          </div>

          {/* Quick Links */}
          <div>
            <h4 style={{ color: "#1A2B23", fontSize: "15px", fontWeight: 700, marginBottom: "16px", fontFamily: "var(--font-bricolage), sans-serif" }}>Platform</h4>
            <div style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
              <Link href="/hospitals" style={{ color: "#5A7367", textDecoration: "none", fontSize: "14px", transition: "color 0.2s" }} onMouseOver={(e) => e.currentTarget.style.color = "#1B8A4A"} onMouseOut={(e) => e.currentTarget.style.color = "#5A7367"}>Hospitals</Link>
              <Link href="/doctors" style={{ color: "#5A7367", textDecoration: "none", fontSize: "14px", transition: "color 0.2s" }} onMouseOver={(e) => e.currentTarget.style.color = "#1B8A4A"} onMouseOut={(e) => e.currentTarget.style.color = "#5A7367"}>Doctors</Link>
              <Link href="/treatments" style={{ color: "#5A7367", textDecoration: "none", fontSize: "14px", transition: "color 0.2s" }} onMouseOver={(e) => e.currentTarget.style.color = "#1B8A4A"} onMouseOut={(e) => e.currentTarget.style.color = "#5A7367"}>Treatments</Link>
              <Link href="/diagnostics" style={{ color: "#5A7367", textDecoration: "none", fontSize: "14px", transition: "color 0.2s" }} onMouseOver={(e) => e.currentTarget.style.color = "#1B8A4A"} onMouseOut={(e) => e.currentTarget.style.color = "#5A7367"}>Diagnostics</Link>
            </div>
          </div>

          {/* Legal & Providers */}
          <div>
            <h4 style={{ color: "#1A2B23", fontSize: "15px", fontWeight: 700, marginBottom: "16px", fontFamily: "var(--font-bricolage), sans-serif" }}>Legal &amp; Providers</h4>
            <div style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
              <Link href="/privacy-policy" style={{ color: "#5A7367", textDecoration: "none", fontSize: "14px", transition: "color 0.2s" }} onMouseOver={(e) => e.currentTarget.style.color = "#1B8A4A"} onMouseOut={(e) => e.currentTarget.style.color = "#5A7367"}>Privacy Policy</Link>
              <Link href="/terms" style={{ color: "#5A7367", textDecoration: "none", fontSize: "14px", transition: "color 0.2s" }} onMouseOver={(e) => e.currentTarget.style.color = "#1B8A4A"} onMouseOut={(e) => e.currentTarget.style.color = "#5A7367"}>Terms &amp; Conditions</Link>
              <Link href="/register" style={{ display: "inline-block", background: "#1B8A4A", color: "#fff", padding: "8px 16px", borderRadius: "8px", fontWeight: 700, textDecoration: "none", fontSize: "13px", marginTop: "8px", alignSelf: "flex-start", transition: "background 0.2s" }} onMouseOver={(e) => e.currentTarget.style.background = "#136836"} onMouseOut={(e) => e.currentTarget.style.background = "#1B8A4A"}>List Hospital Free &rarr;</Link>
            </div>
          </div>
        </div>

        <div style={{ borderTop: "1px solid #D0E4D8", paddingTop: "24px", display: "flex", flexWrap: "wrap", justifyContent: "space-between", alignItems: "center", gap: "16px" }}>
          <p style={{ margin: 0, fontSize: "13px", color: "#5A7367" }}>
            © {new Date().getFullYear()} EasyHeals Technologies Pvt. Ltd. All rights reserved.
          </p>
          <div style={{ display: "flex", alignItems: "center", gap: "12px", fontSize: "12px", color: "#8FA39A", flexWrap: "wrap" }}>
            <span>Supported by IIM Lucknow, IIT Mandi &amp; IIHMR</span>
            <span style={{ display: "inline-block", backgroundColor: "#D0E4D8", width: 4, height: 4, borderRadius: "50%" }}></span>
            <span>Incubated at Deshpande Foundation &amp; MSMF</span>
          </div>
        </div>
      </div>
    </footer>
  );
}
