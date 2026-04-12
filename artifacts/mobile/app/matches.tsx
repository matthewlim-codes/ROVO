import { Feather } from "@expo/vector-icons";
import { router, useLocalSearchParams } from "expo-router";
import React, { useMemo } from "react";
import {
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { Button } from "@/components/Button";
import { MatchCard } from "@/components/MatchCard";
import { useAuth } from "@/context/AuthContext";
import { useTrip } from "@/context/TripContext";
import { useColors } from "@/hooks/useColors";

export default function MatchesScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const { tripId } = useLocalSearchParams<{ tripId: string }>();
  const { trips, selectedTournament, getMatches } = useTrip();
  const { user } = useAuth();

  const trip = trips.find((t) => t.id === tripId);
  const matches = useMemo(() => {
    if (!trip) return [];
    return getMatches(trip);
  }, [trip, getMatches]);

  if (!trip) {
    return (
      <View style={[styles.center, { backgroundColor: colors.background }]}>
        <Text style={{ color: colors.foreground }}>Trip not found.</Text>
        <Button title="Go Back" onPress={() => router.back()} />
      </View>
    );
  }

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <View
        style={[
          styles.header,
          {
            backgroundColor: colors.navy,
            paddingTop: insets.top + (Platform.OS === "web" ? 67 : 0),
          },
        ]}
      >
        <Pressable
          onPress={() => router.back()}
          style={[styles.backBtn, { backgroundColor: "rgba(255,255,255,0.15)" }]}
        >
          <Feather name="arrow-left" size={20} color="#fff" />
        </Pressable>
        <View style={{ flex: 1 }}>
          <Text style={styles.headerTitle}>
            {selectedTournament?.name ?? "Matches"}
          </Text>
          <Text style={styles.headerSub}>
            {trip.airport} — {trip.mode === "arrival" ? "Arriving" : "Departing"}
          </Text>
        </View>
        <Pressable
          onPress={() => router.push("/travel-info")}
          style={[styles.editBtn, { backgroundColor: "rgba(255,255,255,0.15)" }]}
        >
          <Feather name="edit-2" size={16} color="#fff" />
        </Pressable>
      </View>

      <View
        style={[
          styles.tripSummary,
          {
            backgroundColor: colors.accent,
            borderColor: colors.orange,
          },
        ]}
      >
        <View style={styles.tripRow}>
          <Feather name="airplay" size={14} color={colors.orange} />
          <Text style={[styles.tripText, { color: colors.foreground }]}>
            {trip.airport}
          </Text>
          <Feather name="arrow-right" size={12} color={colors.mutedForeground} />
          <Feather name="home" size={14} color={colors.orange} />
          <Text
            style={[styles.tripText, { color: colors.foreground }]}
            numberOfLines={1}
          >
            {trip.hotel}
          </Text>
        </View>
        <View style={styles.tripRow}>
          <Feather name="clock" size={12} color={colors.mutedForeground} />
          <Text style={[styles.tripMeta, { color: colors.mutedForeground }]}>
            {new Date(trip.datetime).toLocaleString("en-US", {
              weekday: "short",
              month: "short",
              day: "numeric",
              hour: "numeric",
              minute: "2-digit",
            })}
          </Text>
        </View>
      </View>

      <ScrollView
        contentContainerStyle={[
          styles.scroll,
          { paddingBottom: insets.bottom + (Platform.OS === "web" ? 34 : 0) + 20 },
        ]}
        showsVerticalScrollIndicator={false}
      >
        {matches.length > 0 ? (
          <>
            <Text style={[styles.sectionTitle, { color: colors.foreground }]}>
              Matching Families
            </Text>
            {matches.map((group) => (
              <MatchCard key={group.groupId} group={group} />
            ))}
          </>
        ) : (
          <View style={styles.emptyState}>
            <View
              style={[
                styles.emptyIcon,
                { backgroundColor: colors.muted },
              ]}
            >
              <Feather name="users" size={36} color={colors.mutedForeground} />
            </View>
            <Text style={[styles.emptyTitle, { color: colors.foreground }]}>
              No matches yet
            </Text>
            <Text style={[styles.emptyBody, { color: colors.mutedForeground }]}>
              No other families have entered travel info for this airport, hotel,
              and time window yet. Check back as more families register!
            </Text>
          </View>
        )}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  center: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    gap: 16,
    padding: 24,
  },
  header: {
    flexDirection: "row",
    alignItems: "flex-end",
    gap: 12,
    paddingHorizontal: 20,
    paddingBottom: 20,
  },
  backBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: "center",
    justifyContent: "center",
  },
  editBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: "center",
    justifyContent: "center",
  },
  headerTitle: {
    fontSize: 20,
    fontFamily: "Inter_700Bold",
    color: "#fff",
  },
  headerSub: {
    fontSize: 13,
    fontFamily: "Inter_400Regular",
    color: "rgba(255,255,255,0.7)",
  },
  tripSummary: {
    margin: 16,
    marginBottom: 8,
    padding: 14,
    borderRadius: 12,
    borderWidth: 1,
    gap: 6,
  },
  tripRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
  },
  tripText: {
    fontSize: 13,
    fontFamily: "Inter_600SemiBold",
    flex: 1,
  },
  tripMeta: {
    fontSize: 12,
    fontFamily: "Inter_400Regular",
    flex: 1,
  },
  scroll: {
    paddingTop: 8,
    gap: 0,
  },
  sectionTitle: {
    fontSize: 16,
    fontFamily: "Inter_700Bold",
    paddingHorizontal: 16,
    paddingBottom: 8,
  },
  emptyState: {
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 40,
    paddingTop: 60,
    gap: 16,
  },
  emptyIcon: {
    width: 80,
    height: 80,
    borderRadius: 40,
    alignItems: "center",
    justifyContent: "center",
  },
  emptyTitle: {
    fontSize: 20,
    fontFamily: "Inter_700Bold",
    textAlign: "center",
  },
  emptyBody: {
    fontSize: 14,
    fontFamily: "Inter_400Regular",
    textAlign: "center",
    lineHeight: 22,
  },
});
