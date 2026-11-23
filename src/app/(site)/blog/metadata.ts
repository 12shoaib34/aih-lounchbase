import type { Metadata } from "next";
const SITE_ORIGIN = "https://appsinhours.com";

const image = { url: SITE_ORIGIN + "/appsinhours-social.png", width: 1200, height: 630, alt: "AppsInHours" };

export function blogMetadata(title: string, description: string, path: string, type: "article" | "website"): Metadata {
  const url = SITE_ORIGIN + path;
  return {
    title,
    description,
    alternates: { canonical: url },
    openGraph: { type, url, title, description, siteName: "AppsInHours", images: [image] },
    twitter: { card: "summary_large_image", title, description, images: [image] },
  };
}
