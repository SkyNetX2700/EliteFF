import { useEffect } from "react";
import { useLocation } from "wouter";

const SITE_NAME = "Elite FF";
const DEFAULT_DESCRIPTION =
  "Join Free Fire tournaments, register your squad, track live scores, and compete for prizes with Elite FF.";

const pageSeo: Record<string, { title: string; description: string }> = {
  "/": {
    title: "Free Fire Tournaments in India | Elite FF",
    description: DEFAULT_DESCRIPTION,
  },
  "/tournaments": {
    title: "Free Fire Tournaments | Elite FF",
    description: "Browse upcoming Solo, Duo, and Squad Free Fire tournaments on Elite FF.",
  },
  "/results": {
    title: "Free Fire Tournament Results | Elite FF",
    description: "View completed Elite FF tournament results, rankings, and prize winners.",
  },
  "/leaderboard": {
    title: "Free Fire Leaderboard | Elite FF",
    description: "See the top Elite FF Free Fire players and their current tournament rankings.",
  },
  "/feedback": {
    title: "Elite FF Player Feedback",
    description: "Share feedback with the Elite FF team and help improve Free Fire tournament experiences.",
  },
};

function upsertMeta(attribute: "name" | "property", key: string, content: string) {
  let element = document.head.querySelector<HTMLMetaElement>(`meta[${attribute}="${key}"]`);
  if (!element) {
    element = document.createElement("meta");
    element.setAttribute(attribute, key);
    document.head.appendChild(element);
  }
  element.content = content;
}

function upsertLink(rel: string, href: string) {
  let element = document.head.querySelector<HTMLLinkElement>(`link[rel="${rel}"]`);
  if (!element) {
    element = document.createElement("link");
    element.rel = rel;
    document.head.appendChild(element);
  }
  element.href = href;
}

export default function SeoManager() {
  const [location] = useLocation();

  useEffect(() => {
    const path = location.split("?")[0] || "/";
    const seo = pageSeo[path] ?? {
      title: "Elite FF Free Fire Tournaments",
      description: DEFAULT_DESCRIPTION,
    };
    const canonicalUrl = new URL(path, window.location.origin).href;
    const imageUrl = new URL("/opengraph.jpg", window.location.origin).href;

    document.title = seo.title;
    upsertMeta("name", "description", seo.description);
    upsertMeta("name", "robots", "index, follow");
    upsertMeta("property", "og:title", seo.title);
    upsertMeta("property", "og:description", seo.description);
    upsertMeta("property", "og:url", canonicalUrl);
    upsertMeta("property", "og:image", imageUrl);
    upsertMeta("property", "og:type", "website");
    upsertMeta("property", "og:site_name", SITE_NAME);
    upsertMeta("property", "og:locale", "en_IN");
    upsertMeta("name", "twitter:card", "summary_large_image");
    upsertMeta("name", "twitter:title", seo.title);
    upsertMeta("name", "twitter:description", seo.description);
    upsertMeta("name", "twitter:image", imageUrl);
    upsertMeta("name", "theme-color", "#0a0e27");
    upsertLink("canonical", canonicalUrl);

    const existingSchema = document.getElementById("elite-ff-website-schema");
    if (!existingSchema) {
      const schema = document.createElement("script");
      schema.id = "elite-ff-website-schema";
      schema.type = "application/ld+json";
      schema.textContent = JSON.stringify({
        "@context": "https://schema.org",
        "@graph": [
          {
            "@type": "WebSite",
            name: SITE_NAME,
            url: new URL("/", window.location.origin).href,
            description: DEFAULT_DESCRIPTION,
          },
          {
            "@type": "Organization",
            name: SITE_NAME,
            url: new URL("/", window.location.origin).href,
            logo: imageUrl,
          },
        ],
      });
      document.head.appendChild(schema);
    }
  }, [location]);

  return null;
}