import AsyncStorage from "@react-native-async-storage/async-storage";
import { Feather } from "@expo/vector-icons";
import * as Clipboard from "expo-clipboard";
import { router, useLocalSearchParams } from "expo-router";
import React, { useEffect, useMemo, useState } from "react";
import {
  ActivityIndicator,
  Platform,
  Pressable,
  ScrollView,
  Share,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { TripShareCard } from "@/components/TripShareCard";
import { useAuth } from "@/context/AuthContext";
import { Tournament, useTrip } from "@/context/TripContext";
import { useColors } from "@/hooks/useColors";
import {
  buildTripShareDetailsFromRecord,
  buildTripShareMessage,
  buildTripShortUrl,
  fetchTripShare,
  getFamilyName,
  PENDING_JOIN_SHARE_KEY,
  TripShareDetails,
  TripShareRecord,
} from "@/utils/tripShare";

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

export default function SharedTripScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const { user } = useAuth();
  const { setSelectedTournament } = useTrip();
  const { shareId } = useLocalSearchParams<{ shareId: string }>();
  const [record, setRecord] = useState<TripShareRecord | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    let cancelled = false;
    if (!shareId) return;
    setLoading(true);
    setError("");
    fetchTripShare(shareId)
      .then((data) => {
        if (!cancelled) setRecord(data);
      })
      .catch(() => {
        if (!cancelled) setError("This trip card could not be found.");
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [shareId]);

  const details = useMemo<TripShareDetails | null>(
    () => (record ? buildTripShareDetailsFromRecord(record) : null),
    [record],
  );
  const shareUrl = shareId ? buildTripShortUrl(shareId) : "";
  const familyName = details ? getFamilyName(details.userName) : "this family";

  const beginJoin = async () => {
    if (!shareId || !details || !record?.trip) return;
    if (!user) {
      await AsyncStorage.setItem(PENDING_JOIN_SHARE_KEY, shareId);
      router.push("/login");
      return;
    }
    const tournament = tournamentFromRecord(record);
    if (tournament) setSelectedTournament(tournament);
    router.push({
      pathname: "/travel-info",
      params: {
        joinShareId: shareId,
        joinTargetTripId: record.trip.id,
        joinFamilyName: familyName,
        joinHotel: details.hotel,
        prefillMode: details.mode,
        prefillAirport: details.airport,
        prefillHotel: details.hotel,
        prefillHotelPlaceId: details.hotelPlaceId ?? "",
        prefillDatetime: details.datetime,
      },
    });
  };

  const seeOtherMatches = async () => {
    if (!shareId) return;
    if (!user) {
      await AsyncStorage.setItem(PENDING_JOIN_SHARE_KEY, shareId);
      router.push("/login");
      return;
    }
    router.push(`/share-matches?shareId=${encodeURIComponent(shareId)}`);
  };

  const forwardCard = async () => {
    if (!details) return;
    try {
      await Share.share({
        title: "Rovo Travel Info Card",
        message: buildTripShareMessage(details, shareUrl),
      });
    } catch {
      // dismissed
    }
  };

  const copyLink = async () => {
    if (!shareUrl) return;
    await Clipboard.setStringAsync(shareUrl);
    setCopied(true);
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
        <Pressable onPress={() => router.replace("/")} style={styles.backBtn}>
          <Feather name="arrow-left" size={22} color={colors.foreground} />
        </Pressable>
        <View style={{ flex: 1 }}>
          <Text style={[styles.headerTitle, { color: colors.foreground }]}>
            Travel info card
          </Text>
          <Text style={[styles.headerSub, { color: colors.mutedForeground }]}>
            Rovo rideshare
          </Text>
        </View>
      </View>

      {loading ? (
        <View style={styles.center}>
          <ActivityIndicator color={colors.primary} size="large" />
          <Text style={[styles.centerText, { color: colors.mutedForeground }]}>
            Loading trip card...
          </Text>
        </View>
      ) : error || !record ? (
        <View style={styles.center}>
          <Feather name="alert-circle" size={34} color={colors.destructive} />
          <Text style={[styles.centerTitle, { color: colors.foreground }]}>
            Card unavailable
          </Text>
          <Text style={[styles.centerText, { color: colors.mutedForeground }]}>
            {error || "This trip card could not be found."}
          </Text>
        </View>
      ) : !details ? (
        <View style={styles.center}>
          <Feather name="x-circle" size={34} color={colors.mutedForeground} />
          <Text style={[styles.centerTitle, { color: colors.foreground }]}>
            Trip no longer active
          </Text>
          <Text style={[styles.centerText, { color: colors.mutedForeground }]}>
            This family has edited or cancelled the trip behind this card.
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
          <TripShareCard details={details} shareUrl={shareUrl} />

          <View
            style={[
              styles.joinNotice,
              { backgroundColor: colors.accentSurface, borderColor: colors.accentBorder },
            ]}
          >
            <Feather name="info" size={17} color={colors.accent} />
            <Text style={[styles.joinNoticeText, { color: colors.foreground }]}>
              You're joining {familyName}'s trip to {details.hotel}. Enter your own
              travel details next, then message the family to confirm.
            </Text>
          </View>

          <Pressable
            onPress={beginJoin}
            style={({ pressed }) => [
              styles.primaryBtn,
              { backgroundColor: colors.primary, opacity: pressed ? 0.86 : 1 },
            ]}
          >
            <Text style={[styles.primaryBtnText, { color: colors.primaryForeground }]}>
              Join this ride
            </Text>
          </Pressable>

          <Pressable
            onPress={seeOtherMatches}
            style={({ pressed }) => [
              styles.secondaryBtn,
              {
                backgroundColor: colors.card,
                borderColor: colors.separator,
                opacity: pressed ? 0.82 : 1,
              },
            ]}
          >
            <Feather name="users" size={17} color={colors.foreground} />
            <Text style={[styles.secondaryBtnText, { color: colors.foreground }]}>
              See other matches
            </Text>
          </Pressable>

          <View style={styles.utilityRow}>
            <Pressable
              onPress={forwardCard}
              style={[styles.utilityBtn, { backgroundColor: colors.muted }]}
            >
              <Feather name="share-2" size={15} color={colors.foreground} />
              <Text style={[styles.utilityText, { color: colors.foreground }]}>
                Forward
              </Text>
            </Pressable>
            <Pressable
              onPress={copyLink}
              style={[styles.utilityBtn, { backgroundColor: colors.muted }]}
            >
              <Feather
                name={copied ? "check" : "link"}
                size={15}
                color={copied ? colors.accent : colors.foreground}
              />
              <Text
                style={[
                  styles.utilityText,
                  { color: copied ? colors.accent : colors.foreground },
                ]}
              >
                {copied ? "Copied" : "Copy link"}
              </Text>
            </Pressable>
          </View>
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
  centerTitle: {
    fontSize: 20,
    fontFamily: "Inter_700Bold",
    textAlign: "center",
  },
  centerText: {
    fontSize: 14,
    fontFamily: "Inter_400Regular",
    textAlign: "center",
    lineHeight: 21,
  },
  scroll: {
    padding: 16,
    gap: 14,
  },
  joinNotice: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 10,
    padding: 14,
    borderRadius: 16,
    borderWidth: 1,
  },
  joinNoticeText: {
    flex: 1,
    fontSize: 13,
    fontFamily: "Inter_500Medium",
    lineHeight: 19,
  },
  primaryBtn: {
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 15,
    borderRadius: 18,
  },
  primaryBtnText: {
    fontSize: 16,
    fontFamily: "Inter_700Bold",
  },
  secondaryBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 9,
    paddingVertical: 14,
    borderRadius: 18,
    borderWidth: 1,
  },
  secondaryBtnText: {
    fontSize: 15,
    fontFamily: "Inter_700Bold",
  },
  utilityRow: {
    flexDirection: "row",
    gap: 10,
  },
  utilityBtn: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 7,
    paddingVertical: 12,
    borderRadius: 14,
  },
  utilityText: {
    fontSize: 13,
    fontFamily: "Inter_700Bold",
  },
});
