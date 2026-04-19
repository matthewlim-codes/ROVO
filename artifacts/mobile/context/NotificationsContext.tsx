import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
} from "react";
import { AppState } from "react-native";

import { apiFetch } from "@/utils/api";
import { useAuth } from "./AuthContext";

export interface AppNotification {
  id: string;
  userId: string;
  kind: string;
  title: string;
  body: string;
  data?: Record<string, unknown> | null;
  readAt?: string | null;
  createdAt: string;
}

interface NotificationsContextType {
  notifications: AppNotification[];
  unread: AppNotification[];
  refresh: () => Promise<void>;
  markRead: (id: string) => Promise<void>;
  markAllRead: () => Promise<void>;
}

const NotificationsContext = createContext<NotificationsContextType | null>(null);

export function NotificationsProvider({ children }: { children: React.ReactNode }) {
  const { user } = useAuth();
  const [notifications, setNotifications] = useState<AppNotification[]>([]);
  const userIdRef = useRef<string | null>(null);
  userIdRef.current = user?.id ?? null;

  const refresh = useCallback(async () => {
    const uid = userIdRef.current;
    if (!uid) return;
    try {
      const data = await apiFetch<AppNotification[]>(
        `/notifications?userId=${encodeURIComponent(uid)}`,
      );
      setNotifications(data);
    } catch {}
  }, []);

  useEffect(() => {
    if (!user?.id) {
      setNotifications([]);
      return;
    }
    refresh();
    const interval = setInterval(refresh, 30000);
    const sub = AppState.addEventListener("change", (s) => {
      if (s === "active") refresh();
    });
    return () => {
      clearInterval(interval);
      sub.remove();
    };
  }, [user?.id, refresh]);

  const markRead = useCallback(
    async (id: string) => {
      setNotifications((prev) =>
        prev.map((n) => (n.id === id ? { ...n, readAt: new Date().toISOString() } : n)),
      );
      try {
        await apiFetch(`/notifications/${id}/read`, { method: "POST" });
      } catch {}
    },
    [],
  );

  const markAllRead = useCallback(async () => {
    const uid = userIdRef.current;
    if (!uid) return;
    setNotifications((prev) =>
      prev.map((n) => ({ ...n, readAt: n.readAt ?? new Date().toISOString() })),
    );
    try {
      await apiFetch("/notifications/read-all", {
        method: "POST",
        body: JSON.stringify({ userId: uid }),
      });
    } catch {}
  }, []);

  const unread = notifications.filter((n) => !n.readAt);

  return (
    <NotificationsContext.Provider
      value={{ notifications, unread, refresh, markRead, markAllRead }}
    >
      {children}
    </NotificationsContext.Provider>
  );
}

export function useNotifications() {
  const ctx = useContext(NotificationsContext);
  if (!ctx) throw new Error("useNotifications must be inside NotificationsProvider");
  return ctx;
}
