import { Feather } from "@expo/vector-icons";
import { router, useLocalSearchParams } from "expo-router";
import React, { useCallback, useEffect, useMemo, useState } from "react";
import {
  ActivityIndicator,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { Tournament, useTrip } from "@/context/TripContext";
import { useColors } from "@/hooks/useColors";
import { apiFetch } from "@/utils/api";
import {
  buildTripShareDetailsFromRecord,
  fetchTripShare,
  formatTripShareTime,
  getFamilyName,
  TripShareDetails,
  TripShareRecord,
} from "@/utils/tripShare";

interface RideshareMatch {
  id: string;
  userId: string;
  userName: string;
  userTeam: string | null;
  airport: string;
  hotel: string;
  hotelPlaceId: string | null;
  datetime: string;
  baggageCount: number | null;
  partySize: number | null;
}

function tournamentFromRecord(record: TripShareRecord): Tournament | null {
  if (!record.tournament) return null;
  return {
    id: record.tournament.id,
    name: record.tournament.name,
    location: record.tournament.location,
    dates: record.tournament.dates,
    startDate: record.tournament.startDate,
    endDate: record.tournament.endDate,
    gender: "coed",
    description: "",
  };
}

export default function ShareMatchesScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const { setSelectedTournament } = useTrip();
  const { shareId } = useLocalSearchParams<{ shareId: string }>();
  const [record, setRecord] = useState<TripShareRecord | null>(null);
  const [matches, setMatches] = useState<RideshareMatch[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const details = useMemo<TripShareDetails | null>(
    () => (record ? buildTripShareDetailsFromRecord(record) : null),
    [record],
  );

  const load = useCallback(async () => {
    if (!shareId) return;
    setLoading(true);
    setError("");
    try {
      const share = await fetchTripShare(shareId);
      setRecord(share);
      if (!share.active || !share.trip) {
        setMatches([]);
        return;
      }
      const data = await apiFetch<RideshareMatch[]>(
        `/trips/matches?tripId=${encodeURIComponent(share.trip.id)}`,
      );
      setMatches(data);
    } catch {
      setError("Could not load matching rides.");
    } finally {
      setLoading(false);
    }
  }, [shareId]);

  useEffect(() => {
    load();
  }, [load]);

  const joinRide = () => {
    if (!shareId || !record?.trip || !details) return;
    const tournament = tournamentFromRecord(record);
    if (tournament) setSelectedTournament(tournament);
    router.push({
      pathname: "/travel-info",
      params: {
        joinShareId: shareId,
        joinTargetTripId: record.trip.id,
        joinFamilyName: getFamilyName(details.userName),
        joinHotel: details.hotel,
        prefillMode: details.mode,
        prefillAirport: details.airport,
        prefillHotel: details.hotel,
        prefillHotelPlaceId: details.hotelPlaceId ?? "",
        prefillDatetime: details.datetime,
      },
    });
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
        <View style={{ flex: 1 }}>
          <Text style={[styles.headerTitle, { color: colors.foreground }]}>
            Other matches
          </Text>
          <Text style={[styles.headerSub, { color: colors.mutedForeground }]}>
            Same airport, hotel, and time window
          </Text>
        </View>
      </View>

      {loading ? (
        <View style={styles.center}>
          <ActivityIndicator color={colors.primary} size="large" />
          <Text style={[styles.centerText, { color: colors.mutedForeground }]}>
            Finding nearby matches...
          </Text>
        </View>
      ) : error || !details ? (
        <View style={styles.center}>
          <Feather name="alert-circle" size={30} color={colors.destructive} />
          <Text style={[styles.centerText, { color: colors.mutedForeground }]}>
            {error || "This shared trip is no longer active."}
          </Text>
        </View>
      ) : (
        <ScrollView
          contentContainerStyle={[
            styles.scroll,
            { paddingBottom: insets.bottom + (Platform.OS === "web" ? 34 : 0) + 32 },
          ]}
          showsVerticalScrollIndicator={false}
        >
          <View
            style={[
              styles.filterCard,
              { backgroundColor: colors.accentSurface, borderColor: colors.accentBorder },
            ]}
          >
            <Text style={[styles.filterTitle, { color: colors.foreground }]}>
              Matches near {details.airport}
            </Text>
            <Text style={[styles.filterText, { color: colors.mutedForeground }]}>
              Filtered for {details.hotel} around {formatTripShareTime(details.datetime)}.
            </Text>
          </View>

          {matches.length ? (
            matches.map((match) => (
              <View key={match.id} style={[styles.matchCard, { backgroundColor: colors.card }]}>
                <View style={[styles.avatar, { backgroundColor: colors.muted }]}>
                  <Text style={[styles.avatarText, { color: colors.foreground }]}>
                    {getFamilyName(match.userName).charAt(0).toUpperCase()}
                  </Text>
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={[styles.matchName, { color: colors.foreground }]}>
                    {getFamilyName(match.userName)} family
                  </Text>
                  <Text style={[styles.matchMeta, { color: colors.mutedForeground }]}>
                    {formatTripShareTime(match.datetime)} - {match.partySize ?? "?"} people
                  </Text>
                </View>
              </View>
            ))
          ) : (
            <View style={styles.empty}>
              <Feather name="users" size={30} color={colors.mutedForeground} />
              <Text style={[styles.emptyTitle, { color: colors.foreground }]}>
                No other matches yet
              </Text>
              <Text style={[styles.emptyText, { color: colors.mutedForeground }]}>
                Join this ride or add your details so families can match with you.
              </Text>
            </View>
          )}

          <Pressable
            onPress={joinRide}
            style={({ pressed }) => [
              styles.joinBtn,
              { backgroundColor: colors.primary, opacity: pressed ? 0.86 : 1 },
            ]}
          >
            <Text style={[styles.joinBtnText, { color: colors.primaryForeground }]}>
              Join this ride
            </Text>
          </Pressable>
        </ScrollView>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
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
  center: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    gap: 12,
    padding: 28,
  },
  centerText: {
    fontSize: 14,
    fontFamily: "Inter_400Regular",
    textAlign: "center",
    lineHeight: 21,
  },
  scroll: { padding: 16, gap: 12 },
  filterCard: {
    padding: 16,
    borderRadius: 18,
    borderWidth: 1,
  },
  filterTitle: {
    fontSize: 18,
    fontFamily: "Inter_700Bold",
  },
  filterText: {
    fontSize: 13,
    fontFamily: "Inter_400Regular",
    lineHeight: 19,
    marginTop: 4,
  },
  matchCard: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    padding: 14,
    borderRadius: 18,
  },
  avatar: {
    width: 42,
    height: 42,
    borderRadius: 21,
    alignItems: "center",
    justifyContent: "center",
  },
  avatarText: {
    fontSize: 17,
    fontFamily: "Inter_700Bold",
  },
  matchName: {
    fontSize: 16,
    fontFamily: "Inter_700Bold",
  },
  matchMeta: {
    fontSize: 13,
    fontFamily: "Inter_400Regular",
    marginTop: 2,
  },
  empty: {
    alignItems: "center",
    gap: 10,
    padding: 28,
  },
  emptyTitle: {
    fontSize: 18,
    fontFamily: "Inter_700Bold",
  },
  emptyText: {
    fontSize: 14,
    fontFamily: "Inter_400Regular",
    textAlign: "center",
    lineHeight: 21,
  },
  joinBtn: {
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 15,
    borderRadius: 18,
  },
  joinBtnText: {
    fontSize: 16,
    fontFamily: "Inter_700Bold",
  },
});
