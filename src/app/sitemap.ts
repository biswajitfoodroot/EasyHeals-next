import type { MetadataRoute } from "next";

import { listAllSlugs } from "@/lib/profile-data";

export const revalidate = 3600;

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const base = "https://easyheals-next.com";
  const now = new Date();

  const { hospitals, doctors, treatments } = await listAllSlugs();

  const staticRoutes: MetadataRoute.Sitemap = [
    { url: `${base}/`, lastModified: now, changeFrequency: "daily", priority: 1 },
    { url: `${base}/hospitals`, lastModified: now, changeFrequency: "daily", priority: 0.9 },
    { url: `${base}/doctors`, lastModified: now, changeFrequency: "daily", priority: 0.9 },
    { url: `${base}/treatments`, lastModified: now, changeFrequency: "weekly", priority: 0.8 },
  ];

  const hospitalRoutes: MetadataRoute.Sitemap = hospitals.map((slug) => ({
    url: `${base}/hospitals/${slug}`,
    lastModified: now,
    changeFrequency: "weekly",
    priority: 0.8,
  }));

  const doctorRoutes: MetadataRoute.Sitemap = doctors.map((slug) => ({
    url: `${base}/doctors/${slug}`,
    lastModified: now,
    changeFrequency: "weekly",
    priority: 0.7,
  }));

  const treatmentRoutes: MetadataRoute.Sitemap = treatments.map((slug) => ({
    url: `${base}/treatments/${slug}`,
    lastModified: now,
    changeFrequency: "monthly",
    priority: 0.7,
  }));

  return [...staticRoutes, ...hospitalRoutes, ...doctorRoutes, ...treatmentRoutes];
}
