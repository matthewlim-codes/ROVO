import { Feather } from "@expo/vector-icons";
import { router, useLocalSearchParams } from "expo-router";
import React, { useMemo, useState } from "react";
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
import { useColors } from "@/hooks/useColors";
import {
  buildTripShareMessage,
  buildTripShareUrl,
  TripShareDetails,
} from "@/utils/tripShare";

function getParam(value: string | string[] | undefined): string | undefined {
  return Array.isArray(value) ? value[0] : value;
}

function getPositiveNumber(value: string | string[] | undefined): number | undefined {
  const raw = getParam(value);
  if (!raw) return undefined;
  const parsed = Number.parseInt(raw, 10);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : undefined;
}

export default function SharedTripCardScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const params = useLocalSearchParams<{
    name?: string;
    team?: string;
    tournament?: string;
    location?: string;
    airport?: string;
    hotel?: string;
    datetime?: string;
    mode?: string;
    partySize?: string;
    baggageCount?: string;
  }>();
  const [sharing, setSharing] = useState(false);

  const details: TripShareDetails = useMemo(() => {
    const mode = getParam(params.mode) === "departure" ? "departure" : "arrival";
    const datetime = getParam(params.datetime);

    return {
      userName: getParam(params.name) || "A Rovo parent",
      userTeam: getParam(params.team),
      tournamentName: getParam(params.tournament) || "Tournament rideshare",
      tournamentLocation: getParam(params.location),
      airport: getParam(params.airport) || "the airport",
      hotel: getParam(params.hotel) || "the hotel",
      datetime:
        datetime && !Number.isNaN(new Date(datetime).getTime())
          ? datetime
          : new Date().toISOString(),
      mode,
      partySize: getPositiveNumber(params.partySize),
      baggageCount: getPositiveNumber(params.baggageCount),
    };
  }, [
    params.airport,
    params.baggageCount,
    params.datetime,
    params.hotel,
    params.location,
    params.mode,
    params.name,
    params.partySize,
    params.team,
    params.tournament,
  ]);

  const shareUrl = useMemo(() => buildTripShareUrl(details), [details]);

  const handleShare = async () => {
    setSharing(true);
    try {
      await Share.share({
        title: "Rovo trip card",
        message: buildTripShareMessage(details, shareUrl),
        url: shareUrl,
      });
    } catch {
      // dismissed
    } finally {
      setSharing(false);
    }
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
            Shared trip card
          </Text>
          <Text style={[styles.headerSub, { color: colors.mutedForeground }]}>
            Rovo rideshare
          </Text>
        </View>
      </View>

      <ScrollView
        contentContainerStyle={[
          styles.scroll,
          {
            paddingBottom:
              insets.bottom + (Platform.OS === "web" ? 34 : 0) + 32,
          },
        ]}
        showsVerticalScrollIndicator={false}
      >
        <TripShareCard details={details} shareUrl={shareUrl} />

        <View style={styles.actions}>
          <Pressable
            onPress={() => router.push("/")}
            style={({ pressed }) => [
              styles.primaryBtn,
              {
                backgroundColor: colors.primary,
                opacity: pressed ? 0.85 : 1,
              },
            ]}
          >
            <Feather name="plus-circle" size={18} color={colors.primaryForeground} />
            <Text
              style={[styles.primaryBtnText, { color: colors.primaryForeground }]}
            >
              Add my trip in Rovo
            </Text>
          </Pressable>

          <Pressable
            onPress={handleShare}
            disabled={sharing}
            style={({ pressed }) => [
              styles.secondaryBtn,
              {
                backgroundColor: colors.card,
                borderColor: colors.separator,
                opacity: pressed || sharing ? 0.8 : 1,
              },
            ]}
          >
            {sharing ? (
              <ActivityIndicator color={colors.foreground} />
            ) : (
              <>
                <Feather name="share-2" size={17} color={colors.foreground} />
                <Text style={[styles.secondaryBtnText, { color: colors.foreground }]}>
                  Forward this card
                </Text>
              </>
            )}
          </Pressable>
        </View>
      </ScrollView>
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
  scroll: {
    padding: 16,
    gap: 16,
  },
  actions: {
    gap: 10,
  },
  primaryBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 10,
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
    gap: 10,
    paddingVertical: 14,
    borderRadius: 18,
    borderWidth: 1,
  },
  secondaryBtnText: {
    fontSize: 15,
    fontFamily: "Inter_600SemiBold",
  },
});
