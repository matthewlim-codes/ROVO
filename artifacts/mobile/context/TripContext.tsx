import AsyncStorage from "@react-native-async-storage/async-storage";
import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useState,
} from "react";

export interface Tournament {
  id: string;
  name: string;
  location: string;
  dates: string;
  description: string;
  imageUri?: string;
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
}

export interface ChatMessage {
  id: string;
  groupId: string;
  senderId: string;
  senderName: string;
  text: string;
  timestamp: string;
}

interface TripContextType {
  tournaments: Tournament[];
  trips: Trip[];
  messages: Record<string, ChatMessage[]>;
  selectedTournament: Tournament | null;
  setSelectedTournament: (t: Tournament | null) => void;
  saveTrip: (trip: Omit<Trip, "id">) => Promise<Trip>;
  getUserTrip: (userId: string, tournamentId: string) => Trip | null;
  getMatches: (trip: Trip) => MatchGroup[];
  sendMessage: (groupId: string, msg: Omit<ChatMessage, "id">) => Promise<void>;
  loadMessages: (groupId: string) => ChatMessage[];
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

const DEMO_TOURNAMENTS: Tournament[] = [
  {
    id: "t1",
    name: "Lone Star Classic",
    location: "Dallas Convention Center, Dallas, TX",
    dates: "Apr 19–20, 2026",
    description:
      "One of the largest club volleyball tournaments in Texas. 400+ teams competing across all age groups.",
  },
  {
    id: "t2",
    name: "SCVA Kickoff Classic",
    location: "Anaheim Convention Center, Anaheim, CA",
    dates: "May 3–4, 2026",
    description:
      "Premier Southern California tournament welcoming teams from across the western region.",
  },
  {
    id: "t3",
    name: "Midwest Qualifier",
    location: "McCormick Place, Chicago, IL",
    dates: "May 17–18, 2026",
    description:
      "National qualifier event for junior teams competing for berths at USAV Nationals.",
  },
  {
    id: "t4",
    name: "AAU Volleyball Nationals",
    location: "Orange County Convention Center, Orlando, FL",
    dates: "Jun 21–25, 2026",
    description:
      "The biggest junior volleyball event of the summer season. Thousands of teams from all 50 states.",
  },
];

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
  const [messages, setMessages] = useState<Record<string, ChatMessage[]>>({});
  const [selectedTournament, setSelectedTournament] =
    useState<Tournament | null>(null);

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    try {
      const tripsRaw = await AsyncStorage.getItem(TRIPS_KEY);
      const stored: Trip[] = tripsRaw ? JSON.parse(tripsRaw) : [];
      setTrips([...DEMO_TRIPS, ...stored]);
      const msgRaw = await AsyncStorage.getItem(MESSAGES_KEY);
      if (msgRaw) setMessages(JSON.parse(msgRaw));
    } catch {}
  };

  const saveTrip = useCallback(async (tripData: Omit<Trip, "id">) => {
    const newTrip: Trip = {
      ...tripData,
      id: `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
    };
    const tripsRaw = await AsyncStorage.getItem(TRIPS_KEY);
    const stored: Trip[] = tripsRaw ? JSON.parse(tripsRaw) : [];
    const withoutOld = stored.filter(
      (t) =>
        !(
          t.userId === tripData.userId &&
          t.tournamentId === tripData.tournamentId
        )
    );
    withoutOld.push(newTrip);
    await AsyncStorage.setItem(TRIPS_KEY, JSON.stringify(withoutOld));
    setTrips((prev) => {
      const filtered = prev.filter(
        (t) =>
          !(
            t.userId === tripData.userId &&
            t.tournamentId === tripData.tournamentId
          )
      );
      return [...filtered, newTrip];
    });
    return newTrip;
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
      const newMsg: ChatMessage = {
        ...msg,
        id: `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      };
      setMessages((prev) => {
        const updated = {
          ...prev,
          [groupId]: [...(prev[groupId] ?? []), newMsg],
        };
        AsyncStorage.setItem(MESSAGES_KEY, JSON.stringify(updated));
        return updated;
      });
    },
    []
  );

  const loadMessages = useCallback(
    (groupId: string): ChatMessage[] => {
      return messages[groupId] ?? [];
    },
    [messages]
  );

  return (
    <TripContext.Provider
      value={{
        tournaments: DEMO_TOURNAMENTS,
        trips,
        messages,
        selectedTournament,
        setSelectedTournament,
        saveTrip,
        getUserTrip,
        getMatches,
        sendMessage,
        loadMessages,
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
