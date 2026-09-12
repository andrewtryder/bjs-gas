import type { MetadataRoute } from "next";
import { getWebBaseUrl } from "../lib/api";

export default function robots(): MetadataRoute.Robots {
  const baseUrl = getWebBaseUrl();

  return {
    rules: {
      userAgent: "*",
      allow: "/",
      disallow: ["/internal/", "/api/"],
    },
    sitemap: `${baseUrl}/sitemap.xml`,
  };
}
