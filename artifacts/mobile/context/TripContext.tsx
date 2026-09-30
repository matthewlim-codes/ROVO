import AsyncStorage from "@react-native-async-storage/async-storage";
import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useState,
} from "react";

import { apiFetch, resolveUrl } from "@/utils/api";
import {
  airportsMatch,
  hotelsMatch,
  isWithinMatchWindow,
  isValidPlaceId,
} from "@/utils/matching";

export type TournamentGender = "boys" | "girls" | "coed";

export interface Tournament {
  id: string;
  name: string;
  location: string;
  dates: string;
  startDate: string;
  endDate: string;
  gender: TournamentGender;
  description: string;
  imageUri?: string;
  imageUrl?: string | null;
}

export interface Trip {
  id: string;
  userId: string;
  userName: string;
  userTeam: string;
  tournamentId: string;
  airport: string;
  hotel: string;
  hotelPlaceId?: string;
  datetime: string;
  mode: "arrival" | "departure";
  baggageCount?: number;
  partySize?: number;
}

export type MessageStatus = "sending" | "sent" | "failed";

export interface ChatMessage {
  id: string;
  groupId: string;
  senderId: string;
  senderName: string;
  text: string;
  timestamp: string;
  status?: MessageStatus;
}

export interface Conversation {
  groupId: string;
  lastMessage: string;
  lastSenderName: string;
  lastTimestamp: string;
}

interface TripContextType {
  tournaments: Tournament[];
  tournamentsLoading: boolean;
  tournamentsError: string | null;
  refreshTournaments: () => Promise<void>;
  trips: Trip[];
  tripsLoading: boolean;
  refreshTrips: (tournamentId: string) => Promise<void>;
  messages: Record<string, ChatMessage[]>;
  selectedTournament: Tournament | null;
  setSelectedTournament: (t: Tournament | null) => void;
  saveTrip: (trip: Omit<Trip, "id">) => Promise<Trip>;
  deleteTrip: (tripId: string) => Promise<void>;
  getUserTrip: (
    userId: string,
    tournamentId: string,
    mode?: "arrival" | "departure",
  ) => Trip | null;
  getMatches: (trip: Trip) => MatchGroup[];
  sendMessage: (groupId: string, msg: Omit<ChatMessage, "id">) => Promise<void>;
  retryMessage: (groupId: string, messageId: string) => Promise<void>;
  fetchMessages: (groupId: string) => Promise<ChatMessage[]>;
  loadMessages: (groupId: string) => ChatMessage[];
  fetchConversations: () => Promise<Conversation[]>;
  setTournamentImage: (tournamentId: string, uri: string) => Promise<void>;
}

export interface MatchGroup {
  groupId: string;
  trips: Trip[];
  airport: string;
  hotel: string;
  mode: "arrival" | "departure";
  earliestTime: string;
  latestTime: string;
  count: number;
}

const TripContext = createContext<TripContextType | null>(null);

const TRIPS_KEY = "rsg_trips";
const MESSAGES_KEY = "rsg_messages";
const TOURNAMENT_IMAGES_KEY = "rsg_tournament_images";

export class TripSaveError extends Error {
  constructor(
    message: string,
    public readonly kind: "server" | "storage" = "server",
    public readonly trip?: Trip,
  ) {
    super(message);
    this.name = "TripSaveError";
  }
}

export class TripDeleteError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "TripDeleteError";
  }
}

function tripIdentityKey(t: Pick<Trip, "userId" | "tournamentId" | "mode">): string {
  return `${t.userId}-${t.tournamentId}-${t.mode}`;
}

function groupTripsIntoMatches(trips: Trip[], userTrip: Trip): MatchGroup[] {
  const withinWindow = trips.filter(
    (t) =>
      t.id !== userTrip.id &&
      t.tournamentId === userTrip.tournamentId &&
      airportsMatch(t.airport, userTrip.airport) &&
      t.mode === userTrip.mode &&
      hotelsMatch(t.hotel, t.hotelPlaceId, userTrip.hotel, userTrip.hotelPlaceId) &&
      isWithinMatchWindow(t.datetime, userTrip.datetime),
  );

  if (withinWindow.length === 0) return [];

  const hotelKey = isValidPlaceId(userTrip.hotelPlaceId)
    ? userTrip.hotelPlaceId
    : userTrip.hotel;
  const groupKey = `${userTrip.tournamentId}-${userTrip.airport}-${hotelKey}-${userTrip.mode}`;
  const allInGroup = [userTrip, ...withinWindow];
  const times = allInGroup.map((t) => new Date(t.datetime).getTime());
  const earliest = new Date(Math.min(...times)).toISOString();
  const latest = new Date(Math.max(...times)).toISOString();

  return [
    {
      groupId: groupKey,
      trips: allInGroup,
      airport: userTrip.airport,
      hotel: userTrip.hotel,
      mode: userTrip.mode,
      earliestTime: earliest,
      latestTime: latest,
      count: allInGroup.length,
    },
  ];
}

export function TripProvider({ children }: { children: React.ReactNode }) {
  const [trips, setTrips] = useState<Trip[]>([]);
  const [tripsLoading, setTripsLoading] = useState(true);
  const [messages, setMessages] = useState<Record<string, ChatMessage[]>>({});
  const [tournamentImages, setTournamentImages] = useState<
    Record<string, string>
  >({});
  const [selectedTournament, setSelectedTournament] =
    useState<Tournament | null>(null);
  const [tournaments, setTournaments] = useState<Tournament[]>([]);
  const [tournamentsLoading, setTournamentsLoading] = useState(true);
  const [tournamentsError, setTournamentsError] = useState<string | null>(null);

  const refreshServerTrips = useCallback(async (tournamentId: string) => {
    setTripsLoading(true);
    try {
      const data = await apiFetch<
        Array<{
          id: string;
          userId: string;
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
        }>
      >(`/trips?tournamentId=${encodeURIComponent(tournamentId)}`);
      const mapped: Trip[] = data.map((t) => ({
        id: `srv-${t.id}`,
        userId: t.userId,
        userName: t.userName,
        userTeam: t.userTeam ?? "",
        tournamentId: t.tournamentId,
        airport: t.airport,
        hotel: t.hotel,
        hotelPlaceId: t.hotelPlaceId ?? undefined,
        datetime: t.datetime,
        mode: t.mode,
        baggageCount: t.baggageCount ?? undefined,
        partySize: t.partySize ?? undefined,
      }));
      setTrips((prev) => {
        const serverKeys = new Set(mapped.map((m) => tripIdentityKey(m)));
        const kept = prev.filter(
          (p) =>
            !p.id.startsWith("srv-") &&
            !(
              p.tournamentId === tournamentId &&
              serverKeys.has(tripIdentityKey(p))
            ),
        );
        return [...kept, ...mapped];
      });
    } catch {
      // Leave existing trips; callers can surface errors separately.
    } finally {
      setTripsLoading(false);
    }
  }, []);

  const refreshTournaments = useCallback(async () => {
    setTournamentsLoading(true);
    setTournamentsError(null);
    try {
      const data = await apiFetch<Tournament[]>("/tournaments");
      setTournaments(data);
    } catch (e) {
      setTournamentsError(
        e instanceof Error ? e.message : "Failed to load tournaments",
      );
    } finally {
      setTournamentsLoading(false);
    }
  }, []);

  useEffect(() => {
    loadData();
    refreshTournaments();
  }, [refreshTournaments]);

  useEffect(() => {
    if (!selectedTournament?.id) return;
    refreshServerTrips(selectedTournament.id);
    const interval = setInterval(() => {
      refreshServerTrips(selectedTournament.id);
    }, 30000);
    return () => clearInterval(interval);
  }, [selectedTournament?.id, refreshServerTrips]);

  const loadData = async () => {
    try {
      const tripsRaw = await AsyncStorage.getItem(TRIPS_KEY);
      const stored: Trip[] = tripsRaw ? JSON.parse(tripsRaw) : [];
      // Strip legacy demo trips if any remain in local storage
      const cleaned = stored.filter((t) => !t.id.startsWith("demo"));
      setTrips(cleaned);
      const msgRaw = await AsyncStorage.getItem(MESSAGES_KEY);
      if (msgRaw) setMessages(JSON.parse(msgRaw));
      const imgRaw = await AsyncStorage.getItem(TOURNAMENT_IMAGES_KEY);
      if (imgRaw) setTournamentImages(JSON.parse(imgRaw));
    } catch {
    } finally {
      setTripsLoading(false);
    }
  };

  const setTournamentImage = useCallback(
    async (tournamentId: string, uri: string) => {
      setTournamentImages((prev) => {
        const updated = { ...prev, [tournamentId]: uri };
        AsyncStorage.setItem(TOURNAMENT_IMAGES_KEY, JSON.stringify(updated));
        return updated;
      });
    },
    [],
  );

  const tournamentsWithImages: Tournament[] = tournaments.map((t) => ({
    ...t,
    imageUri: tournamentImages[t.id] ?? t.imageUri ?? resolveUrl(t.imageUrl),
  }));

  const saveTrip = useCallback(async (tripData: Omit<Trip, "id">) => {
    const tempId = `pending-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
    const tempTrip: Trip = { ...tripData, id: tempId };
    let previousForMode: Trip | undefined;

    setTrips((prev) => {
      previousForMode = prev.find(
        (t) =>
          t.userId === tripData.userId &&
          t.tournamentId === tripData.tournamentId &&
          t.mode === tripData.mode,
      );
      const filtered = prev.filter(
        (t) =>
          !(
            t.userId === tripData.userId &&
            t.tournamentId === tripData.tournamentId &&
            t.mode === tripData.mode
          ),
      );
      return [...filtered, tempTrip];
    });

    let serverTrip: { id: string };
    try {
      serverTrip = await apiFetch<{ id: string }>("/trips", {
        method: "POST",
        body: JSON.stringify({
          tournamentId: tripData.tournamentId,
          airport: tripData.airport,
          hotel: tripData.hotel.trim(),
          hotelPlaceId: isValidPlaceId(tripData.hotelPlaceId)
            ? tripData.hotelPlaceId
            : null,
          datetime: tripData.datetime,
          mode: tripData.mode,
          baggageCount: tripData.baggageCount,
          partySize: tripData.partySize,
        }),
      });
    } catch (e) {
      setTrips((prev) => {
        const withoutPending = prev.filter((t) => t.id !== tempId);
        if (
          previousForMode &&
          !withoutPending.some((t) => t.id === previousForMode!.id)
        ) {
          return [...withoutPending, previousForMode];
        }
        return withoutPending;
      });
      throw new TripSaveError(
        e instanceof Error
          ? e.message
          : "Could not save travel details. Please try again.",
        "server",
      );
    }

    const stableId = `srv-${serverTrip.id}`;
    const finalTrip: Trip = { ...tripData, id: stableId };

    setTrips((prev) => {
      const filtered = prev.filter((t) => t.id !== tempId);
      return [...filtered, finalTrip];
    });

    try {
      const tripsRaw = await AsyncStorage.getItem(TRIPS_KEY);
      const stored: Trip[] = tripsRaw ? JSON.parse(tripsRaw) : [];
      const withoutOld = stored.filter(
        (t) =>
          !(
            t.userId === tripData.userId &&
            t.tournamentId === tripData.tournamentId &&
            t.mode === tripData.mode
          ),
      );
      withoutOld.push(finalTrip);
      await AsyncStorage.setItem(TRIPS_KEY, JSON.stringify(withoutOld));
    } catch {
      // Server write succeeded; surface a distinguishable warning but keep the trip.
      throw new TripSaveError(
        "Travel details were saved, but this device could not cache them. You can continue.",
        "storage",
        finalTrip,
      );
    }

    return finalTrip;
  }, []);

  const deleteTrip = useCallback(async (tripId: string) => {
    const rawId = tripId.replace(/^srv-/, "");
    let removed: Trip | undefined;
    setTrips((prev) => {
      removed = prev.find((t) => t.id === tripId);
      return prev.filter((t) => t.id !== tripId);
    });

    try {
      await apiFetch(`/trips/${rawId}`, { method: "DELETE" });
    } catch (e) {
      if (removed) {
        setTrips((prev) =>
          prev.some((t) => t.id === removed!.id) ? prev : [...prev, removed!],
        );
      }
      throw new TripDeleteError(
        e instanceof Error
          ? e.message
          : "Could not delete trip. Please try again.",
      );
    }

    try {
      const tripsRaw = await AsyncStorage.getItem(TRIPS_KEY);
      const stored: Trip[] = tripsRaw ? JSON.parse(tripsRaw) : [];
      await AsyncStorage.setItem(
        TRIPS_KEY,
        JSON.stringify(stored.filter((t) => t.id !== tripId)),
      );
    } catch {
      // Server delete succeeded — ignore local cache failure.
    }
  }, []);

  const getUserTrip = useCallback(
    (
      userId: string,
      tournamentId: string,
      mode?: "arrival" | "departure",
    ): Trip | null => {
      return (
        trips.find(
          (t) =>
            t.userId === userId &&
            t.tournamentId === tournamentId &&
            (mode ? t.mode === mode : true),
        ) ?? null
      );
    },
    [trips],
  );

  const getMatches = useCallback(
    (userTrip: Trip): MatchGroup[] => {
      return groupTripsIntoMatches(trips, userTrip);
    },
    [trips],
  );

  const persistMessages = useCallback(
    async (next: Record<string, ChatMessage[]>) => {
      try {
        await AsyncStorage.setItem(MESSAGES_KEY, JSON.stringify(next));
      } catch {
        // ignore cache failures
      }
    },
    [],
  );

  const sendMessage = useCallback(
    async (groupId: string, msg: Omit<ChatMessage, "id">) => {
      const localId = `local-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
      const newMsg: ChatMessage = {
        ...msg,
        id: localId,
        status: msg.senderId === "system" ? "sent" : "sending",
      };

      setMessages((prev) => {
        const updated = {
          ...prev,
          [groupId]: [...(prev[groupId] ?? []), newMsg],
        };
        void persistMessages(updated);
        return updated;
      });

      if (msg.senderId === "system") return;

      try {
        const serverMsg = await apiFetch<{ id: string; createdAt: string }>(
          "/messages",
          {
            method: "POST",
            body: JSON.stringify({
              groupId,
              senderName: msg.senderName,
              text: msg.text,
            }),
          },
        );
        setMessages((prev) => {
          const updated = {
            ...prev,
            [groupId]: (prev[groupId] ?? []).map((m) =>
              m.id === localId
                ? {
                    ...m,
                    id: serverMsg.id,
                    timestamp: serverMsg.createdAt,
                    status: "sent" as const,
                  }
                : m,
            ),
          };
          void persistMessages(updated);
          return updated;
        });
      } catch {
        setMessages((prev) => {
          const updated = {
            ...prev,
            [groupId]: (prev[groupId] ?? []).map((m) =>
              m.id === localId ? { ...m, status: "failed" as const } : m,
            ),
          };
          void persistMessages(updated);
          return updated;
        });
      }
    },
    [persistMessages],
  );

  const retryMessage = useCallback(
    async (groupId: string, messageId: string) => {
      let target: ChatMessage | undefined;
      setMessages((prev) => {
        target = (prev[groupId] ?? []).find((m) => m.id === messageId);
        if (!target) return prev;
        const updated = {
          ...prev,
          [groupId]: (prev[groupId] ?? []).map((m) =>
            m.id === messageId ? { ...m, status: "sending" as const } : m,
          ),
        };
        void persistMessages(updated);
        return updated;
      });
      if (!target || target.senderId === "system") return;

      try {
        const serverMsg = await apiFetch<{ id: string; createdAt: string }>(
          "/messages",
          {
            method: "POST",
            body: JSON.stringify({
              groupId,
              senderName: target.senderName,
              text: target.text,
            }),
          },
        );
        setMessages((prev) => {
          const updated = {
            ...prev,
            [groupId]: (prev[groupId] ?? []).map((m) =>
              m.id === messageId
                ? {
                    ...m,
                    id: serverMsg.id,
                    timestamp: serverMsg.createdAt,
                    status: "sent" as const,
                  }
                : m,
            ),
          };
          void persistMessages(updated);
          return updated;
        });
      } catch {
        setMessages((prev) => {
          const updated = {
            ...prev,
            [groupId]: (prev[groupId] ?? []).map((m) =>
              m.id === messageId ? { ...m, status: "failed" as const } : m,
            ),
          };
          void persistMessages(updated);
          return updated;
        });
      }
    },
    [persistMessages],
  );

  const fetchMessages = useCallback(
    async (groupId: string): Promise<ChatMessage[]> => {
      try {
        const serverMsgs = await apiFetch<
          Array<{
            id: string;
            groupId: string;
            senderId: string;
            senderName: string;
            text: string;
            createdAt: string;
          }>
        >(`/messages?groupId=${encodeURIComponent(groupId)}`);

        const mapped: ChatMessage[] = serverMsgs.map((m) => ({
          id: m.id,
          groupId: m.groupId,
          senderId: m.senderId,
          senderName: m.senderName,
          text: m.text,
          timestamp: m.createdAt,
          status: "sent",
        }));

        setMessages((prev) => {
          const systemMsgs = (prev[groupId] ?? []).filter(
            (m) => m.senderId === "system",
          );
          const localOptimistic = (prev[groupId] ?? []).filter(
            (m) =>
              m.id.startsWith("local-") &&
              m.senderId !== "system" &&
              (m.status === "sending" || m.status === "failed"),
          );
          const serverIds = new Set(mapped.map((m) => m.id));
          const stillPending = localOptimistic.filter(
            (m) => !serverIds.has(m.id),
          );
          const merged = [...systemMsgs, ...mapped, ...stillPending];
          merged.sort(
            (a, b) =>
              new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime(),
          );
          const next = { ...prev, [groupId]: merged };
          void persistMessages(next);
          return next;
        });

        return mapped;
      } catch {
        return [];
      }
    },
    [persistMessages],
  );

  const fetchConversations = useCallback(async (): Promise<Conversation[]> => {
    try {
      return await apiFetch<Conversation[]>("/messages/conversations");
    } catch {
      return [];
    }
  }, []);

  const loadMessages = useCallback(
    (groupId: string): ChatMessage[] => {
      return messages[groupId] ?? [];
    },
    [messages],
  );

  return (
    <TripContext.Provider
      value={{
        tournaments: tournamentsWithImages,
        tournamentsLoading,
        tournamentsError,
        refreshTournaments,
        trips,
        tripsLoading,
        refreshTrips: refreshServerTrips,
        messages,
        selectedTournament,
        setSelectedTournament,
        saveTrip,
        deleteTrip,
        getUserTrip,
        getMatches,
        sendMessage,
        retryMessage,
        fetchMessages,
        loadMessages,
        fetchConversations,
        setTournamentImage,
      }}
    >
      {children}
    </TripContext.Provider>
  );
}

export function useTrip() {
  const ctx = useContext(TripContext);
  if (!ctx) throw new Error("useTrip must be inside TripProvider");
  return ctx;
}
