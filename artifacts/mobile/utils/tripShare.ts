import type { Tournament, Trip } from "@/context/TripContext";
import { apiFetch, ORIGIN } from "@/utils/api";

export interface TripShareDetails {
  shareId?: string;
  tripId?: string;
  userName: string;
  userTeam?: string;
  tournamentName: string;
  tournamentDates?: string;
  tournamentLocation?: string;
  airport: string;
  hotel: string;
  hotelPlaceId?: string;
  datetime: string;
  mode: "arrival" | "departure";
  partySize?: number;
  baggageCount?: number;
  active?: boolean;
}

const DEFAULT_SHARE_ORIGIN = "https://rovousa.com";
export const PENDING_JOIN_SHARE_KEY = "rsg_pending_join_share_id";

function getShareOrigin(): string {
  if (ORIGIN) return ORIGIN;
  if (typeof window !== "undefined" && window.location?.origin) {
    return window.location.origin;
  }
  return DEFAULT_SHARE_ORIGIN;
}

export interface TripShareRecord {
  id: string;
  active: boolean;
  trip?: {
    id: string;
    userName: string;
    userTeam: string | null;
    tournamentId: string;
    airport: string;
    hotel: string;
    hotelPlaceId: string | null;
    datetime: string;
    mode: "arrival" | "departure";
    baggageCount: number | null;
    partySize: number | null;
  };
  tournament?: {
    id: string;
    name: string;
    location: string;
    dates: string;
    startDate: string;
    endDate: string;
  } | null;
}

export function buildTripShareDetails(
  trip: Trip,
  tournament: Tournament | null | undefined,
  shareId?: string,
): TripShareDetails {
  return {
    shareId,
    tripId: trip.id.replace(/^srv-/, ""),
    userName: trip.userName,
    userTeam: trip.userTeam || undefined,
    tournamentName: tournament?.name ?? "this tournament",
    tournamentDates: tournament?.dates,
    tournamentLocation: tournament?.location,
    airport: trip.airport,
    hotel: trip.hotel,
    hotelPlaceId: trip.hotelPlaceId,
    datetime: trip.datetime,
    mode: trip.mode,
    partySize: trip.partySize,
    baggageCount: trip.baggageCount,
    active: true,
  };
}

export function buildTripShareDetailsFromRecord(
  record: TripShareRecord,
): TripShareDetails | null {
  if (!record.active || !record.trip) return null;
  return {
    shareId: record.id,
    tripId: record.trip.id,
    userName: record.trip.userName,
    userTeam: record.trip.userTeam ?? undefined,
    tournamentName: record.tournament?.name ?? "Tournament rideshare",
    tournamentDates: record.tournament?.dates,
    tournamentLocation: record.tournament?.location,
    airport: record.trip.airport,
    hotel: record.trip.hotel,
    hotelPlaceId: record.trip.hotelPlaceId ?? undefined,
    datetime: record.trip.datetime,
    mode: record.trip.mode,
    partySize: record.trip.partySize ?? undefined,
    baggageCount: record.trip.baggageCount ?? undefined,
    active: true,
  };
}

export function buildTripShortUrl(shareId: string): string {
  return `${getShareOrigin()}/trip/${encodeURIComponent(shareId)}`;
}

export async function createTripShare(tripId: string): Promise<{ id: string; tripId: string }> {
  return apiFetch<{ id: string; tripId: string }>("/trip-shares", {
    method: "POST",
    body: JSON.stringify({ tripId }),
  });
}

export async function fetchTripShare(shareId: string): Promise<TripShareRecord> {
  return apiFetch<TripShareRecord>(`/trip-shares/${encodeURIComponent(shareId)}`);
}

export function formatTripShareDateTime(iso: string): string {
  return new Date(iso).toLocaleString("en-US", {
    weekday: "short",
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

export function formatTripShareTime(iso: string): string {
  return new Date(iso).toLocaleTimeString("en-US", {
    hour: "numeric",
    minute: "2-digit",
  });
}

export function truncateTournamentName(name: string): string {
  return name.length <= 40 ? name : `${name.slice(0, 37).trimEnd()}...`;
}

export function getFamilyName(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (!parts.length) return "Rovo";
  return parts[parts.length - 1].replace(/[^\p{L}\p{N}'-]/gu, "") || parts[0];
}

export function getPeopleLabel(details: Pick<TripShareDetails, "partySize">): string {
  if (!details.partySize) return "Not specified";
  return `${details.partySize} ${details.partySize === 1 ? "person" : "people"}`;
}

export function buildRideshareGroupId(firstTripId: string, secondTripId: string): string {
  const sorted = [firstTripId.replace(/^srv-/, ""), secondTripId.replace(/^srv-/, "")].sort();
  return `rs-${sorted[0]}__${sorted[1]}`;
}

export function buildTripShareMessage(
  details: TripShareDetails,
  shareUrl: string,
): string {
  const familyName = getFamilyName(details.userName);
  const modeLabel = details.mode === "arrival" ? "Arrival" : "Departure";
  const bagsText = details.baggageCount
    ? ` - ${details.baggageCount} ${details.baggageCount === 1 ? "bag" : "bags"}`
    : "";
  return [
    `Rovo Travel Info Card`,
    `${truncateTournamentName(details.tournamentName)}${details.tournamentDates ? ` - ${details.tournamentDates}` : ""}`,
    `${modeLabel}: ${details.airport} at ${formatTripShareTime(details.datetime)}`,
    `Hotel: ${details.hotel}`,
    `Family: ${familyName} - ${getPeopleLabel(details)}${bagsText}`,
    "",
    `Join this ride: ${shareUrl}`,
  ].join("\n");
}
