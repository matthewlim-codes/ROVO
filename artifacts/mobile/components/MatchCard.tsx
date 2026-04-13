import { Feather } from "@expo/vector-icons";
import { router } from "expo-router";
import React from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";

import { MatchGroup } from "@/context/TripContext";
import { useColors } from "@/hooks/useColors";
import { formatTimeRange } from "@/utils/time";

interface MatchCardProps {
  group: MatchGroup;
}

export function MatchCard({ group }: MatchCardProps) {
  const colors = useColors();
  const timeRange = formatTimeRange(group.earliestTime, group.latestTime);
  const otherFamilies = group.count - 1;
  const familyLabel = otherFamilies === 1 ? "family" : "families";

  return (
    <Pressable
      onPress={() => router.push(`/chat/${group.groupId}`)}
      style={({ pressed }) => [
        styles.card,
        {
          backgroundColor: colors.card,
          borderRadius: 20,
          opacity: pressed ? 0.92 : 1,
          transform: [{ scale: pressed ? 0.985 : 1 }],
        },
      ]}
    >
      <View style={styles.topRow}>
        <View
          style={[
            styles.modePill,
            { backgroundColor: colors.accentSurface },
          ]}
        >
          <View
            style={[styles.modeDot, { backgroundColor: colors.accent }]}
          />
          <Text style={[styles.modeText, { color: colors.accent }]}>
            {group.mode === "arrival" ? "Arriving" : "Departing"}
          </Text>
        </View>
        <Text style={[styles.timeText, { color: colors.mutedForeground }]}>
          {timeRange}
        </Text>
      </View>

      <Text style={[styles.headline, { color: colors.foreground }]}>
        {otherFamilies} {familyLabel}{" "}
        {group.mode === "arrival" ? "arriving" : "departing"} near you
      </Text>

      <View
        style={[styles.routeRow, { backgroundColor: colors.muted, borderRadius: 12 }]}
      >
        <View style={styles.routeSegment}>
          <Text style={[styles.routeLabel, { color: colors.mutedForeground }]}>
            FROM
          </Text>
          <Text style={[styles.routeValue, { color: colors.foreground }]}>
            {group.airport}
          </Text>
        </View>
        <View style={[styles.routeDivider, { backgroundColor: colors.separator }]} />
        <View style={[styles.routeSegment, { flex: 2 }]}>
          <Text style={[styles.routeLabel, { color: colors.mutedForeground }]}>
            TO
          </Text>
          <Text
            style={[styles.routeValue, { color: colors.foreground }]}
            numberOfLines={1}
          >
            {group.hotel}
          </Text>
        </View>
      </View>

      <View style={styles.footer}>
        <View style={styles.avatarRow}>
          {Array.from({ length: Math.min(group.count, 4) }).map((_, i) => (
            <View
              key={i}
              style={[
                styles.avatar,
                {
                  backgroundColor:
                    i === 0 ? colors.accent : colors.muted,
                  marginLeft: i === 0 ? 0 : -8,
                  borderColor: colors.card,
                },
              ]}
            >
              <Feather
                name="user"
                size={10}
                color={i === 0 ? "#fff" : colors.mutedForeground}
              />
            </View>
          ))}
          {group.count > 4 && (
            <Text
              style={[styles.avatarMore, { color: colors.mutedForeground }]}
            >
              +{group.count - 4}
            </Text>
          )}
        </View>

        <View
          style={[
            styles.joinBtn,
            { backgroundColor: colors.primary, borderRadius: 100 },
          ]}
        >
          <Text style={[styles.joinBtnText, { color: colors.primaryForeground }]}>
            Join Group
          </Text>
          <Feather name="arrow-right" size={14} color={colors.primaryForeground} />
        </View>
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  card: {
    padding: 20,
    marginBottom: 12,
    boxShadow: "0px 2px 12px rgba(0,0,0,0.07)",
    elevation: 3,
    gap: 14,
  },
  topRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  modePill: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 100,
  },
  modeDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
  },
  modeText: {
    fontSize: 12,
    fontFamily: "Inter_600SemiBold",
  },
  timeText: {
    fontSize: 13,
    fontFamily: "Inter_500Medium",
  },
  headline: {
    fontSize: 22,
    fontFamily: "Inter_700Bold",
    lineHeight: 28,
    letterSpacing: -0.3,
  },
  routeRow: {
    flexDirection: "row",
    alignItems: "stretch",
    paddingVertical: 12,
    paddingHorizontal: 14,
    gap: 0,
  },
  routeSegment: {
    flex: 1,
    gap: 3,
  },
  routeDivider: {
    width: 1,
    marginHorizontal: 14,
  },
  routeLabel: {
    fontSize: 10,
    fontFamily: "Inter_600SemiBold",
    letterSpacing: 0.8,
  },
  routeValue: {
    fontSize: 15,
    fontFamily: "Inter_700Bold",
  },
  footer: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  avatarRow: {
    flexDirection: "row",
    alignItems: "center",
  },
  avatar: {
    width: 28,
    height: 28,
    borderRadius: 14,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 2,
  },
  avatarMore: {
    fontSize: 12,
    fontFamily: "Inter_500Medium",
    marginLeft: 6,
  },
  joinBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingHorizontal: 16,
    paddingVertical: 10,
  },
  joinBtnText: {
    fontSize: 14,
    fontFamily: "Inter_600SemiBold",
  },
});
