import AsyncStorage from "@react-native-async-storage/async-storage";
import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useState,
} from "react";

import { apiFetch, resolveUrl } from "@/utils/api";

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

export interface ChatMessage {
  id: string;
  groupId: string;
  senderId: string;
  senderName: string;
  text: string;
  timestamp: string;
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
  getUserTrip: (userId: string, tournamentId: string) => Trip | null;
  getMatches: (trip: Trip) => MatchGroup[];
  sendMessage: (groupId: string, msg: Omit<ChatMessage, "id">) => Promise<void>;
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


const DEMO_TRIPS: Trip[] = [
  {
    id: "demo1",
    userId: "demo-user-1",
    userName: "Sarah M.",
    userTeam: "16 Gold",
    tournamentId: "t1",
    airport: "DFW",
    hotel: "Marriott Marquis Dallas",
    hotelPlaceId: "ChIJmarriott1",
    datetime: new Date(Date.now() + 2 * 3600000).toISOString(),
    mode: "arrival",
  },
  {
    id: "demo2",
    userId: "demo-user-2",
    userName: "Lisa T.",
    userTeam: "16 Gold",
    tournamentId: "t1",
    airport: "DFW",
    hotel: "Marriott Marquis Dallas",
    hotelPlaceId: "ChIJmarriott1",
    datetime: new Date(Date.now() + 2.5 * 3600000).toISOString(),
    mode: "arrival",
  },
  {
    id: "demo3",
    userId: "demo-user-3",
    userName: "Karen B.",
    userTeam: "16 Gold",
    tournamentId: "t1",
    airport: "DFW",
    hotel: "Marriott Marquis Dallas",
    hotelPlaceId: "ChIJmarriott1",
    datetime: new Date(Date.now() + 2.2 * 3600000).toISOString(),
    mode: "arrival",
  },
  {
    id: "demo4",
    userId: "demo-user-4",
    userName: "Amy P.",
    userTeam: "16 Gold",
    tournamentId: "t1",
    airport: "DFW",
    hotel: "Hyatt Regency Dallas",
    hotelPlaceId: "ChIJhyatt1",
    datetime: new Date(Date.now() + 3 * 3600000).toISOString(),
    mode: "arrival",
  },
  {
    id: "demo5",
    userId: "demo-user-5",
    userName: "Rachel W.",
    userTeam: "16 Gold",
    tournamentId: "t1",
    airport: "DFW",
    hotel: "Hyatt Regency Dallas",
    hotelPlaceId: "ChIJhyatt1",
    datetime: new Date(Date.now() + 3.3 * 3600000).toISOString(),
    mode: "arrival",
  },
];

function groupTripsIntoMatches(trips: Trip[], userTrip: Trip): MatchGroup[] {
  const sameGroup = trips.filter(
    (t) =>
      t.id !== userTrip.id &&
      t.tournamentId === userTrip.tournamentId &&
      t.airport === userTrip.airport &&
      t.mode === userTrip.mode &&
      (t.hotel === userTrip.hotel || t.hotelPlaceId === userTrip.hotelPlaceId)
  );

  const userTime = new Date(userTrip.datetime).getTime();
  const within45 = sameGroup.filter((t) => {
    const diff = Math.abs(new Date(t.datetime).getTime() - userTime);
    return diff <= 45 * 60 * 1000;
  });

  if (within45.length === 0) return [];

  const groupKey = `${userTrip.tournamentId}-${userTrip.airport}-${userTrip.hotelPlaceId || userTrip.hotel}-${userTrip.mode}`;
  const allInGroup = [userTrip, ...within45];
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
  const [trips, setTrips] = useState<Trip[]>(DEMO_TRIPS);
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
        const serverKeys = new Set(
          mapped.map((m) => `${m.userId}-${m.tournamentId}`),
        );
        const kept = prev.filter(
          (p) =>
            !p.id.startsWith("srv-") &&
            !(
              p.tournamentId === tournamentId &&
              serverKeys.has(`${p.userId}-${p.tournamentId}`)
            ),
        );
        return [...kept, ...mapped];
      });
    } catch {
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
        e instanceof Error ? e.message : "Failed to load tournaments"
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
      setTrips([...DEMO_TRIPS, ...stored]);
      const msgRaw = await AsyncStorage.getItem(MESSAGES_KEY);
      if (msgRaw) setMessages(JSON.parse(msgRaw));
      const imgRaw = await AsyncStorage.getItem(TOURNAMENT_IMAGES_KEY);
      if (imgRaw) setTournamentImages(JSON.parse(imgRaw));
    } catch {}
  };

  const setTournamentImage = useCallback(
    async (tournamentId: string, uri: string) => {
      setTournamentImages((prev) => {
        const updated = { ...prev, [tournamentId]: uri };
        AsyncStorage.setItem(TOURNAMENT_IMAGES_KEY, JSON.stringify(updated));
        return updated;
      });
    },
    []
  );

  const tournamentsWithImages: Tournament[] = tournaments.map((t) => ({
    ...t,
    imageUri: tournamentImages[t.id] ?? t.imageUri ?? resolveUrl(t.imageUrl),
  }));

  const saveTrip = useCallback(async (tripData: Omit<Trip, "id">) => {
    const tempId = `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
    const tempTrip: Trip = { ...tripData, id: tempId };

    setTrips((prev) => {
      const filtered = prev.filter(
        (t) =>
          !(
            t.userId === tripData.userId &&
            t.tournamentId === tripData.tournamentId
          )
      );
      return [...filtered, tempTrip];
    });

    try {
      const serverTrip = await apiFetch<{ id: string }>("/trips", {
        method: "POST",
        body: JSON.stringify({
          tournamentId: tripData.tournamentId,
          airport: tripData.airport,
          hotel: tripData.hotel,
          hotelPlaceId: tripData.hotelPlaceId,
          datetime: tripData.datetime,
          mode: tripData.mode,
          baggageCount: tripData.baggageCount,
          partySize: tripData.partySize,
        }),
      });
      const stableId = `srv-${serverTrip.id}`;
      const finalTrip: Trip = { ...tripData, id: stableId };

      setTrips((prev) => {
        const filtered = prev.filter((t) => t.id !== tempId);
        return [...filtered, finalTrip];
      });

      const tripsRaw = await AsyncStorage.getItem(TRIPS_KEY);
      const stored: Trip[] = tripsRaw ? JSON.parse(tripsRaw) : [];
      const withoutOld = stored.filter(
        (t) =>
          !(
            t.userId === tripData.userId &&
            t.tournamentId === tripData.tournamentId
          )
      );
      withoutOld.push(finalTrip);
      await AsyncStorage.setItem(TRIPS_KEY, JSON.stringify(withoutOld));

      return finalTrip;
    } catch {
      return tempTrip;
    }
  }, []);

  const deleteTrip = useCallback(async (tripId: string) => {
    const rawId = tripId.replace(/^srv-/, "");
    setTrips((prev) => prev.filter((t) => t.id !== tripId));
    const tripsRaw = await AsyncStorage.getItem(TRIPS_KEY);
    const stored: Trip[] = tripsRaw ? JSON.parse(tripsRaw) : [];
    await AsyncStorage.setItem(
      TRIPS_KEY,
      JSON.stringify(stored.filter((t) => t.id !== tripId)),
    );
    try {
      await apiFetch(`/trips/${rawId}`, { method: "DELETE" });
    } catch {}
  }, []);

  const getUserTrip = useCallback(
    (userId: string, tournamentId: string): Trip | null => {
      return (
        trips.find(
          (t) => t.userId === userId && t.tournamentId === tournamentId
        ) ?? null
      );
    },
    [trips]
  );

  const getMatches = useCallback(
    (userTrip: Trip): MatchGroup[] => {
      return groupTripsIntoMatches(trips, userTrip);
    },
    [trips]
  );

  const sendMessage = useCallback(
    async (groupId: string, msg: Omit<ChatMessage, "id">) => {
      const localId = `local-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
      const newMsg: ChatMessage = { ...msg, id: localId };

      setMessages((prev) => ({
        ...prev,
        [groupId]: [...(prev[groupId] ?? []), newMsg],
      }));

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
          }
        );
        setMessages((prev) => {
          const updated = (prev[groupId] ?? []).map((m) =>
            m.id === localId
              ? { ...m, id: serverMsg.id, timestamp: serverMsg.createdAt }
              : m
          );
          return { ...prev, [groupId]: updated };
        });
      } catch {}
    },
    []
  );

  const fetchMessages = useCallback(async (groupId: string): Promise<ChatMessage[]> => {
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
      }));

      setMessages((prev) => {
        const systemMsgs = (prev[groupId] ?? []).filter(
          (m) => m.senderId === "system"
        );
        // Only keep optimistic user messages (NOT system — they also start with "local-"
        // and would otherwise appear in both systemMsgs and stillPending, duplicating them)
        const localOptimistic = (prev[groupId] ?? []).filter(
          (m) => m.id.startsWith("local-") && m.senderId !== "system"
        );
        const serverIds = new Set(mapped.map((m) => m.id));
        const stillPending = localOptimistic.filter((m) => !serverIds.has(m.id));
        const merged = [...systemMsgs, ...mapped, ...stillPending];
        merged.sort(
          (a, b) =>
            new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime()
        );
        return { ...prev, [groupId]: merged };
      });

      return mapped;
    } catch {
      return [];
    }
  }, []);

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
    [messages]
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
