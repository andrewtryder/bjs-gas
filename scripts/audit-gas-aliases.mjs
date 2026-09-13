import { readFileSync, existsSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const here = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(here, "..");
const clubsPath = path.join(root, "data", "clubs.json");
const aliasesPath = path.join(root, "data", "gas-station-aliases.json");

const clubs = JSON.parse(readFileSync(clubsPath, "utf8"));
const aliases = existsSync(aliasesPath) ? JSON.parse(readFileSync(aliasesPath, "utf8")) : {};

function haversine(lat1, lon1, lat2, lon2) {
  const R = 3958.8; // miles
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLon = ((lon2 - lon1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos((lat1 * Math.PI) / 180) * Math.cos((lat2 * Math.PI) / 180) * Math.sin(dLon / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(a));
}

const dedicated = clubs.filter((c) => /gas station$/i.test(c.name?.trim() || ""));

console.log(`\nAuditing ${dedicated.length} dedicated gas stations against authoritative registry:`);
console.log("----------------------------------------------------------------------------------");

for (const d of dedicated) {
  const mappedParent = Object.entries(aliases).find(([, target]) => target === d.clubNumber)?.[0];
  const sameStateWarehouses = clubs
    .filter((c) => !/gas station$/i.test(c.name?.trim() || "") && c.state === d.state && c.latitude && c.longitude)
    .map((c) => ({
      ...c,
      dist: haversine(d.latitude, d.longitude, c.latitude, c.longitude),
    }))
    .sort((a, b) => a.dist - b.dist);

  const closest = sameStateWarehouses[0];
  const status = mappedParent
    ? `ALIASED from #${mappedParent} (${clubs.find((c) => c.clubNumber === Number(mappedParent))?.name})`
    : `STANDALONE (closest: #${closest?.clubNumber} ${closest?.name}, ${closest?.dist.toFixed(2)} mi)`;

  console.log(`Club #${d.clubNumber} ${d.name} (${d.city}, ${d.state})`);
  console.log(`  Address: ${d.address1}`);
  console.log(`  Status:  ${status}`);
}
console.log("----------------------------------------------------------------------------------\n");
