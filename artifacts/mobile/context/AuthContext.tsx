import AsyncStorage from "@react-native-async-storage/async-storage";
import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useState,
} from "react";
import { ApiError, NetworkError, apiFetch } from "../utils/api";

export class InvalidClubCodeError extends Error {
  constructor() {
    super("Invalid club code");
    this.name = "InvalidClubCodeError";
  }
}

export class ClubCodeNetworkError extends Error {
  constructor() {
    super("Club code verification network error");
    this.name = "ClubCodeNetworkError";
  }
}

export interface User {
  id: string;
  email: string;
  name: string;
  club: string;
  team: string;
  clubCodeEntered: boolean;
  avatarUri?: string;
  isAdmin?: boolean;
}

function isAdminEmail(email: string): boolean {
  const raw = process.env.EXPO_PUBLIC_ADMIN_EMAILS ?? "";
  const list = raw
    .split(",")
    .map((s) => s.trim().toLowerCase())
    .filter(Boolean);
  return list.includes(email.toLowerCase());
}

interface AuthContextType {
  user: User | null;
  isLoading: boolean;
  login: (email: string, password: string) => Promise<void>;
  register: (email: string, password: string, name: string) => Promise<void>;
  logout: () => Promise<void>;
  enterClubCode: (code: string) => Promise<void>;
  updateProfile: (updates: {
    name?: string;
    email?: string;
    avatarUri?: string | null;
  }) => Promise<void>;
}

const AuthContext = createContext<AuthContextType | null>(null);

const USERS_KEY = "rsg_users";
const SESSION_KEY = "rsg_session";

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
        const idx = users.findIndex((u) => u.id === sessionId);
        if (idx !== -1) {
          const desiredAdmin = isAdminEmail(users[idx].email);
          if (!!users[idx].isAdmin !== desiredAdmin) {
            users[idx] = { ...users[idx], isAdmin: desiredAdmin };
            await saveUsers(users);
          }
          setUser(users[idx]);
        }
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
    const idx = users.findIndex(
      (u) => u.email.toLowerCase() === email.toLowerCase()
    );
    if (idx === -1) throw new Error("No account found with this email.");
    const desiredAdmin = isAdminEmail(users[idx].email);
    if (!!users[idx].isAdmin !== desiredAdmin) {
      users[idx] = { ...users[idx], isAdmin: desiredAdmin };
      await saveUsers(users);
    }
    await AsyncStorage.setItem(SESSION_KEY, users[idx].id);
    setUser(users[idx]);
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
        isAdmin: isAdminEmail(email),
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
      let clubInfo: { clubName: string | null; teamName: string };
      try {
        clubInfo = await apiFetch<{
          code: string;
          teamName: string;
          clubId: string;
          clubName: string | null;
        }>(`/club-codes/verify/${encodeURIComponent(code)}`);
      } catch (err) {
        if (err instanceof ApiError && err.status === 404) {
          throw new InvalidClubCodeError();
        }
        if (err instanceof NetworkError) {
          throw new ClubCodeNetworkError();
        }
        throw new ClubCodeNetworkError();
      }
      const users = await getUsers();
      const idx = users.findIndex((u) => u.id === user.id);
      if (idx === -1) return;
      const updated: User = {
        ...users[idx],
        club: clubInfo.clubName ?? "",
        team: clubInfo.teamName,
        clubCodeEntered: true,
      };
      users[idx] = updated;
      await saveUsers(users);
      setUser(updated);
    },
    [user]
  );

  const updateProfile = useCallback(
    async (updates: {
      name?: string;
      email?: string;
      avatarUri?: string | null;
    }) => {
      if (!user) return;
      const users = await getUsers();
      const idx = users.findIndex((u) => u.id === user.id);
      if (idx === -1) return;
      if (updates.email) {
        const conflict = users.find(
          (u) =>
            u.id !== user.id &&
            u.email.toLowerCase() === updates.email!.toLowerCase()
        );
        if (conflict) throw new Error("That email is already in use.");
      }
      const newEmail = updates.email?.trim() || users[idx].email;
      const updated: User = {
        ...users[idx],
        name: updates.name?.trim() || users[idx].name,
        email: newEmail,
        avatarUri:
          updates.avatarUri === null
            ? undefined
            : updates.avatarUri ?? users[idx].avatarUri,
        isAdmin: isAdminEmail(newEmail),
      };
      users[idx] = updated;
      await saveUsers(users);
      setUser(updated);
    },
    [user]
  );

  return (
    <AuthContext.Provider
      value={{
        user,
        isLoading,
        login,
        register,
        logout,
        enterClubCode,
        updateProfile,
      }}
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
