import type { MetadataRoute } from "next";
import { getStations, getWebBaseUrl } from "../lib/api";
import { toStateSlug } from "../lib/states";

export const dynamic = "force-dynamic";

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const baseUrl = getWebBaseUrl();
  const now = new Date();

  const entries: MetadataRoute.Sitemap = [
    {
      url: baseUrl,
      lastModified: now,
      changeFrequency: "hourly",
      priority: 1.0,
    },
    {
      url: `${baseUrl}/map`,
      lastModified: now,
      changeFrequency: "daily",
      priority: 0.9,
    },
    {
      url: `${baseUrl}/states`,
      lastModified: now,
      changeFrequency: "daily",
      priority: 0.9,
    },
  ];

  try {
    const data = await getStations();
    const stations = data.stations || [];

    // Unique states present in actual station data
    const stateSet = new Set<string>();
    for (const s of stations) {
      if (s.state) stateSet.add(s.state);
    }

    // Add state index pages
    for (const state of Array.from(stateSet).sort()) {
      entries.push({
        url: `${baseUrl}/states/${toStateSlug(state)}`,
        lastModified: now,
        changeFrequency: "daily",
        priority: 0.8,
      });
    }

    // Add station detail pages
    for (const station of stations) {
      // Find latest observedAt from fuels if available
      let lastObserved: Date = now;
      if (station.fuels && station.fuels.length > 0) {
        const times = station.fuels.map((f) => new Date(f.observedAt).getTime()).filter((t) => !Number.isNaN(t));
        if (times.length > 0) {
          lastObserved = new Date(Math.max(...times));
        }
      }

      entries.push({
        url: `${baseUrl}/stations/${station.clubNumber}`,
        lastModified: lastObserved,
        changeFrequency: "daily",
        priority: 0.7,
      });
    }
  } catch (err) {
    console.error("Error generating dynamic sitemap:", err);
  }

  return entries;
}
