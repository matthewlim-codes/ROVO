import type { Tournament, Trip } from "@/context/TripContext";
import { ORIGIN } from "@/utils/api";

export interface TripShareDetails {
  userName: string;
  userTeam?: string;
  tournamentName: string;
  tournamentLocation?: string;
  airport: string;
  hotel: string;
  datetime: string;
  mode: "arrival" | "departure";
  partySize?: number;
  baggageCount?: number;
}

const DEFAULT_SHARE_ORIGIN = "https://rovousa.com";

function getShareOrigin(): string {
  if (ORIGIN) return ORIGIN;
  if (typeof window !== "undefined" && window.location?.origin) {
    return window.location.origin;
  }
  return DEFAULT_SHARE_ORIGIN;
}

function appendParam(params: URLSearchParams, key: string, value: unknown) {
  if (value === undefined || value === null || value === "") return;
  params.set(key, String(value));
}

export function buildTripShareDetails(
  trip: Trip,
  tournament: Tournament | null | undefined,
): TripShareDetails {
  return {
    userName: trip.userName,
    userTeam: trip.userTeam || undefined,
    tournamentName: tournament?.name ?? "this tournament",
    tournamentLocation: tournament?.location,
    airport: trip.airport,
    hotel: trip.hotel,
    datetime: trip.datetime,
    mode: trip.mode,
    partySize: trip.partySize,
    baggageCount: trip.baggageCount,
  };
}

export function buildTripShareUrl(details: TripShareDetails): string {
  const params = new URLSearchParams();
  appendParam(params, "name", details.userName);
  appendParam(params, "team", details.userTeam);
  appendParam(params, "tournament", details.tournamentName);
  appendParam(params, "location", details.tournamentLocation);
  appendParam(params, "airport", details.airport);
  appendParam(params, "hotel", details.hotel);
  appendParam(params, "datetime", details.datetime);
  appendParam(params, "mode", details.mode);
  appendParam(params, "partySize", details.partySize);
  appendParam(params, "baggageCount", details.baggageCount);
  return `${getShareOrigin()}/trip-card?${params.toString()}`;
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

export function buildTripShareMessage(
  details: TripShareDetails,
  shareUrl: string,
): string {
  const direction =
    details.mode === "arrival" ? "arriving at" : "departing from";
  const extras = [
    details.partySize
      ? `${details.partySize} ${details.partySize === 1 ? "person" : "people"}`
      : null,
    details.baggageCount
      ? `${details.baggageCount} ${details.baggageCount === 1 ? "bag" : "bags"}`
      : null,
  ].filter(Boolean);
  const extrasText = extras.length ? ` (${extras.join(", ")})` : "";

  return [
    `${details.userName} shared a Rovo trip card:`,
    `${details.tournamentName}`,
    `${direction} ${details.airport} on ${formatTripShareDateTime(details.datetime)}`,
    `Hotel: ${details.hotel}${extrasText}`,
    "",
    `Open the card: ${shareUrl}`,
  ].join("\n");
}
