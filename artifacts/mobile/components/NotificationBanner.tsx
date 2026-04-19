import React from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { Feather } from "@expo/vector-icons";

import { useColors } from "@/hooks/useColors";
import { useNotifications } from "@/context/NotificationsContext";

export function NotificationBanner() {
  const colors = useColors();
  const { unread, markRead } = useNotifications();

  if (!unread.length) return null;
  const n = unread[0];

  return (
    <View
      style={[
        styles.wrap,
        { backgroundColor: colors.accentSurface, borderColor: colors.accentBorder },
      ]}
    >
      <View
        style={[styles.iconWrap, { backgroundColor: colors.accent }]}
      >
        <Feather name="bell" size={14} color="#fff" />
      </View>
      <View style={{ flex: 1 }}>
        <Text style={[styles.title, { color: colors.foreground }]} numberOfLines={1}>
          {n.title}
        </Text>
        <Text style={[styles.body, { color: colors.mutedForeground }]} numberOfLines={2}>
          {n.body}
        </Text>
      </View>
      <Pressable
        onPress={() => markRead(n.id)}
        style={({ pressed }) => [styles.close, { opacity: pressed ? 0.6 : 1 }]}
        hitSlop={8}
      >
        <Feather name="x" size={18} color={colors.mutedForeground} />
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    marginHorizontal: 16,
    marginTop: 8,
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderWidth: 1,
    borderRadius: 12,
  },
  iconWrap: {
    width: 28,
    height: 28,
    borderRadius: 14,
    alignItems: "center",
    justifyContent: "center",
  },
  title: { fontSize: 13, fontFamily: "Inter_700Bold" },
  body: { fontSize: 12, fontFamily: "Inter_400Regular", marginTop: 2 },
  close: { padding: 4 },
});
