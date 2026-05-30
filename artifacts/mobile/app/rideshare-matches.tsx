import { Feather } from "@expo/vector-icons";
import { router, useLocalSearchParams } from "expo-router";
import React, { useCallback, useEffect, useRef, useState } from "react";
import {
  ActivityIndicator,
  AppState,
  Modal,
  Platform,
  Pressable,
  RefreshControl,
  ScrollView,
  Share,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { Trip, useTrip } from "@/context/TripContext";
import { useNotifications } from "@/context/NotificationsContext";
import { useColors } from "@/hooks/useColors";
import { apiFetch } from "@/utils/api";

interface RideshareMatch {
  id: string;
  userId: string;
  userName: string;
  userTeam: string | null;
  tournamentId: string;
  airport: string;
  hotel: string;
  hotelPlaceId: string | null;
  datetime: string;
  baggageCount: number | null;
  partySize: number | null;
}

function formatTime(iso: string): string {
  return new Date(iso).toLocaleTimeString("en-US", {
    hour: "numeric",
    minute: "2-digit",
  });
}

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString("en-US", {
    weekday: "short",
    month: "short",
    day: "numeric",
  });
}

function buildRideshareGroupId(myRawTripId: string, matchRawTripId: string): string {
  const sorted = [myRawTripId, matchRawTripId].sort();
  return `rs-${sorted[0]}__${sorted[1]}`;
}

export default function RideshareMatchesScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const { selectedTournament, trips, deleteTrip } = useTrip();
  const { unread } = useNotifications();
  const { tripId, tripJson } = useLocalSearchParams<{ tripId: string; tripJson?: string }>();

  const [matches, setMatches] = useState<RideshareMatch[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState("");
  const [sheetVisible, setSheetVisible] = useState(false);
  const [cancelling, setCancelling] = useState(false);
  const prevUnreadCountRef = useRef(unread.length);

  const paramTrip: Trip | null = React.useMemo(() => {
    if (!tripJson) return null;
    try { return JSON.parse(tripJson) as Trip; } catch { return null; }
  }, [tripJson]);

  const myTrip = trips.find((t) => t.id === tripId) ?? paramTrip;
  const rawTripId = tripId?.replace(/^srv-/, "") ?? "";
  const isArrival = myTrip?.mode !== "departure";

  const fetchMatches = useCallback(async () => {
    if (!rawTripId) return;
    setError("");
    try {
      const data = await apiFetch<RideshareMatch[]>(
        `/trips/matches?tripId=${encodeURIComponent(rawTripId)}`,
      );
      setMatches(data);
    } catch {
      setError("Couldn't load rideshare matches. Pull to refresh.");
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [rawTripId]);

  useEffect(() => {
    fetchMatches();
    const interval = setInterval(fetchMatches, 30000);
    return () => clearInterval(interval);
  }, [fetchMatches]);

  // Refresh immediately when a new unread notification arrives (e.g. a ride match)
  useEffect(() => {
    if (unread.length > prevUnreadCountRef.current) {
      fetchMatches();
    }
    prevUnreadCountRef.current = unread.length;
  }, [unread.length, fetchMatches]);

  // Refresh when the app returns to the foreground
  useEffect(() => {
    const sub = AppState.addEventListener("change", (state) => {
      if (state === "active") fetchMatches();
    });
    return () => sub.remove();
  }, [fetchMatches]);

  const handleRefresh = () => {
    setRefreshing(true);
    fetchMatches();
  };

  const openDm = (match: RideshareMatch) => {
    const groupId = buildRideshareGroupId(rawTripId, match.id);
    router.push(`/chat/${groupId}`);
  };

  const handleCancelTrip = async () => {
    if (!tripId) return;
    setCancelling(true);
    setSheetVisible(false);
    await deleteTrip(tripId);
    setCancelling(false);
    router.replace("/tournaments");
  };

  const handleEditDetails = () => {
    setSheetVisible(false);
    router.push("/travel-info");
  };

  const handleShare = async () => {
    setSheetVisible(false);
    const tournamentName = selectedTournament?.name ?? "the tournament";
    const mode = isArrival ? "arriving at" : "departing from";
    const airport = myTrip?.airport ?? "the airport";
    try {
      await Share.share({
        message: `Hey! I'm using Rovo to coordinate my rideshare for ${tournamentName}. I'm ${mode} ${airport} — download Rovo and save your trip so we can match up!`,
      });
    } catch {
      // dismissed
    }
  };

  const renderPrimaryCard = (primary: RideshareMatch, secondaries: RideshareMatch[]) => (
    <View key={primary.id} style={[styles.card, { backgroundColor: colors.card }]}>
      <Pressable
        onPress={() => openDm(primary)}
        style={({ pressed }) => [styles.primaryRow, { opacity: pressed ? 0.85 : 1 }]}
      >
        <View style={[styles.avatarCircle, { backgroundColor: colors.accentSurface }]}>
          <Text style={[styles.avatarLetter, { color: colors.accent }]}>
            {primary.userName.charAt(0).toUpperCase()}
          </Text>
        </View>

        <View style={{ flex: 1, gap: 4 }}>
          <Text style={[styles.headline, { color: colors.foreground }]}>
            <Text style={{ fontFamily: "Inter_700Bold" }}>{primary.userName}</Text>
            {isArrival ? " is arriving at " : " is departing at "}
            <Text style={{ fontFamily: "Inter_700Bold" }}>{formatTime(primary.datetime)}</Text>
            {" — want to rideshare?"}
          </Text>

          <View style={styles.metaRow}>
            {primary.partySize != null && (
              <View style={[styles.metaBadge, { backgroundColor: colors.muted }]}>
                <Feather name="users" size={12} color={colors.mutedForeground} />
                <Text style={[styles.metaText, { color: colors.mutedForeground }]}>
                  {primary.partySize} {primary.partySize === 1 ? "person" : "people"}
                </Text>
              </View>
            )}
            {primary.baggageCount != null && (
              <View style={[styles.metaBadge, { backgroundColor: colors.muted }]}>
                <Feather name="shopping-bag" size={12} color={colors.mutedForeground} />
                <Text style={[styles.metaText, { color: colors.mutedForeground }]}>
                  {primary.baggageCount} {primary.baggageCount === 1 ? "bag" : "bags"}
                </Text>
              </View>
            )}
            {primary.userTeam ? (
              <View style={[styles.metaBadge, { backgroundColor: colors.muted }]}>
                <Text style={[styles.metaText, { color: colors.mutedForeground }]}>
                  {primary.userTeam}
                </Text>
              </View>
            ) : null}
          </View>
        </View>

        <View style={[styles.messageBtn, { backgroundColor: colors.primary }]}>
          <Feather name="message-circle" size={16} color={colors.primaryForeground} />
        </View>
      </Pressable>

      {secondaries.length > 0 && (
        <View style={[styles.secondaryList, { borderTopColor: colors.separator }]}>
          {secondaries.map((s) => (
            <Pressable
              key={s.id}
              onPress={() => openDm(s)}
              style={({ pressed }) => [styles.secondaryRow, { opacity: pressed ? 0.8 : 1 }]}
            >
              <View style={[styles.secondaryAvatar, { backgroundColor: colors.muted }]}>
                <Text style={[styles.secondaryAvatarLetter, { color: colors.mutedForeground }]}>
                  {s.userName.charAt(0).toUpperCase()}
                </Text>
              </View>
              <Text style={[styles.secondaryName, { color: colors.foreground }]}>
                {s.userName}
              </Text>
              <Text style={[styles.secondaryTime, { color: colors.mutedForeground }]}>
                {formatTime(s.datetime)}
              </Text>
              {s.partySize != null && (
                <View style={[styles.secondaryBadge, { backgroundColor: colors.muted }]}>
                  <Feather name="users" size={10} color={colors.mutedForeground} />
                  <Text style={[styles.secondaryBadgeText, { color: colors.mutedForeground }]}>
                    {s.partySize}
                  </Text>
                </View>
              )}
              <Feather name="chevron-right" size={14} color={colors.mutedForeground} />
            </Pressable>
          ))}
        </View>
      )}
    </View>
  );

  const buildClusters = (): Array<{ primary: RideshareMatch; secondaries: RideshareMatch[] }> => {
    if (matches.length === 0) return [];
    const sorted = [...matches].sort(
      (a, b) => new Date(a.datetime).getTime() - new Date(b.datetime).getTime(),
    );
    const clusters: Array<{ primary: RideshareMatch; secondaries: RideshareMatch[] }> = [];
    const assigned = new Set<string>();

    for (const candidate of sorted) {
      if (assigned.has(candidate.id)) continue;
      const cluster = { primary: candidate, secondaries: [] as RideshareMatch[] };
      assigned.add(candidate.id);
      let lastTime = new Date(candidate.datetime).getTime();
      for (const other of sorted) {
        if (assigned.has(other.id)) continue;
        const otherTime = new Date(other.datetime).getTime();
        if (otherTime - lastTime <= 60 * 60 * 1000) {
          cluster.secondaries.push(other);
          assigned.add(other.id);
          lastTime = otherTime;
        }
      }
      clusters.push(cluster);
    }
    return clusters;
  };

  const clusters = buildClusters();
  const totalMatches = clusters.reduce((n, c) => n + 1 + c.secondaries.length, 0);

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      {/* Header */}
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
            Rideshare matches
          </Text>
          {selectedTournament && (
            <Text style={[styles.headerSub, { color: colors.mutedForeground }]} numberOfLines={1}>
              {selectedTournament.name}
            </Text>
          )}
        </View>
      </View>

      {/* My trip banner */}
      {myTrip && (
        <View style={[styles.myTripCard, { backgroundColor: colors.accentSurface, borderBottomColor: colors.accentBorder }]}>
          <View style={styles.myTripTop}>
            <View style={[styles.livePill, { backgroundColor: colors.card }]}>
              <View style={[styles.liveDot, { backgroundColor: colors.accent }]} />
              <Text style={[styles.liveText, { color: colors.accent }]}>
                {isArrival ? "Your arrival" : "Your departure"}
              </Text>
            </View>
          </View>

          <View style={styles.myTripMain}>
            <Text style={[styles.myTripAirport, { color: colors.foreground }]}>
              {myTrip.airport}
            </Text>
            <View style={styles.myTripDetails}>
              <View style={[styles.myTripBadge, { backgroundColor: colors.card }]}>
                <Feather name="clock" size={14} color={colors.accent} />
                <Text style={[styles.myTripBadgeText, { color: colors.foreground }]}>
                  {formatTime(myTrip.datetime)}
                </Text>
              </View>
              <View style={[styles.myTripBadge, { backgroundColor: colors.card }]}>
                <Feather name="calendar" size={14} color={colors.accent} />
                <Text style={[styles.myTripBadgeText, { color: colors.foreground }]}>
                  {formatDate(myTrip.datetime)}
                </Text>
              </View>
              {myTrip.partySize != null && (
                <View style={[styles.myTripBadge, { backgroundColor: colors.card }]}>
                  <Feather name="users" size={14} color={colors.accent} />
                  <Text style={[styles.myTripBadgeText, { color: colors.foreground }]}>
                    {myTrip.partySize} {myTrip.partySize === 1 ? "person" : "people"}
                  </Text>
                </View>
              )}
              {myTrip.baggageCount != null && (
                <View style={[styles.myTripBadge, { backgroundColor: colors.card }]}>
                  <Feather name="shopping-bag" size={14} color={colors.accent} />
                  <Text style={[styles.myTripBadgeText, { color: colors.foreground }]}>
                    {myTrip.baggageCount} {myTrip.baggageCount === 1 ? "bag" : "bags"}
                  </Text>
                </View>
              )}
            </View>
            <Text style={[styles.myTripHotel, { color: colors.mutedForeground }]} numberOfLines={1}>
              {isArrival ? "→" : "←"} {myTrip.hotel}
            </Text>
          </View>
        </View>
      )}

      {/* Content */}
      {loading ? (
        <View style={styles.center}>
          <ActivityIndicator size="large" color={colors.primary} />
          <Text style={[styles.loadingText, { color: colors.mutedForeground }]}>
            Finding matches…
          </Text>
        </View>
      ) : (
        <ScrollView
          contentContainerStyle={[
            styles.scroll,
            { paddingBottom: insets.bottom + (Platform.OS === "web" ? 34 : 0) + 100 },
          ]}
          showsVerticalScrollIndicator={false}
          refreshControl={
            <RefreshControl refreshing={refreshing} onRefresh={handleRefresh} tintColor={colors.accent} />
          }
        >
          {error ? (
            <View style={[styles.errorBox, { backgroundColor: "#FEF2F2", borderRadius: 14 }]}>
              <Feather name="alert-circle" size={14} color={colors.destructive} />
              <Text style={[styles.errorText, { color: colors.destructive }]}>{error}</Text>
            </View>
          ) : null}

          {clusters.length > 0 ? (
            <>
              <View style={styles.sectionHeader}>
                <Text style={[styles.sectionTitle, { color: colors.foreground }]}>
                  {totalMatches} match{totalMatches !== 1 ? "es" : ""} found
                </Text>
                <View style={[styles.matchLivePill, { backgroundColor: colors.accentSurface }]}>
                  <View style={[styles.liveDot, { backgroundColor: colors.accent }]} />
                  <Text style={[styles.liveText, { color: colors.accent }]}>Live</Text>
                </View>
              </View>
              {clusters.map(({ primary, secondaries }) =>
                renderPrimaryCard(primary, secondaries),
              )}

              <Pressable
                onPress={handleShare}
                style={({ pressed }) => [
                  styles.inviteNudge,
                  {
                    backgroundColor: colors.card,
                    borderColor: colors.separator,
                    opacity: pressed ? 0.8 : 1,
                  },
                ]}
              >
                <Feather name="share-2" size={15} color={colors.accent} />
                <Text style={[styles.inviteNudgeText, { color: colors.mutedForeground }]}>
                  Know someone who would love this?{" "}
                  <Text style={{ color: colors.accent, fontFamily: "Inter_600SemiBold" }}>
                    Invite here
                  </Text>
                </Text>
              </Pressable>
            </>
          ) : (
            <View style={styles.emptyState}>
              <View style={[styles.emptyIcon, { backgroundColor: colors.muted }]}>
                <Feather name="users" size={32} color={colors.mutedForeground} />
              </View>
              <Text style={[styles.emptyTitle, { color: colors.foreground }]}>
                No rideshare matches yet
              </Text>
              <Text style={[styles.emptyBody, { color: colors.mutedForeground }]}>
                No one else has registered {isArrival ? "an arrival" : "a departure"} at{" "}
                {myTrip?.airport ?? "this airport"} within an hour of your flight. Check back as
                more families sign up.
              </Text>
              <Pressable
                onPress={handleShare}
                style={({ pressed }) => [
                  styles.inviteBtn,
                  { backgroundColor: colors.primary, opacity: pressed ? 0.85 : 1 },
                ]}
              >
                <Feather name="share-2" size={15} color="#fff" />
                <Text style={styles.inviteBtnText}>Invite teammates</Text>
              </Pressable>
            </View>
          )}
        </ScrollView>
      )}

      {/* FAB — bottom right */}
      <View
        style={[
          styles.fab,
          { bottom: insets.bottom + (Platform.OS === "web" ? 34 : 0) + 20 },
        ]}
      >
        <Pressable
          onPress={() => setSheetVisible(true)}
          style={({ pressed }) => [
            styles.fabBtn,
            {
              backgroundColor: colors.primary,
              opacity: pressed ? 0.8 : 1,
              transform: [{ scale: pressed ? 0.95 : 1 }],
            },
          ]}
        >
          {cancelling ? (
            <ActivityIndicator size="small" color="#fff" />
          ) : (
            <>
              <Feather name="edit-2" size={18} color="#fff" />
              <Text style={styles.fabLabel}>Manage trip</Text>
            </>
          )}
        </Pressable>
      </View>

      {/* Action sheet modal */}
      <Modal
        visible={sheetVisible}
        transparent
        animationType="slide"
        onRequestClose={() => setSheetVisible(false)}
      >
        <Pressable
          style={styles.backdrop}
          onPress={() => setSheetVisible(false)}
        />
        <View
          style={[
            styles.sheet,
            {
              backgroundColor: colors.card,
              paddingBottom: insets.bottom + (Platform.OS === "web" ? 34 : 0) + 8,
            },
          ]}
        >
          <View style={[styles.sheetHandle, { backgroundColor: colors.muted }]} />

          <Text style={[styles.sheetTitle, { color: colors.foreground }]}>
            Manage your trip
          </Text>

          <Pressable
            onPress={handleShare}
            style={({ pressed }) => [
              styles.sheetAction,
              { backgroundColor: pressed ? colors.muted : colors.background, borderRadius: 14 },
            ]}
          >
            <View style={[styles.sheetActionIcon, { backgroundColor: colors.accentSurface }]}>
              <Feather name="share-2" size={18} color={colors.accent} />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={[styles.sheetActionTitle, { color: colors.foreground }]}>
                Invite teammates
              </Text>
              <Text style={[styles.sheetActionSub, { color: colors.mutedForeground }]}>
                Share Rovo with your team
              </Text>
            </View>
            <Feather name="chevron-right" size={18} color={colors.mutedForeground} />
          </Pressable>

          <Pressable
            onPress={handleEditDetails}
            style={({ pressed }) => [
              styles.sheetAction,
              { backgroundColor: pressed ? colors.muted : colors.background, borderRadius: 14 },
            ]}
          >
            <View style={[styles.sheetActionIcon, { backgroundColor: colors.muted }]}>
              <Feather name="map-pin" size={18} color={colors.foreground} />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={[styles.sheetActionTitle, { color: colors.foreground }]}>
                Change airport
              </Text>
              <Text style={[styles.sheetActionSub, { color: colors.mutedForeground }]}>
                Update your {isArrival ? "arrival" : "departure"} airport
              </Text>
            </View>
            <Feather name="chevron-right" size={18} color={colors.mutedForeground} />
          </Pressable>

          <Pressable
            onPress={handleEditDetails}
            style={({ pressed }) => [
              styles.sheetAction,
              { backgroundColor: pressed ? colors.muted : colors.background, borderRadius: 14 },
            ]}
          >
            <View style={[styles.sheetActionIcon, { backgroundColor: colors.muted }]}>
              <Feather name="users" size={18} color={colors.foreground} />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={[styles.sheetActionTitle, { color: colors.foreground }]}>
                Change party size or bags
              </Text>
              <Text style={[styles.sheetActionSub, { color: colors.mutedForeground }]}>
                Update how many people and bags
              </Text>
            </View>
            <Feather name="chevron-right" size={18} color={colors.mutedForeground} />
          </Pressable>

          <View style={[styles.sheetDivider, { backgroundColor: colors.separator }]} />

          <Pressable
            onPress={handleCancelTrip}
            style={({ pressed }) => [
              styles.sheetAction,
              { backgroundColor: pressed ? "#FEF2F2" : colors.background, borderRadius: 14 },
            ]}
          >
            <View style={[styles.sheetActionIcon, { backgroundColor: "#FEF2F2" }]}>
              <Feather name="x-circle" size={18} color={colors.destructive} />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={[styles.sheetActionTitle, { color: colors.destructive }]}>
                Cancel my trip
              </Text>
              <Text style={[styles.sheetActionSub, { color: colors.mutedForeground }]}>
                Remove your trip and stop matching
              </Text>
            </View>
          </Pressable>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  center: { flex: 1, alignItems: "center", justifyContent: "center", gap: 12 },
  header: {
    flexDirection: "row",
    alignItems: "flex-end",
    gap: 12,
    paddingHorizontal: 20,
    paddingBottom: 16,
    borderBottomWidth: 1,
  },
  backBtn: { width: 40, height: 40, alignItems: "center", justifyContent: "center" },
  headerTitle: { fontSize: 22, fontFamily: "Inter_700Bold", letterSpacing: -0.5 },
  headerSub: { fontSize: 13, fontFamily: "Inter_400Regular", marginTop: 1 },

  myTripCard: {
    paddingHorizontal: 20,
    paddingTop: 16,
    paddingBottom: 20,
    borderBottomWidth: 1,
    gap: 12,
  },
  myTripTop: { flexDirection: "row", alignItems: "center" },
  livePill: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 100,
  },
  liveDot: { width: 6, height: 6, borderRadius: 3 },
  liveText: { fontSize: 12, fontFamily: "Inter_600SemiBold" },
  myTripMain: { gap: 10 },
  myTripAirport: {
    fontSize: 48,
    fontFamily: "Inter_700Bold",
    letterSpacing: -2,
    lineHeight: 52,
  },
  myTripDetails: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  myTripBadge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 10,
  },
  myTripBadgeText: { fontSize: 13, fontFamily: "Inter_600SemiBold" },
  myTripHotel: { fontSize: 14, fontFamily: "Inter_400Regular" },

  scroll: { padding: 16, gap: 0 },
  sectionHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 12,
  },
  sectionTitle: { fontSize: 17, fontFamily: "Inter_700Bold", letterSpacing: -0.3 },
  matchLivePill: {
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 100,
  },

  card: {
    borderRadius: 20,
    marginBottom: 12,
    overflow: "hidden",
    boxShadow: "0px 2px 12px rgba(0,0,0,0.07)",
    elevation: 3,
  },
  primaryRow: { flexDirection: "row", alignItems: "center", gap: 12, padding: 16 },
  avatarCircle: {
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: "center",
    justifyContent: "center",
    flexShrink: 0,
  },
  avatarLetter: { fontSize: 18, fontFamily: "Inter_700Bold" },
  headline: { fontSize: 15, fontFamily: "Inter_400Regular", lineHeight: 21 },
  metaRow: { flexDirection: "row", flexWrap: "wrap", gap: 6 },
  metaBadge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 100,
  },
  metaText: { fontSize: 12, fontFamily: "Inter_500Medium" },
  messageBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: "center",
    justifyContent: "center",
    flexShrink: 0,
  },
  secondaryList: { borderTopWidth: 1 },
  secondaryRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  secondaryAvatar: {
    width: 28,
    height: 28,
    borderRadius: 14,
    alignItems: "center",
    justifyContent: "center",
  },
  secondaryAvatarLetter: { fontSize: 12, fontFamily: "Inter_600SemiBold" },
  secondaryName: { fontSize: 14, fontFamily: "Inter_600SemiBold", flex: 1 },
  secondaryTime: { fontSize: 13, fontFamily: "Inter_400Regular" },
  secondaryBadge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 3,
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 100,
  },
  secondaryBadgeText: { fontSize: 11, fontFamily: "Inter_500Medium" },

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
  emptyTitle: { fontSize: 20, fontFamily: "Inter_700Bold", textAlign: "center" },
  emptyBody: {
    fontSize: 14,
    fontFamily: "Inter_400Regular",
    textAlign: "center",
    lineHeight: 22,
  },
  inviteBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    paddingHorizontal: 20,
    paddingVertical: 12,
    borderRadius: 100,
    marginTop: 4,
  },
  inviteBtnText: { fontSize: 14, fontFamily: "Inter_600SemiBold", color: "#fff" },
  inviteNudge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    paddingHorizontal: 16,
    paddingVertical: 14,
    borderRadius: 14,
    borderWidth: 1,
    marginTop: 8,
  },
  inviteNudgeText: { fontSize: 13, fontFamily: "Inter_400Regular", flex: 1, lineHeight: 18 },
  loadingText: { fontSize: 14, fontFamily: "Inter_400Regular" },
  errorBox: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    padding: 14,
    marginBottom: 12,
  },
  errorText: { fontSize: 13, fontFamily: "Inter_400Regular", flex: 1 },

  fab: {
    position: "absolute",
    right: 20,
  },
  fabBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    paddingHorizontal: 20,
    paddingVertical: 14,
    borderRadius: 100,
    boxShadow: "0px 4px 16px rgba(0,0,0,0.2)",
    elevation: 6,
  },
  fabLabel: {
    fontSize: 15,
    fontFamily: "Inter_600SemiBold",
    color: "#fff",
  },

  backdrop: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.4)",
  },
  sheet: {
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    paddingHorizontal: 16,
    paddingTop: 12,
    gap: 6,
  },
  sheetHandle: {
    width: 36,
    height: 4,
    borderRadius: 2,
    alignSelf: "center",
    marginBottom: 8,
  },
  sheetTitle: {
    fontSize: 17,
    fontFamily: "Inter_700Bold",
    paddingHorizontal: 4,
    marginBottom: 6,
  },
  sheetAction: {
    flexDirection: "row",
    alignItems: "center",
    gap: 14,
    padding: 14,
  },
  sheetActionIcon: {
    width: 40,
    height: 40,
    borderRadius: 12,
    alignItems: "center",
    justifyContent: "center",
  },
  sheetActionTitle: {
    fontSize: 15,
    fontFamily: "Inter_600SemiBold",
  },
  sheetActionSub: {
    fontSize: 12,
    fontFamily: "Inter_400Regular",
    marginTop: 1,
  },
  sheetDivider: {
    height: 1,
    marginVertical: 4,
    marginHorizontal: 4,
  },
});
