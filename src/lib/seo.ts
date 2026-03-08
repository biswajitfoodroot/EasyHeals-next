import type { Metadata } from "next";

import { env } from "@/lib/env";

export function absoluteUrl(path = "/") {
  return new URL(path, env.APP_BASE_URL).toString();
}

export function buildMetadata(input: {
  title: string;
  description: string;
  path?: string;
}): Metadata {
  const canonicalPath = input.path ?? "/";

  return {
    title: input.title,
    description: input.description,
    alternates: {
      canonical: canonicalPath,
    },
    openGraph: {
      title: input.title,
      description: input.description,
      url: absoluteUrl(canonicalPath),
      siteName: "EasyHeals Next",
      locale: "en_IN",
      type: "website",
    },
    twitter: {
      card: "summary_large_image",
      title: input.title,
      description: input.description,
    },
  };
}
