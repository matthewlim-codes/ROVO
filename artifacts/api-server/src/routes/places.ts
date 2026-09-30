import { Router } from "express";
import { airportFromCode, searchLocalAirports } from "../lib/airports";

const router = Router();

const GOOGLE_MAPS_API_KEY = process.env.GOOGLE_MAPS_API_KEY ?? "";

interface PlaceResult {
  placeId: string;
  name: string;
  address: string;
  rating?: number;
  types?: string[];
  iataCode?: string | null;
  source?: "local" | "google";
}

interface SearchOutcome {
  results: PlaceResult[];
  upstreamError?: string;
  usedFallback?: boolean;
}

function friendlyUpstreamMessage(raw?: string): string | undefined {
  if (!raw) return undefined;
  const lower = raw.toLowerCase();
  if (
    lower.includes("billing") ||
    lower.includes("REQUEST_DENIED") ||
    lower.includes("request_denied") ||
    lower.includes("api key") ||
    lower.includes("not authorized")
  ) {
    return "Live place search is temporarily unavailable. You can still pick from the list or enter details manually.";
  }
  if (lower.includes("OVER_QUERY_LIMIT") || lower.includes("over_query")) {
    return "Place search is busy right now. Try again shortly, or enter details manually.";
  }
  return "Live place search is temporarily unavailable. You can still pick from the list or enter details manually.";
}

async function searchPlaces(
  query: string,
  location: string,
  type?: string,
): Promise<SearchOutcome> {
  if (!GOOGLE_MAPS_API_KEY) {
    return { results: [], usedFallback: true };
  }

  try {
    const params = new URLSearchParams({
      query: `${query} in ${location}`,
      key: GOOGLE_MAPS_API_KEY,
    });
    if (type) params.set("type", type);

    const url = `https://maps.googleapis.com/maps/api/place/textsearch/json?${params}`;

    const resp = await fetch(url);
    if (!resp.ok) {
      return {
        results: [],
        upstreamError: friendlyUpstreamMessage(`HTTP ${resp.status}`),
        usedFallback: true,
      };
    }

    const data = (await resp.json()) as {
      status: string;
      error_message?: string;
      results?: Array<{
        place_id: string;
        name: string;
        formatted_address: string;
        rating?: number;
        types?: string[];
      }>;
    };

    if (data.status !== "OK" || !data.results) {
      const upstreamError =
        data.status === "ZERO_RESULTS"
          ? undefined
          : friendlyUpstreamMessage(data.error_message || data.status);
      if (upstreamError) {
        console.warn("[places] Google API error:", data.status, data.error_message);
      }
      return {
        results: [],
        upstreamError,
        usedFallback: data.status !== "ZERO_RESULTS",
      };
    }

    return {
      results: data.results.slice(0, 8).map((r) => ({
        placeId: r.place_id,
        name: r.name,
        address: r.formatted_address,
        rating: r.rating,
        types: r.types,
        source: "google" as const,
      })),
    };
  } catch (e) {
    console.warn("[places] network error:", e);
    return {
      results: [],
      upstreamError: friendlyUpstreamMessage("network"),
      usedFallback: true,
    };
  }
}

router.get("/places/hotels", async (req, res) => {
  const { location, query } = req.query as {
    location?: string;
    query?: string;
  };
  if (!location) {
    return res.status(400).json({ error: "location is required" });
  }

  try {
    const { results, upstreamError, usedFallback } = await searchPlaces(
      query ? `${query} hotel` : "hotels",
      location,
      "lodging",
    );
    return res.json({
      results,
      hasApiKey: !!GOOGLE_MAPS_API_KEY,
      upstreamError,
      usedFallback: !!usedFallback,
      allowManual: true,
    });
  } catch {
    return res.status(500).json({ error: "Places API error" });
  }
});

router.get("/places/airports", async (req, res) => {
  const { location, query } = req.query as {
    location?: string;
    query?: string;
  };
  if (!location) {
    return res.status(400).json({ error: "location is required" });
  }

  try {
    const q = (query ?? "").trim();
    // Prefer local list when the query clearly targets a known code/name —
    // avoids unnecessary Google calls for the pilot.
    const localHits = searchLocalAirports(q, location);
    const exactCode = q && /^[A-Za-z]{3,4}$/.test(q) ? airportFromCode(q) : null;

    if (!GOOGLE_MAPS_API_KEY) {
      const results = exactCode
        ? [
            exactCode,
            ...localHits.filter((a) => a.iataCode !== exactCode.iataCode),
          ]
        : localHits;
      return res.json({
        results,
        hasApiKey: false,
        usedFallback: true,
        allowCustomCode: true,
        upstreamError: undefined,
      });
    }

    // Only hit Google when local list is empty or user is exploring without a strong local hit
    const shouldCallGoogle = localHits.length < 3 || q.length >= 4;

    let googleResults: PlaceResult[] = [];
    let upstreamError: string | undefined;
    let usedFallback = false;

    if (shouldCallGoogle) {
      const outcome = await searchPlaces(
        q ? `${q} airport` : "airports",
        location,
        "airport",
      );
      upstreamError = outcome.upstreamError;
      usedFallback = !!outcome.usedFallback;
      googleResults = outcome.results.map((r) => {
        const match = r.name.match(/\(([A-Z]{3,4})\)/);
        const codeFromName = match ? match[1] : null;
        const codeGuess = extractAirportCode(r.name);
        return {
          ...r,
          iataCode: codeFromName ?? codeGuess ?? null,
          source: "google" as const,
        };
      });
    }

    if (!googleResults.length) {
      const results = exactCode
        ? [
            exactCode,
            ...localHits.filter((a) => a.iataCode !== exactCode.iataCode),
          ]
        : localHits;
      return res.json({
        results,
        hasApiKey: true,
        usedFallback: true,
        allowCustomCode: true,
        upstreamError: upstreamError
          ? friendlyUpstreamMessage(upstreamError)
          : undefined,
      });
    }

    // Merge: local canonical codes first, then google uniques
    const seen = new Set<string>();
    const merged: PlaceResult[] = [];
    for (const a of [...(exactCode ? [exactCode] : []), ...localHits, ...googleResults]) {
      const key = (a.iataCode || a.placeId).toUpperCase();
      if (seen.has(key)) continue;
      seen.add(key);
      merged.push(a);
    }

    return res.json({
      results: merged.slice(0, 12),
      hasApiKey: true,
      usedFallback,
      allowCustomCode: true,
      upstreamError,
    });
  } catch {
    const fallback = searchLocalAirports(
      typeof req.query.query === "string" ? req.query.query : "",
      typeof req.query.location === "string" ? req.query.location : "",
    );
    return res.json({
      results: fallback,
      hasApiKey: !!GOOGLE_MAPS_API_KEY,
      usedFallback: true,
      allowCustomCode: true,
      upstreamError:
        "Live airport search is temporarily unavailable. Showing common US airports instead.",
    });
  }
});

function extractAirportCode(name: string): string | null {
  const known: Array<[string, string]> = [
    ["Dallas Fort Worth", "DFW"],
    ["Dallas/Fort Worth", "DFW"],
    ["Dallas Love Field", "DAL"],
    ["Los Angeles International", "LAX"],
    ["John Wayne", "SNA"],
    ["Long Beach", "LGB"],
    ["Hollywood Burbank", "BUR"],
    ["Bob Hope", "BUR"],
    ["Ontario International", "ONT"],
    ["O'Hare", "ORD"],
    ["Chicago Midway", "MDW"],
    ["Midway International", "MDW"],
    ["Orlando International", "MCO"],
    ["Orlando Sanford", "SFB"],
    ["Tampa International", "TPA"],
    ["Hartsfield-Jackson", "ATL"],
    ["Denver International", "DEN"],
    ["Harry Reid", "LAS"],
    ["McCarran", "LAS"],
    ["Phoenix Sky Harbor", "PHX"],
    ["Seattle-Tacoma", "SEA"],
    ["San Francisco International", "SFO"],
    ["Oakland International", "OAK"],
    ["San Jose", "SJC"],
    ["John F. Kennedy", "JFK"],
    ["LaGuardia", "LGA"],
    ["Newark Liberty", "EWR"],
    ["Miami International", "MIA"],
    ["Fort Lauderdale", "FLL"],
    ["George Bush", "IAH"],
    ["William P. Hobby", "HOU"],
    ["Midland", "MAF"],
    ["Austin-Bergstrom", "AUS"],
    ["San Antonio International", "SAT"],
    ["Boston Logan", "BOS"],
    ["Logan International", "BOS"],
    ["Washington Dulles", "IAD"],
    ["Reagan", "DCA"],
    ["Baltimore", "BWI"],
    ["Philadelphia International", "PHL"],
    ["Detroit Metropolitan", "DTW"],
    ["Minneapolis-Saint Paul", "MSP"],
    ["Salt Lake City", "SLC"],
    ["Portland International", "PDX"],
    ["San Diego International", "SAN"],
    ["Kansas City International", "MCI"],
    ["Indianapolis International", "IND"],
    ["John Glenn Columbus", "CMH"],
    ["Port Columbus", "CMH"],
  ];
  for (const [key, code] of known) {
    if (name.toLowerCase().includes(key.toLowerCase())) return code;
  }
  return null;
}

export default router;
