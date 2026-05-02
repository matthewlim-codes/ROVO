import { Feather } from "@expo/vector-icons";
import { router, useLocalSearchParams } from "expo-router";
import React, { useEffect, useMemo, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { MatchCard } from "@/components/MatchCard";
import { useAuth } from "@/context/AuthContext";
import { useTrip } from "@/context/TripContext";
import { useColors } from "@/hooks/useColors";
import { apiFetch } from "@/utils/api";

export default function MatchesScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const { tripId } = useLocalSearchParams<{ tripId: string }>();
  const { trips, tripsLoading, selectedTournament, getMatches } = useTrip();
  const { user } = useAuth();
  const [watching, setWatching] = useState(false);
  const [watchSubmitting, setWatchSubmitting] = useState(false);

  const trip = trips.find((t) => t.id === tripId);
  const matches = useMemo(() => {
    if (!trip) return [];
    return getMatches(trip);
  }, [trip, getMatches]);

  const handleNotifyMe = async () => {
    if (!trip || !user) return;
    setWatchSubmitting(true);
    try {
      await apiFetch("/watches", {
        method: "POST",
        body: JSON.stringify({
          userId: user.id,
          userName: user.name,
          tournamentId: trip.tournamentId,
          airport: trip.airport,
          hotel: trip.hotel,
          hotelPlaceId: trip.hotelPlaceId,
          datetime: trip.datetime,
          mode: trip.mode,
        }),
      });
      setWatching(true);
    } catch (e) {
      Alert.alert("Could not set alert", e instanceof Error ? e.message : String(e));
    } finally {
      setWatchSubmitting(false);
    }
  };

  if (!trip) {
    if (tripsLoading) {
      return (
        <View style={[styles.center, { backgroundColor: colors.background }]}>
          <ActivityIndicator size="large" color={colors.primary} />
          <Text style={[styles.loadingText, { color: colors.mutedForeground }]}>
            Loading your trip…
          </Text>
        </View>
      );
    }
    return (
      <View style={[styles.center, { backgroundColor: colors.background }]}>
        <View style={[styles.emptyIcon, { backgroundColor: colors.muted }]}>
          <Feather name="map-pin" size={28} color={colors.mutedForeground} />
        </View>
        <Text style={[styles.notFoundTitle, { color: colors.foreground }]}>
          Trip not found
        </Text>
        <Text style={[styles.notFoundBody, { color: colors.mutedForeground }]}>
          We couldn't find your trip details. Try submitting your travel info again.
        </Text>
        <Pressable
          onPress={() => router.back()}
          style={({ pressed }) => [
            styles.goBackBtn,
            { backgroundColor: colors.foreground, opacity: pressed ? 0.8 : 1 },
          ]}
        >
          <Feather name="arrow-left" size={16} color={colors.background} />
          <Text style={[styles.goBackText, { color: colors.background }]}>
            Go back
          </Text>
        </Pressable>
      </View>
    );
  }

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
        <View style={{ flex: 1 }}>
          <Text style={[styles.headerTitle, { color: colors.foreground }]}>
            Matches
          </Text>
          <Text
            style={[styles.headerSub, { color: colors.mutedForeground }]}
            numberOfLines={1}
          >
            {selectedTournament?.name}
          </Text>
        </View>
        <Pressable
          onPress={() => router.push("/travel-info")}
          style={[styles.editBtn, { backgroundColor: colors.muted }]}
        >
          <Feather name="edit-2" size={16} color={colors.foreground} />
        </Pressable>
      </View>

      <View
        style={[
          styles.tripSummary,
          {
            backgroundColor: colors.accentSurface,
            borderColor: colors.accentBorder,
          },
        ]}
      >
        <View style={styles.tripPill}>
          <Text style={[styles.tripPillLabel, { color: colors.mutedForeground }]}>
            {trip.mode === "arrival" ? "ARRIVING" : "DEPARTING"}
          </Text>
          <Text style={[styles.tripPillValue, { color: colors.foreground }]}>
            {trip.airport} → {trip.hotel}
          </Text>
        </View>
        <View style={[styles.tripDivider, { backgroundColor: colors.accentBorder }]} />
        <View style={styles.tripPill}>
          <Text style={[styles.tripPillLabel, { color: colors.mutedForeground }]}>
            TIME
          </Text>
          <Text style={[styles.tripPillValue, { color: colors.foreground }]}>
            {new Date(trip.datetime).toLocaleTimeString("en-US", {
              hour: "numeric",
              minute: "2-digit",
            })}
          </Text>
        </View>
      </View>

      <ScrollView
        contentContainerStyle={[
          styles.scroll,
          {
            paddingBottom:
              insets.bottom + (Platform.OS === "web" ? 34 : 0) + 20,
          },
        ]}
        showsVerticalScrollIndicator={false}
      >
        {matches.length > 0 ? (
          <>
            <View style={styles.sectionHeader}>
              <Text style={[styles.sectionTitle, { color: colors.foreground }]}>
                {matches.length} group{matches.length > 1 ? "s" : ""} found
              </Text>
              <View
                style={[
                  styles.liveIndicator,
                  { backgroundColor: colors.accentSurface },
                ]}
              >
                <View
                  style={[styles.liveDot, { backgroundColor: colors.accent }]}
                />
                <Text style={[styles.liveText, { color: colors.accent }]}>
                  Live
                </Text>
              </View>
            </View>
            {matches.map((group) => (
              <MatchCard key={group.groupId} group={group} />
            ))}
          </>
        ) : (
          <View style={styles.emptyState}>
            <View
              style={[styles.emptyIcon, { backgroundColor: colors.muted }]}
            >
              <Feather name="users" size={32} color={colors.mutedForeground} />
            </View>
            <Text style={[styles.emptyTitle, { color: colors.foreground }]}>
              No matches yet
            </Text>
            <Text style={[styles.emptyBody, { color: colors.mutedForeground }]}>
              No families have entered the same airport and hotel for this time
              window. Check back as more families register.
            </Text>
            {watching ? (
              <View
                style={[
                  styles.watchingPill,
                  { backgroundColor: colors.accentSurface, borderColor: colors.accentBorder },
                ]}
              >
                <Feather name="bell" size={14} color={colors.accent} />
                <Text style={[styles.watchingText, { color: colors.accent }]}>
                  We'll alert you when someone matches
                </Text>
              </View>
            ) : (
              <Pressable
                onPress={handleNotifyMe}
                disabled={watchSubmitting}
                style={({ pressed }) => [
                  styles.notifyBtn,
                  {
                    backgroundColor: colors.foreground,
                    opacity: pressed || watchSubmitting ? 0.85 : 1,
                  },
                ]}
              >
                {watchSubmitting ? (
                  <ActivityIndicator color={colors.background} />
                ) : (
                  <>
                    <Feather name="bell" size={15} color={colors.background} />
                    <Text style={[styles.notifyBtnText, { color: colors.background }]}>
                      Notify me when someone matches
                    </Text>
                  </>
                )}
              </Pressable>
            )}
          </View>
        )}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
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
    paddingBottom: 16,
    borderBottomWidth: 1,
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
    letterSpacing: -0.5,
  },
  headerSub: {
    fontSize: 13,
    fontFamily: "Inter_400Regular",
    marginTop: 1,
  },
  editBtn: {
    width: 36,
    height: 36,
    borderRadius: 10,
    alignItems: "center",
    justifyContent: "center",
  },
  tripSummary: {
    flexDirection: "row",
    alignItems: "center",
    marginHorizontal: 16,
    marginTop: 12,
    borderRadius: 14,
    borderWidth: 1,
    overflow: "hidden",
  },
  tripPill: {
    flex: 1,
    paddingVertical: 12,
    paddingHorizontal: 14,
    gap: 3,
  },
  tripPillLabel: {
    fontSize: 10,
    fontFamily: "Inter_600SemiBold",
    letterSpacing: 0.8,
  },
  tripPillValue: {
    fontSize: 13,
    fontFamily: "Inter_700Bold",
  },
  tripDivider: {
    width: 1,
    height: "60%",
  },
  scroll: {
    padding: 16,
    gap: 0,
  },
  sectionHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 12,
  },
  sectionTitle: {
    fontSize: 17,
    fontFamily: "Inter_700Bold",
    letterSpacing: -0.3,
  },
  liveIndicator: {
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 100,
  },
  liveDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
  },
  liveText: {
    fontSize: 12,
    fontFamily: "Inter_600SemiBold",
  },
  emptyState: {
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 40,
    paddingTop: 60,
    gap: 16,
  },
  emptyIcon: {
    width: 72,
    height: 72,
    borderRadius: 36,
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
  notifyBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    paddingHorizontal: 18,
    paddingVertical: 12,
    borderRadius: 100,
    marginTop: 8,
  },
  notifyBtnText: {
    fontSize: 14,
    fontFamily: "Inter_600SemiBold",
  },
  watchingPill: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 100,
    borderWidth: 1,
    marginTop: 8,
  },
  watchingText: {
    fontSize: 13,
    fontFamily: "Inter_600SemiBold",
  },
  loadingText: {
    fontSize: 14,
    fontFamily: "Inter_400Regular",
    marginTop: 12,
  },
  notFoundTitle: {
    fontSize: 20,
    fontFamily: "Inter_700Bold",
    textAlign: "center",
  },
  notFoundBody: {
    fontSize: 14,
    fontFamily: "Inter_400Regular",
    textAlign: "center",
    lineHeight: 22,
  },
  goBackBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    paddingHorizontal: 20,
    paddingVertical: 12,
    borderRadius: 100,
    marginTop: 8,
  },
  goBackText: {
    fontSize: 14,
    fontFamily: "Inter_600SemiBold",
  },
});
