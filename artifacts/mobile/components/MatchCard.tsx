import { Feather } from "@expo/vector-icons";
import { router } from "expo-router";
import React from "react";
import {
  Pressable,
  StyleSheet,
  Text,
  View,
} from "react-native";

import { MatchGroup } from "@/context/TripContext";
import { useColors } from "@/hooks/useColors";
import { formatTimeRange } from "@/utils/time";

interface MatchCardProps {
  group: MatchGroup;
}

export function MatchCard({ group }: MatchCardProps) {
  const colors = useColors();
  const timeRange = formatTimeRange(group.earliestTime, group.latestTime);
  const familyCount = group.count - 1;
  const familyLabel = familyCount === 1 ? "family" : "families";

  return (
    <Pressable
      onPress={() => router.push(`/chat/${group.groupId}`)}
      style={({ pressed }) => [
        styles.card,
        {
          backgroundColor: colors.card,
          borderRadius: colors.radius,
          opacity: pressed ? 0.9 : 1,
          shadowColor: colors.navy,
        },
      ]}
    >
      <View style={styles.header}>
        <View
          style={[styles.badge, { backgroundColor: colors.accent }]}
        >
          <Feather
            name={group.mode === "arrival" ? "arrow-down-circle" : "arrow-up-circle"}
            size={14}
            color={colors.orange}
          />
          <Text style={[styles.badgeText, { color: colors.orange }]}>
            {group.mode === "arrival" ? "Arriving" : "Departing"}
          </Text>
        </View>
        <Text style={[styles.time, { color: colors.mutedForeground }]}>
          {timeRange}
        </Text>
      </View>

      <Text style={[styles.headline, { color: colors.foreground }]}>
        {familyCount} {familyLabel} {group.mode === "arrival" ? "arriving" : "departing"} near you
      </Text>

      <View style={styles.route}>
        <View style={styles.routeItem}>
          <Feather name="airplay" size={16} color={colors.mutedForeground} />
          <Text style={[styles.routeText, { color: colors.foreground }]}>
            {group.airport}
          </Text>
        </View>
        <Feather name="arrow-right" size={14} color={colors.mutedForeground} />
        <View style={styles.routeItem}>
          <Feather name="home" size={16} color={colors.mutedForeground} />
          <Text style={[styles.routeText, { color: colors.foreground }]} numberOfLines={1}>
            {group.hotel}
          </Text>
        </View>
      </View>

      <View
        style={[styles.cta, { backgroundColor: colors.primary, borderRadius: colors.radius - 4 }]}
      >
        <Text style={[styles.ctaText, { color: colors.primaryForeground }]}>
          Join Group Chat
        </Text>
        <Feather name="message-circle" size={16} color={colors.primaryForeground} />
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  card: {
    padding: 20,
    marginHorizontal: 16,
    marginBottom: 12,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08,
    shadowRadius: 8,
    elevation: 3,
    gap: 12,
  },
  header: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  badge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 100,
  },
  badgeText: {
    fontSize: 12,
    fontFamily: "Inter_600SemiBold",
  },
  time: {
    fontSize: 13,
    fontFamily: "Inter_500Medium",
  },
  headline: {
    fontSize: 20,
    fontFamily: "Inter_700Bold",
    lineHeight: 26,
  },
  route: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  routeItem: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    flex: 1,
  },
  routeText: {
    fontSize: 14,
    fontFamily: "Inter_500Medium",
    flex: 1,
  },
  cta: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    paddingVertical: 14,
    marginTop: 4,
  },
  ctaText: {
    fontSize: 15,
    fontFamily: "Inter_600SemiBold",
  },
});
