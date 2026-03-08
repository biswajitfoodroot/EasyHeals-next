import Image from "next/image";
import Link from "next/link";

import AISearchExperience from "@/components/AISearchExperience";
import { easyHealsPublicData } from "@/data/easyhealsPublicData";

const socialIcons = ["facebook", "instagram", "linkedin", "youtube", "twitter"];

export default function Home() {
  return (
    <main className="home-main premium-home">
      <section className="hero-panel-pro">
        <div className="hero-copy">
          <p className="eyebrow">Smart Healthcare Discovery</p>
          <h1>Professional, interactive healthcare search with AI assistance.</h1>
          <p>
            EasyHeals Next combines chat-driven search, structured treatment navigation, and high-conversion
            discovery flows for hospitals and patients.
          </p>
          <div className="hero-actions">
            <Link href="/hospitals" className="cta-primary">
              Explore Hospitals
            </Link>
            <Link href="/treatments" className="cta-secondary">
              Browse Treatments
            </Link>
          </div>
          <div className="service-strip">
            {easyHealsPublicData.services.map((service) => (
              <span key={service}>{service}</span>
            ))}
          </div>
        </div>

        <div className="hero-visual">
          <Image
            unoptimized
            src="https://easyheals.com/easyHealsLogo.svg"
            alt="EasyHeals logo"
            className="logo-art"
            width={188}
            height={58}
          />
          <div className="badge-row">
            <Image
              unoptimized
              src="https://easyheals.com/downloads/google_play_store.svg"
              alt="Google Play"
              width={144}
              height={48}
            />
            <Image
              unoptimized
              src="https://easyheals.com/downloads/app_store.svg"
              alt="App Store"
              width={132}
              height={48}
            />
          </div>
          <div className="social-row" aria-label="EasyHeals social channels">
            {socialIcons.map((icon) => (
              <Image
                unoptimized
                key={icon}
                src={`https://easyheals.com/social_media/${icon}.svg`}
                alt={`${icon} icon`}
                width={24}
                height={24}
              />
            ))}
          </div>
        </div>
      </section>

      <AISearchExperience />

      <section className="info-grid">
        <article className="info-card">
          <h2>Trending Specialties</h2>
          <div className="chip-grid">
            {easyHealsPublicData.specialties.slice(0, 8).map((item) => (
              <span className="chip" key={item}>
                {item}
              </span>
            ))}
          </div>
        </article>

        <article className="info-card">
          <h2>Popular Treatments</h2>
          <ul>
            {easyHealsPublicData.treatments.slice(0, 6).map((item) => (
              <li key={item}>{item}</li>
            ))}
          </ul>
        </article>

        <article className="info-card contact-card">
          <h2>Need Human Support?</h2>
          <div>
            <Image
              unoptimized
              src="https://easyheals.com/contact_info/phone.svg"
              alt="Phone"
              width={16}
              height={16}
            />
            <span>{easyHealsPublicData.contact.phone}</span>
          </div>
          <div>
            <Image
              unoptimized
              src="https://easyheals.com/contact_info/mail.svg"
              alt="Email"
              width={16}
              height={16}
            />
            <span>{easyHealsPublicData.contact.email}</span>
          </div>
          <div>
            <Image
              unoptimized
              src="https://easyheals.com/contact_info/address.svg"
              alt="Address"
              width={16}
              height={16}
            />
            <span>{easyHealsPublicData.contact.address}</span>
          </div>
        </article>
      </section>
    </main>
  );
}
