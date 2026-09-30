export interface LocalAirport {
  code: string;
  name: string;
  city: string;
  state: string;
}

export const US_AIRPORTS: LocalAirport[] = [
  { code: "ATL", name: "Hartsfield-Jackson Atlanta International Airport", city: "Atlanta", state: "GA" },
  { code: "DFW", name: "Dallas/Fort Worth International Airport", city: "Dallas", state: "TX" },
  { code: "DAL", name: "Dallas Love Field", city: "Dallas", state: "TX" },
  { code: "ORD", name: "O'Hare International Airport", city: "Chicago", state: "IL" },
  { code: "MDW", name: "Chicago Midway International Airport", city: "Chicago", state: "IL" },
  { code: "LAX", name: "Los Angeles International Airport", city: "Los Angeles", state: "CA" },
  { code: "SNA", name: "John Wayne Airport", city: "Santa Ana", state: "CA" },
  { code: "LGB", name: "Long Beach Airport", city: "Long Beach", state: "CA" },
  { code: "BUR", name: "Hollywood Burbank Airport", city: "Burbank", state: "CA" },
  { code: "ONT", name: "Ontario International Airport", city: "Ontario", state: "CA" },
  { code: "SFO", name: "San Francisco International Airport", city: "San Francisco", state: "CA" },
  { code: "OAK", name: "Oakland International Airport", city: "Oakland", state: "CA" },
  { code: "SJC", name: "San Jose International Airport", city: "San Jose", state: "CA" },
  { code: "SAN", name: "San Diego International Airport", city: "San Diego", state: "CA" },
  { code: "DEN", name: "Denver International Airport", city: "Denver", state: "CO" },
  { code: "LAS", name: "Harry Reid International Airport", city: "Las Vegas", state: "NV" },
  { code: "PHX", name: "Phoenix Sky Harbor International Airport", city: "Phoenix", state: "AZ" },
  { code: "SEA", name: "Seattle-Tacoma International Airport", city: "Seattle", state: "WA" },
  { code: "PDX", name: "Portland International Airport", city: "Portland", state: "OR" },
  { code: "MCO", name: "Orlando International Airport", city: "Orlando", state: "FL" },
  { code: "SFB", name: "Orlando Sanford International Airport", city: "Sanford", state: "FL" },
  { code: "TPA", name: "Tampa International Airport", city: "Tampa", state: "FL" },
  { code: "MIA", name: "Miami International Airport", city: "Miami", state: "FL" },
  { code: "FLL", name: "Fort Lauderdale-Hollywood International Airport", city: "Fort Lauderdale", state: "FL" },
  { code: "JFK", name: "John F. Kennedy International Airport", city: "New York", state: "NY" },
  { code: "LGA", name: "LaGuardia Airport", city: "New York", state: "NY" },
  { code: "EWR", name: "Newark Liberty International Airport", city: "Newark", state: "NJ" },
  { code: "BOS", name: "Logan International Airport", city: "Boston", state: "MA" },
  { code: "IAD", name: "Washington Dulles International Airport", city: "Dulles", state: "VA" },
  { code: "DCA", name: "Ronald Reagan Washington National Airport", city: "Arlington", state: "VA" },
  { code: "BWI", name: "Baltimore/Washington International Airport", city: "Baltimore", state: "MD" },
  { code: "PHL", name: "Philadelphia International Airport", city: "Philadelphia", state: "PA" },
  { code: "IAH", name: "George Bush Intercontinental Airport", city: "Houston", state: "TX" },
  { code: "HOU", name: "William P. Hobby Airport", city: "Houston", state: "TX" },
  { code: "AUS", name: "Austin-Bergstrom International Airport", city: "Austin", state: "TX" },
  { code: "SAT", name: "San Antonio International Airport", city: "San Antonio", state: "TX" },
  { code: "MAF", name: "Midland International Air and Space Port", city: "Midland", state: "TX" },
  { code: "MSP", name: "Minneapolis-Saint Paul International Airport", city: "Minneapolis", state: "MN" },
  { code: "DTW", name: "Detroit Metropolitan Wayne County Airport", city: "Detroit", state: "MI" },
  { code: "SLC", name: "Salt Lake City International Airport", city: "Salt Lake City", state: "UT" },
  { code: "MCI", name: "Kansas City International Airport", city: "Kansas City", state: "MO" },
  { code: "IND", name: "Indianapolis International Airport", city: "Indianapolis", state: "IN" },
  { code: "CMH", name: "John Glenn Columbus International Airport", city: "Columbus", state: "OH" },
  { code: "CLT", name: "Charlotte Douglas International Airport", city: "Charlotte", state: "NC" },
  { code: "RDU", name: "Raleigh-Durham International Airport", city: "Raleigh", state: "NC" },
  { code: "BNA", name: "Nashville International Airport", city: "Nashville", state: "TN" },
  { code: "STL", name: "St. Louis Lambert International Airport", city: "St. Louis", state: "MO" },
  { code: "MSY", name: "Louis Armstrong New Orleans International Airport", city: "New Orleans", state: "LA" },
];

export interface AirportResultLocal {
  placeId: string;
  name: string;
  address: string;
  iataCode: string;
}

export function searchLocalAirports(
  query: string,
  locationHint?: string,
): AirportResultLocal[] {
  const q = query.trim().toLowerCase();
  const loc = (locationHint ?? "").trim().toLowerCase();

  const scored = US_AIRPORTS.map((a) => {
    const hay = `${a.code} ${a.name} ${a.city} ${a.state}`.toLowerCase();
    let score = 0;
    if (q) {
      if (a.code.toLowerCase() === q) score += 100;
      else if (a.code.toLowerCase().startsWith(q)) score += 80;
      else if (a.city.toLowerCase().startsWith(q)) score += 60;
      else if (hay.includes(q)) score += 40;
      else return null;
    } else if (loc) {
      const cityHint = loc.split(",")[0]?.trim() ?? loc;
      if (a.city.toLowerCase().includes(cityHint) || cityHint.includes(a.city.toLowerCase())) {
        score += 50;
      } else if (hay.includes(cityHint)) {
        score += 30;
      } else {
        return null;
      }
    } else {
      score = 1;
    }
    return { airport: a, score };
  }).filter((x): x is { airport: LocalAirport; score: number } => x !== null);

  scored.sort((a, b) => b.score - a.score || a.airport.code.localeCompare(b.airport.code));

  return scored.slice(0, 12).map(({ airport: a }) => ({
    placeId: `local-${a.code}`,
    name: `${a.name} (${a.code})`,
    address: `${a.city}, ${a.state}`,
    iataCode: a.code,
  }));
}

export function customAirportFromCode(code: string): AirportResultLocal | null {
  const normalized = code.trim().toUpperCase();
  if (!/^[A-Z]{3,4}$/.test(normalized)) return null;
  const known = US_AIRPORTS.find((a) => a.code === normalized);
  if (known) {
    return {
      placeId: `local-${known.code}`,
      name: `${known.name} (${known.code})`,
      address: `${known.city}, ${known.state}`,
      iataCode: known.code,
    };
  }
  return {
    placeId: `local-${normalized}`,
    name: `${normalized} Airport`,
    address: "Airport code entered manually",
    iataCode: normalized,
  };
}
