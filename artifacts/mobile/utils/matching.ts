/** Pilot matching rules — keep in sync with api-server/src/lib/matching.ts */
export const MATCH_WINDOW_MS = 60 * 60 * 1000;

export function normalizeAirportCode(airport: string): string {
  return airport.trim().toUpperCase();
}

export function normalizeHotelName(hotel: string): string {
  return hotel.trim().toLowerCase().replace(/\s+/g, " ");
}

export function isValidPlaceId(placeId: string | null | undefined): placeId is string {
  if (!placeId) return false;
  const id = placeId.trim();
  if (!id) return false;
  if (id.startsWith("manual-") || id.startsWith("shared-") || id.startsWith("local-")) {
    return false;
  }
  return true;
}

export function hotelsMatch(
  hotelA: string,
  placeIdA: string | null | undefined,
  hotelB: string,
  placeIdB: string | null | undefined,
): boolean {
  if (isValidPlaceId(placeIdA) && isValidPlaceId(placeIdB)) {
    return placeIdA.trim() === placeIdB.trim();
  }
  const a = normalizeHotelName(hotelA);
  const b = normalizeHotelName(hotelB);
  if (!a || !b) return false;
  return a === b;
}

export function airportsMatch(a: string, b: string): boolean {
  return normalizeAirportCode(a) === normalizeAirportCode(b);
}

export function isWithinMatchWindow(a: Date | string, b: Date | string): boolean {
  const ta = new Date(a).getTime();
  const tb = new Date(b).getTime();
  if (Number.isNaN(ta) || Number.isNaN(tb)) return false;
  return Math.abs(ta - tb) <= MATCH_WINDOW_MS;
}
