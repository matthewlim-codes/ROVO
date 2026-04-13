import { Feather } from "@expo/vector-icons";
import { router } from "expo-router";
import React from "react";
import {
  FlatList,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { useAuth } from "@/context/AuthContext";
import { Tournament, useTrip } from "@/context/TripContext";
import { useColors } from "@/hooks/useColors";

export default function TournamentsScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const { user, logout } = useAuth();
  const { tournaments, setSelectedTournament } = useTrip();

  const handleSelect = (t: Tournament) => {
    setSelectedTournament(t);
    router.push("/travel-info");
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
        <View>
          <Text style={[styles.greeting, { color: colors.mutedForeground }]}>
            Good to see you, {user?.name?.split(" ")[0]}
          </Text>
          <Text style={[styles.headerTitle, { color: colors.foreground }]}>
            Tournaments
          </Text>
        </View>
        <Pressable onPress={logout} style={styles.logoutBtn}>
          <Feather name="log-out" size={20} color={colors.mutedForeground} />
        </Pressable>
      </View>

      <View
        style={[
          styles.clubStrip,
          { backgroundColor: colors.accentSurface, borderColor: colors.accentBorder },
        ]}
      >
        <View style={[styles.clubDot, { backgroundColor: colors.accent }]} />
        <Text style={[styles.clubText, { color: colors.accent }]}>
          {user?.club} · {user?.team}
        </Text>
      </View>

      <FlatList
        data={tournaments}
        keyExtractor={(item) => item.id}
        contentContainerStyle={[
          styles.list,
          {
            paddingBottom:
              insets.bottom + (Platform.OS === "web" ? 34 : 0) + 20,
          },
        ]}
        showsVerticalScrollIndicator={false}
        renderItem={({ item }) => <TournamentCard item={item} onPress={() => handleSelect(item)} />}
      />
    </View>
  );
}

function TournamentCard({
  item,
  onPress,
}: {
  item: Tournament;
  onPress: () => void;
}) {
  const colors = useColors();
  return (
    <Pressable
      onPress={onPress}
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
      <View style={styles.cardTop}>
        <View
          style={[styles.tournamentEmoji, { backgroundColor: colors.muted }]}
        >
          <Feather name="award" size={22} color={colors.foreground} />
        </View>
        <Feather name="chevron-right" size={20} color={colors.mutedForeground} />
      </View>

      <Text style={[styles.tournamentName, { color: colors.foreground }]}>
        {item.name}
      </Text>

      <View style={styles.metaGroup}>
        <View style={styles.metaRow}>
          <Feather name="map-pin" size={13} color={colors.mutedForeground} />
          <Text
            style={[styles.metaText, { color: colors.mutedForeground }]}
            numberOfLines={1}
          >
            {item.location}
          </Text>
        </View>
        <View style={styles.metaRow}>
          <Feather name="calendar" size={13} color={colors.mutedForeground} />
          <Text style={[styles.metaText, { color: colors.mutedForeground }]}>
            {item.dates}
          </Text>
        </View>
      </View>

      <View
        style={[
          styles.selectPill,
          { backgroundColor: colors.primary, borderRadius: 100 },
        ]}
      >
        <Text style={[styles.selectPillText, { color: "#fff" }]}>
          Select tournament
        </Text>
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  header: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-end",
    paddingHorizontal: 20,
    paddingBottom: 16,
    borderBottomWidth: 1,
  },
  greeting: {
    fontSize: 13,
    fontFamily: "Inter_400Regular",
  },
  headerTitle: {
    fontSize: 26,
    fontFamily: "Inter_700Bold",
    letterSpacing: -0.6,
    marginTop: 2,
  },
  logoutBtn: {
    width: 40,
    height: 40,
    alignItems: "center",
    justifyContent: "center",
  },
  clubStrip: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    marginHorizontal: 16,
    marginTop: 12,
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 12,
    borderWidth: 1,
  },
  clubDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  clubText: {
    fontSize: 13,
    fontFamily: "Inter_600SemiBold",
  },
  list: {
    padding: 16,
    gap: 12,
  },
  card: {
    padding: 20,
    boxShadow: "0px 2px 10px rgba(0,0,0,0.06)",
    elevation: 2,
    gap: 12,
    marginBottom: 12,
  },
  cardTop: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  tournamentEmoji: {
    width: 44,
    height: 44,
    borderRadius: 12,
    alignItems: "center",
    justifyContent: "center",
  },
  tournamentName: {
    fontSize: 20,
    fontFamily: "Inter_700Bold",
    letterSpacing: -0.3,
  },
  metaGroup: { gap: 6 },
  metaRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
  },
  metaText: {
    fontSize: 13,
    fontFamily: "Inter_400Regular",
    flex: 1,
  },
  selectPill: {
    alignSelf: "flex-start",
    paddingHorizontal: 16,
    paddingVertical: 9,
    marginTop: 4,
  },
  selectPillText: {
    fontSize: 14,
    fontFamily: "Inter_600SemiBold",
  },
});
