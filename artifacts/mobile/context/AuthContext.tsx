import AsyncStorage from "@react-native-async-storage/async-storage";
import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useState,
} from "react";

export interface User {
  id: string;
  email: string;
  name: string;
  club: string;
  team: string;
  clubCodeEntered: boolean;
}

interface AuthContextType {
  user: User | null;
  isLoading: boolean;
  login: (email: string, password: string) => Promise<void>;
  register: (email: string, password: string, name: string) => Promise<void>;
  logout: () => Promise<void>;
  enterClubCode: (code: string) => Promise<void>;
}

const AuthContext = createContext<AuthContextType | null>(null);

const USERS_KEY = "rsg_users";
const SESSION_KEY = "rsg_session";

const CLUB_CODES: Record<string, { club: string; team: string }> = {
  "GOLD2024": { club: "Gold Volleyball Club", team: "16 Gold" },
  "STORM24": { club: "Storm Elite", team: "18 Storm" },
  "VBALL25": { club: "Valley Volleyball", team: "15 Blue" },
  "ELITE25": { club: "Elite Sports Club", team: "17 Elite" },
  "FURY2025": { club: "Fury Volleyball", team: "16 Fury" },
};

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    loadSession();
  }, []);

  const loadSession = async () => {
    try {
      const sessionId = await AsyncStorage.getItem(SESSION_KEY);
      if (sessionId) {
        const usersRaw = await AsyncStorage.getItem(USERS_KEY);
        const users: User[] = usersRaw ? JSON.parse(usersRaw) : [];
        const found = users.find((u) => u.id === sessionId);
        if (found) setUser(found);
      }
    } catch {
    } finally {
      setIsLoading(false);
    }
  };

  const getUsers = async (): Promise<User[]> => {
    const raw = await AsyncStorage.getItem(USERS_KEY);
    return raw ? JSON.parse(raw) : [];
  };

  const saveUsers = async (users: User[]) => {
    await AsyncStorage.setItem(USERS_KEY, JSON.stringify(users));
  };

  const login = useCallback(async (email: string, _password: string) => {
    const users = await getUsers();
    const found = users.find(
      (u) => u.email.toLowerCase() === email.toLowerCase()
    );
    if (!found) throw new Error("No account found with this email.");
    await AsyncStorage.setItem(SESSION_KEY, found.id);
    setUser(found);
  }, []);

  const register = useCallback(
    async (email: string, _password: string, name: string) => {
      const users = await getUsers();
      const exists = users.find(
        (u) => u.email.toLowerCase() === email.toLowerCase()
      );
      if (exists) throw new Error("An account with this email already exists.");
      const newUser: User = {
        id: `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
        email,
        name,
        club: "",
        team: "",
        clubCodeEntered: false,
      };
      users.push(newUser);
      await saveUsers(users);
      await AsyncStorage.setItem(SESSION_KEY, newUser.id);
      setUser(newUser);
    },
    []
  );

  const logout = useCallback(async () => {
    await AsyncStorage.removeItem(SESSION_KEY);
    setUser(null);
  }, []);

  const enterClubCode = useCallback(
    async (code: string) => {
      if (!user) return;
      const clubInfo = CLUB_CODES[code];
      if (!clubInfo) throw new Error("invalid");
      const users = await getUsers();
      const idx = users.findIndex((u) => u.id === user.id);
      if (idx === -1) return;
      const updated: User = {
        ...users[idx],
        club: clubInfo.club,
        team: clubInfo.team,
        clubCodeEntered: true,
      };
      users[idx] = updated;
      await saveUsers(users);
      setUser(updated);
    },
    [user]
  );

  return (
    <AuthContext.Provider
      value={{ user, isLoading, login, register, logout, enterClubCode }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be inside AuthProvider");
  return ctx;
}
