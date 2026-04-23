import AsyncStorage from "@react-native-async-storage/async-storage";
import { useAuth as useClerkAuth, useUser, useClerk } from "@clerk/expo";
import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
} from "react";
import { ApiError, NetworkError, apiFetch, setAuthTokenGetter } from "../utils/api";
import { registerForPushAndUpload } from "../utils/push";

const GUEST_MODE_KEY = "__guest_mode__";

const GUEST_USER: User = {
  id: "guest",
  email: "",
  name: "Guest",
  club: "",
  team: "",
  clubCodeEntered: true,
  isAdmin: false,
};

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
  return email ? list.includes(email.toLowerCase()) : false;
}

interface ServerProfile {
  userId: string;
  name: string;
  email: string;
  club: string;
  team: string;
  clubCodeEntered: string;
  avatarUri: string | null;
}

function profileToUser(p: ServerProfile): User {
  return {
    id: p.userId,
    email: p.email,
    name: p.name,
    club: p.club,
    team: p.team,
    clubCodeEntered: p.clubCodeEntered === "true",
    avatarUri: p.avatarUri ?? undefined,
    isAdmin: isAdminEmail(p.email),
  };
}

interface AuthContextType {
  user: User | null;
  isLoading: boolean;
  logout: () => Promise<void>;
  enterGuestMode: () => Promise<void>;
  enterClubCode: (code: string) => Promise<void>;
  updateProfile: (updates: {
    name?: string;
    email?: string;
    avatarUri?: string | null;
  }) => Promise<void>;
  refreshProfile: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | null>(null);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const { isLoaded, isSignedIn, getToken, signOut } = useClerkAuth();
  const { user: clerkUser } = useUser();
  const { signOut: clerkSignOut } = useClerk();

  const [user, setUser] = useState<User | null>(null);
  const [profileLoading, setProfileLoading] = useState(false);
  const [guestMode, setGuestMode] = useState(false);
  const [guestModeChecked, setGuestModeChecked] = useState(false);
  const lastSyncRef = useRef<string | null>(null);

  // Check for persisted guest mode on mount
  useEffect(() => {
    AsyncStorage.getItem(GUEST_MODE_KEY).then((val) => {
      if (val === "1") {
        setGuestMode(true);
        setUser(GUEST_USER);
      }
      setGuestModeChecked(true);
    }).catch(() => {
      setGuestModeChecked(true);
    });
  }, []);

  // Wire Clerk token into apiFetch as soon as we have a getter
  useEffect(() => {
    setAuthTokenGetter(() => getToken());
    return () => {
      setAuthTokenGetter(null);
    };
  }, [getToken]);

  const refreshProfile = useCallback(async () => {
    if (guestMode) return;
    if (!isSignedIn) {
      setUser(null);
      return;
    }
    setProfileLoading(true);
    try {
      const p = await apiFetch<ServerProfile>("/profile");
      setUser(profileToUser(p));
    } catch {
      // ignore
    } finally {
      setProfileLoading(false);
    }
  }, [guestMode, isSignedIn]);

  // Load profile when sign-in state changes
  useEffect(() => {
    if (guestMode) return;
    if (!isLoaded) return;
    if (!isSignedIn) {
      setUser(null);
      lastSyncRef.current = null;
      return;
    }
    if (lastSyncRef.current === clerkUser?.id) return;
    lastSyncRef.current = clerkUser?.id ?? null;
    refreshProfile();
  }, [guestMode, isLoaded, isSignedIn, clerkUser?.id, refreshProfile]);

  // Sync clerk display name/email into our profile if changed
  useEffect(() => {
    if (!user || !clerkUser) return;
    const clerkName = [clerkUser.firstName, clerkUser.lastName]
      .filter(Boolean)
      .join(" ")
      .trim();
    const clerkEmail =
      clerkUser.primaryEmailAddress?.emailAddress ??
      clerkUser.emailAddresses[0]?.emailAddress ??
      "";
    const updates: { name?: string; email?: string } = {};
    if (clerkName && !user.name) updates.name = clerkName;
    if (clerkEmail && !user.email) updates.email = clerkEmail;
    if (Object.keys(updates).length) {
      apiFetch<ServerProfile>("/profile", {
        method: "PUT",
        body: JSON.stringify(updates),
      })
        .then((p) => setUser(profileToUser(p)))
        .catch(() => {});
    }
  }, [user, clerkUser]);

  // Register for push when signed in
  useEffect(() => {
    if (user?.id) {
      registerForPushAndUpload().catch(() => {});
    }
  }, [user?.id]);

  const enterGuestMode = useCallback(async () => {
    await AsyncStorage.setItem(GUEST_MODE_KEY, "1");
    setGuestMode(true);
    setUser(GUEST_USER);
  }, []);

  const logout = useCallback(async () => {
    await AsyncStorage.removeItem(GUEST_MODE_KEY);
    setGuestMode(false);
    try {
      await clerkSignOut();
    } catch {
      try {
        await signOut();
      } catch {}
    }
    setUser(null);
  }, [clerkSignOut, signOut]);

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
      const updated = await apiFetch<ServerProfile>("/profile/club-code", {
        method: "POST",
        body: JSON.stringify({
          club: clubInfo.clubName ?? "",
          team: clubInfo.teamName,
        }),
      });
      setUser(profileToUser(updated));
    },
    [user],
  );

  const updateProfile = useCallback(
    async (updates: {
      name?: string;
      email?: string;
      avatarUri?: string | null;
    }) => {
      if (!user) return;
      const body: Record<string, unknown> = {};
      if (updates.name !== undefined) body.name = updates.name?.trim();
      if (updates.email !== undefined) body.email = updates.email?.trim();
      if (updates.avatarUri !== undefined) body.avatarUri = updates.avatarUri;
      const updated = await apiFetch<ServerProfile>("/profile", {
        method: "PUT",
        body: JSON.stringify(body),
      });
      setUser(profileToUser(updated));
    },
    [user],
  );

  const isLoading =
    !guestModeChecked ||
    (!guestMode && (!isLoaded || (!!isSignedIn && profileLoading && !user)));

  return (
    <AuthContext.Provider
      value={{
        user,
        isLoading,
        logout,
        enterGuestMode,
        enterClubCode,
        updateProfile,
        refreshProfile,
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
