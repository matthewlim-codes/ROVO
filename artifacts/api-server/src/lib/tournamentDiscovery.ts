import OpenAI from "openai";
import { db } from "@workspace/db";
import { tournamentsTable, insertTournamentSchema } from "@workspace/db/schema";
import { logger } from "./logger";

const DISCOVERY_INTERVAL_MS = 24 * 60 * 60 * 1000;

function makeClient(): OpenAI | null {
  const baseURL = process.env["AI_INTEGRATIONS_OPENAI_BASE_URL"];
  const apiKey = process.env["AI_INTEGRATIONS_OPENAI_API_KEY"];
  if (!baseURL || !apiKey) return null;
  return new OpenAI({ baseURL, apiKey });
}

function threeMonthsFromNow(): string {
  const d = new Date();
  d.setMonth(d.getMonth() + 3);
  return d.toISOString().slice(0, 10);
}

function todayISO(): string {
  return new Date().toISOString().slice(0, 10);
}

interface DiscoveredTournament {
  name: string;
  location: string;
  startDate: string;
  endDate: string;
  gender: "boys" | "girls" | "coed";
  dates?: string;
  description?: string;
}

function buildPrompt(existingNames: string[], today: string, cutoff: string): string {
  return `Today is ${today}. Search the web and find major club volleyball tournaments taking place between ${today} and ${cutoff}.

Focus on:
- USAV Girls/Boys Junior National Championships and qualifiers
- AAU Junior Volleyball Championships and qualifiers
- JVA circuit events (Windy City, NEQ, MEQ, etc.)
- Large invitational events (Colorado Crossroads, Big South, etc.)

Return ONLY a JSON array (no markdown, no explanation) of tournaments you find. Each item must have:
- "name": full official tournament name
- "location": "City, State" (or "City, State (Venue)" if venue is well-known)
- "startDate": "YYYY-MM-DD"
- "endDate": "YYYY-MM-DD"
- "gender": "boys", "girls", or "coed"
- "dates": display string like "Jun 19–21, 2026" (optional, derive from dates if omitted)
- "description": one sentence about the event (optional)

Exclude any tournament whose name exactly matches one of these already in the database:
${existingNames.length ? existingNames.map((n) => `- ${n}`).join("\n") : "(none yet)"}

Return [] if nothing found. Return only valid JSON.`;
}

export async function discoverAndImportTournaments(): Promise<void> {
  const client = makeClient();
  if (!client) {
    logger.warn("Tournament discovery skipped — OpenAI env vars not configured");
    return;
  }

  const today = todayISO();
  const cutoff = threeMonthsFromNow();

  const existing = await db.select({ name: tournamentsTable.name }).from(tournamentsTable);
  const existingNames = existing.map((r) => r.name);

  logger.info({ today, cutoff, existingCount: existingNames.length }, "Tournament discovery starting");

  let rawJson = "";
  try {
    const response = await (client.responses as any).create({
      model: "gpt-5.4",
      tools: [{ type: "web_search_preview" }],
      input: buildPrompt(existingNames, today, cutoff),
    });

    const outputText = response.output
      ?.filter((b: any) => b.type === "message")
      ?.flatMap((b: any) => b.content ?? [])
      ?.filter((c: any) => c.type === "output_text")
      ?.map((c: any) => c.text)
      ?.join("") ?? "";

    rawJson = outputText.trim();
    if (rawJson.startsWith("```")) {
      rawJson = rawJson.replace(/^```(?:json)?\n?/, "").replace(/\n?```$/, "");
    }
  } catch (e) {
    logger.error({ err: e }, "Tournament discovery LLM call failed");
    return;
  }

  let discovered: DiscoveredTournament[];
  try {
    discovered = JSON.parse(rawJson);
    if (!Array.isArray(discovered)) throw new Error("Expected array");
  } catch (e) {
    logger.warn({ rawJson: rawJson.slice(0, 500) }, "Tournament discovery: could not parse LLM response");
    return;
  }

  const existingSet = new Set(existingNames.map((n) => n.toLowerCase().trim()));
  let inserted = 0;
  let skipped = 0;

  for (const t of discovered) {
    if (!t.name || !t.startDate || !t.endDate) {
      logger.warn({ tournament: t }, "Tournament discovery: skipping entry with missing fields");
      skipped++;
      continue;
    }

    if (existingSet.has(t.name.toLowerCase().trim())) {
      skipped++;
      continue;
    }

    const months = ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"];
    const s = new Date(t.startDate + "T00:00:00");
    const e = new Date(t.endDate + "T00:00:00");
    const autoDisplay =
      s.getUTCMonth() === e.getUTCMonth()
        ? `${months[s.getUTCMonth()]} ${s.getUTCDate()}–${e.getUTCDate()}, ${s.getUTCFullYear()}`
        : `${months[s.getUTCMonth()]} ${s.getUTCDate()}–${months[e.getUTCMonth()]} ${e.getUTCDate()}, ${s.getUTCFullYear()}`;

    const payload = {
      name: t.name.trim(),
      location: (t.location ?? "").trim(),
      dates: (t.dates ?? "").trim() || autoDisplay,
      startDate: t.startDate,
      endDate: t.endDate,
      gender: (["boys","girls","coed"].includes(t.gender) ? t.gender : "coed") as "boys"|"girls"|"coed",
      description: t.description ?? null,
      imageUrl: null,
    };

    const parsed = insertTournamentSchema.safeParse(payload);
    if (!parsed.success) {
      logger.warn({ name: t.name, errors: parsed.error.issues }, "Tournament discovery: schema validation failed, skipping");
      skipped++;
      continue;
    }

    try {
      await db.insert(tournamentsTable).values(parsed.data);
      existingSet.add(t.name.toLowerCase().trim());
      inserted++;
      logger.info({ name: t.name }, "Tournament discovery: inserted");
    } catch (e) {
      logger.warn({ name: t.name, err: e }, "Tournament discovery: DB insert failed");
      skipped++;
    }
  }

  logger.info(
    { found: discovered.length, inserted, skipped },
    "Tournament discovery complete"
  );
}

export function startDiscoveryJob(): void {
  setTimeout(() => void discoverAndImportTournaments(), 10_000);
  setInterval(() => void discoverAndImportTournaments(), DISCOVERY_INTERVAL_MS);
}
