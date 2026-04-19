import { Router } from "express";

const router = Router();

const GOOGLE_MAPS_API_KEY = process.env.GOOGLE_MAPS_API_KEY ?? "";

interface PlaceResult {
  placeId: string;
  name: string;
  address: string;
  rating?: number;
  types?: string[];
  iataCode?: string;
}

async function searchPlaces(
  query: string,
  location: string,
  types: string[]
): Promise<PlaceResult[]> {
  if (!GOOGLE_MAPS_API_KEY) {
    return [];
  }

  const params = new URLSearchParams({
    query: `${query} near ${location}`,
    key: GOOGLE_MAPS_API_KEY,
  });

  const url = `https://maps.googleapis.com/maps/api/place/textsearch/json?${params}`;

  const resp = await fetch(url);
  if (!resp.ok) return [];

  const data = (await resp.json()) as {
    status: string;
    results?: Array<{
      place_id: string;
      name: string;
      formatted_address: string;
      rating?: number;
      types?: string[];
    }>;
  };

  if (data.status !== "OK" || !data.results) return [];

  return data.results.slice(0, 8).map((r) => ({
    placeId: r.place_id,
    name: r.name,
    address: r.formatted_address,
    rating: r.rating,
    types: r.types,
  }));
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
    const results = await searchPlaces(
      query ? `${query} hotel` : "hotels",
      location,
      ["lodging"]
    );
    res.json({ results, hasApiKey: !!GOOGLE_MAPS_API_KEY });
  } catch (e) {
    res.status(500).json({ error: "Places API error" });
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
    const results = await searchPlaces(
      query ? `${query} airport` : "airports",
      location,
      ["airport"]
    );

    const airports = results.map((r) => {
      const match = r.name.match(/\(([A-Z]{3,4})\)/);
      const codeFromName = match ? match[1] : null;
      const codeGuess = extractAirportCode(r.name);
      return {
        ...r,
        iataCode: codeFromName ?? codeGuess ?? null,
      };
    });

    res.json({ results: airports, hasApiKey: !!GOOGLE_MAPS_API_KEY });
  } catch (e) {
    res.status(500).json({ error: "Places API error" });
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
  ];
  for (const [key, code] of known) {
    if (name.toLowerCase().includes(key.toLowerCase())) return code;
  }
  return null;
}

export default router;
