/**
 * Seed production tournament imageUrl values.
 *
 * This script patches each tournament in production to reference the
 * corresponding static image already served by the API server at
 * /api/static/tournament-images/.
 *
 * Usage (requires ADMIN_USERNAME / ADMIN_PASSWORD env vars and a reachable API):
 *   BASE_URL=https://gorovo.replit.app pnpm --filter @workspace/scripts run seed-tournament-images
 *
 * The script is idempotent — it is safe to re-run if imageUrls need to be reset.
 */

const BASE_URL = process.env.BASE_URL ?? "https://gorovo.replit.app";
const ADMIN_USERNAME = process.env.ADMIN_USERNAME ?? "";
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD ?? "";
const IMG = "/api/static/tournament-images";

interface TournamentPatch {
  name: string;
  imageFile: string;
}

/**
 * Ordered list of (tournament name → image file) mappings.
 * The name is matched against the `name` field returned by GET /api/tournaments.
 */
const PATCHES: TournamentPatch[] = [
  { name: "SCVA Boys Las Vegas Classic",           imageFile: "tournament_las-vegas-boys.jpg" },
  { name: "Colorado Crossroads",                   imageFile: "tournament_denver.jpg" },
  { name: "Lone Star Classic (Girls)",             imageFile: "tournament_dallas-girls.jpg" },
  { name: "Big South National Qualifier",          imageFile: "tournament_atlanta.jpg" },
  { name: "Windy City National Qualifier",         imageFile: "tournament_chicago.jpg" },
  { name: "Northern Lights National Qualifier",    imageFile: "tournament_minneapolis.jpg" },
  { name: "Boys Bid Tournament — Las Vegas",       imageFile: "tournament_las-vegas-boys.jpg" },
  { name: "Northeast Qualifier (NEQ)",             imageFile: "tournament_philadelphia.jpg" },
  { name: "Mid-East Qualifier (MEQ)",              imageFile: "tournament_indianapolis.jpg" },
  { name: "Lone Star Classic (Boys)",              imageFile: "tournament_dallas-boys.jpg" },
  { name: "Triple Crown NIT (Girls)",              imageFile: "tournament_kansas-city.jpg" },
  { name: "Mideast Power League Championship",     imageFile: "tournament_columbus.jpg" },
  { name: "JVA West Coast Cup",                   imageFile: "tournament_anaheim.jpg" },
  { name: "AAU Boys Junior Nationals",             imageFile: "tournament_orlando-boys.jpg" },
  { name: "AAU Girls Junior Nationals",            imageFile: "tournament_orlando-girls.jpg" },
  { name: "Boys Junior National Championships (USAV)", imageFile: "tournament_phoenix.jpg" },
  { name: "Girls Junior National Championships (USAV)", imageFile: "tournament_indianapolis-girls.jpg" },
];

async function adminFetch(method: string, path: string, body?: unknown) {
  const credentials = Buffer.from(`${ADMIN_USERNAME}:${ADMIN_PASSWORD}`).toString("base64");
  const res = await fetch(`${BASE_URL}/api${path}`, {
    method,
    headers: {
      "Content-Type": "application/json",
      Authorization: `Basic ${credentials}`,
    },
    body: body !== undefined ? JSON.stringify(body) : undefined,
  });
  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new Error(`${method} ${path} → ${res.status}: ${text}`);
  }
  return res.json();
}

async function main() {
  if (!ADMIN_USERNAME || !ADMIN_PASSWORD) {
    console.error("ADMIN_USERNAME and ADMIN_PASSWORD must be set");
    process.exit(1);
  }

  console.log(`Fetching tournaments from ${BASE_URL}…`);
  const tournaments = (await adminFetch("GET", "/tournaments?includePast=true")) as Array<{
    id: string;
    name: string;
    imageUrl?: string | null;
  }>;
  console.log(`Found ${tournaments.length} tournament(s)`);

  let patched = 0;
  let skipped = 0;
  let missing = 0;

  for (const patch of PATCHES) {
    const tournament = tournaments.find((t) => t.name === patch.name);
    if (!tournament) {
      console.warn(`  MISSING  "${patch.name}" — not found in DB`);
      missing++;
      continue;
    }
    const imageUrl = `${IMG}/${patch.imageFile}`;
    await adminFetch("PUT", `/tournaments/${tournament.id}`, { imageUrl });
    console.log(`  PATCHED  "${patch.name}" → ${imageUrl}`);
    patched++;
  }

  console.log(`\nDone. patched=${patched} skipped=${skipped} missing=${missing}`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
