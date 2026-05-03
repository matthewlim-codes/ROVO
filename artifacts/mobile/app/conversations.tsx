import { Feather } from "@expo/vector-icons";
import { router } from "expo-router";
import React, { useCallback, useEffect, useState } from "react";
import {
  ActivityIndicator,
  Platform,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { Conversation, useTrip } from "@/context/TripContext";
import { useColors } from "@/hooks/useColors";

function parseGroupLabel(groupId: string): { title: string; sub: string } {
  if (groupId.startsWith("rs-")) {
    return { title: "Rideshare", sub: "Private rideshare coordination" };
  }
  const parts = groupId.split("-");
  if (parts.length >= 4) {
    const mode = parts[parts.length - 1];
    const airport = parts[parts.length - 3] ?? parts[1] ?? "";
    return {
      title: `${airport} ${mode === "arrival" ? "Arrival" : "Departure"} Group`,
      sub: "Group ride coordination",
    };
  }
  return { title: "Chat", sub: groupId };
}

function timeAgo(isoString: string): string {
  const diff = Date.now() - new Date(isoString).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  const days = Math.floor(hrs / 24);
  return `${days}d ago`;
}

export default function ConversationsScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const { fetchConversations, trips } = useTrip();
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(async () => {
    const data = await fetchConversations();
    data.sort(
      (a, b) =>
        new Date(b.lastTimestamp).getTime() - new Date(a.lastTimestamp).getTime()
    );
    setConversations(data);
    setLoading(false);
  }, [fetchConversations]);

  useEffect(() => {
    load();
  }, [load]);

  const handleRefresh = async () => {
    setRefreshing(true);
    await load();
    setRefreshing(false);
  };

  const handleOpen = (groupId: string) => {
    router.push(`/chat/${encodeURIComponent(groupId)}`);
  };

  const getGroupParticipants = (groupId: string): string => {
    if (groupId.startsWith("rs-")) {
      const inner = groupId.slice(3);
      const sep = inner.indexOf("__");
      const ids = sep !== -1 ? [inner.slice(0, sep), inner.slice(sep + 2)] : [];
      const names = trips
        .filter((t) => ids.includes(t.id.replace(/^srv-/, "")))
        .map((t) => t.userName);
      return names.join(" & ") || "Rideshare";
    }
    const participants = trips
      .filter((t) => {
        const key = `${t.tournamentId}-${t.airport}-${t.hotelPlaceId || t.hotel}-${t.mode}`;
        return key === groupId;
      })
      .map((t) => t.userName);
    if (participants.length === 0) return "";
    if (participants.length <= 3) return participants.join(", ");
    return `${participants.slice(0, 2).join(", ")} +${participants.length - 2} more`;
  };

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <View
        style={[
          styles.header,
          {
            backgroundColor: colors.background,
            paddingTop: insets.top + (Platform.OS === "web" ? 67 : 0) + 8,
            borderBottomColor: colors.separator,
          },
        ]}
      >
        <Pressable onPress={() => router.back()} style={styles.backBtn}>
          <Feather name="arrow-left" size={22} color={colors.foreground} />
        </Pressable>
        <Text style={[styles.headerTitle, { color: colors.foreground }]}>
          Messages
        </Text>
      </View>

      <ScrollView
        contentContainerStyle={[
          styles.list,
          {
            paddingBottom: insets.bottom + (Platform.OS === "web" ? 34 : 0) + 24,
          },
        ]}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={handleRefresh}
            tintColor={colors.accent}
          />
        }
      >
        {loading ? (
          <View style={styles.center}>
            <ActivityIndicator color={colors.accent} />
          </View>
        ) : conversations.length === 0 ? (
          <View style={styles.center}>
            <Feather name="message-circle" size={40} color={colors.mutedForeground} />
            <Text style={[styles.emptyTitle, { color: colors.foreground }]}>
              No messages yet
            </Text>
            <Text style={[styles.emptyBody, { color: colors.mutedForeground }]}>
              When you chat with a rideshare match, conversations will appear here.
            </Text>
          </View>
        ) : (
          conversations.map((conv) => {
            const { title, sub } = parseGroupLabel(conv.groupId);
            const participants = getGroupParticipants(conv.groupId);
            return (
              <Pressable
                key={conv.groupId}
                onPress={() => handleOpen(conv.groupId)}
                style={({ pressed }) => [
                  styles.row,
                  {
                    backgroundColor: colors.card,
                    borderColor: colors.separator,
                    opacity: pressed ? 0.88 : 1,
                  },
                ]}
              >
                <View
                  style={[
                    styles.iconWrap,
                    { backgroundColor: colors.accentSurface },
                  ]}
                >
                  <Feather
                    name={conv.groupId.startsWith("rs-") ? "user" : "users"}
                    size={18}
                    color={colors.accent}
                  />
                </View>

                <View style={{ flex: 1, gap: 3 }}>
                  <View style={styles.rowTop}>
                    <Text
                      style={[styles.convTitle, { color: colors.foreground }]}
                      numberOfLines={1}
                    >
                      {title}
                    </Text>
                    <Text style={[styles.timeText, { color: colors.mutedForeground }]}>
                      {timeAgo(conv.lastTimestamp)}
                    </Text>
                  </View>
                  {participants ? (
                    <Text
                      style={[styles.participants, { color: colors.accent }]}
                      numberOfLines={1}
                    >
                      {participants}
                    </Text>
                  ) : null}
                  <Text
                    style={[styles.preview, { color: colors.mutedForeground }]}
                    numberOfLines={1}
                  >
                    <Text style={{ fontFamily: "Inter_500Medium" }}>
                      {conv.lastSenderName}:{" "}
                    </Text>
                    {conv.lastMessage}
                  </Text>
                </View>

                <Feather name="chevron-right" size={16} color={colors.mutedForeground} />
              </Pressable>
            );
          })
        )}

        {conversations.length > 0 && (
          <Text style={[styles.expiryNote, { color: colors.mutedForeground }]}>
            Conversations expire after 3 days of inactivity
          </Text>
        )}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  header: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    paddingHorizontal: 16,
    paddingBottom: 14,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  backBtn: {
    width: 40,
    height: 40,
    alignItems: "center",
    justifyContent: "center",
  },
  headerTitle: {
    fontSize: 22,
    fontFamily: "Inter_700Bold",
    letterSpacing: -0.4,
  },
  list: {
    padding: 16,
    gap: 10,
  },
  center: {
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 72,
    gap: 12,
    paddingHorizontal: 32,
  },
  emptyTitle: {
    fontSize: 18,
    fontFamily: "Inter_700Bold",
    letterSpacing: -0.3,
  },
  emptyBody: {
    fontSize: 14,
    fontFamily: "Inter_400Regular",
    textAlign: "center",
    lineHeight: 21,
  },
  row: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    padding: 14,
    borderRadius: 16,
    borderWidth: StyleSheet.hairlineWidth,
  },
  iconWrap: {
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: "center",
    justifyContent: "center",
    flexShrink: 0,
  },
  rowTop: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  convTitle: {
    fontSize: 15,
    fontFamily: "Inter_600SemiBold",
    flex: 1,
  },
  timeText: {
    fontSize: 11,
    fontFamily: "Inter_400Regular",
    flexShrink: 0,
    marginLeft: 8,
  },
  participants: {
    fontSize: 12,
    fontFamily: "Inter_500Medium",
  },
  preview: {
    fontSize: 13,
    fontFamily: "Inter_400Regular",
  },
  expiryNote: {
    fontSize: 11,
    fontFamily: "Inter_400Regular",
    textAlign: "center",
    marginTop: 8,
  },
});
