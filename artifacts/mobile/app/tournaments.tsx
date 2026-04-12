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
            backgroundColor: colors.navy,
            paddingTop: insets.top + (Platform.OS === "web" ? 67 : 0),
          },
        ]}
      >
        <View>
          <Text style={styles.headerGreeting}>
            Hey, {user?.name?.split(" ")[0]}
          </Text>
          <Text style={styles.headerTitle}>Select Tournament</Text>
        </View>
        <Pressable
          onPress={logout}
          style={[styles.logoutBtn, { backgroundColor: "rgba(255,255,255,0.15)" }]}
        >
          <Feather name="log-out" size={18} color="#fff" />
        </Pressable>
      </View>

      <View
        style={[
          styles.clubBadge,
          { backgroundColor: colors.accent, borderColor: colors.orange },
        ]}
      >
        <Feather name="shield" size={14} color={colors.orange} />
        <Text style={[styles.clubBadgeText, { color: colors.orange }]}>
          {user?.club} — {user?.team}
        </Text>
      </View>

      <FlatList
        data={tournaments}
        keyExtractor={(item) => item.id}
        contentContainerStyle={[
          styles.list,
          { paddingBottom: insets.bottom + (Platform.OS === "web" ? 34 : 0) + 20 },
        ]}
        showsVerticalScrollIndicator={false}
        renderItem={({ item }) => (
          <Pressable
            onPress={() => handleSelect(item)}
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
            <View style={styles.cardHeader}>
              <View
                style={[
                  styles.tournamentIcon,
                  { backgroundColor: colors.accent },
                ]}
              >
                <Feather name="award" size={24} color={colors.orange} />
              </View>
              <Feather name="chevron-right" size={20} color={colors.mutedForeground} />
            </View>

            <Text style={[styles.tournamentName, { color: colors.foreground }]}>
              {item.name}
            </Text>

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

            <Text
              style={[styles.description, { color: colors.mutedForeground }]}
              numberOfLines={2}
            >
              {item.description}
            </Text>

            <View
              style={[
                styles.selectBtn,
                {
                  backgroundColor: colors.primary,
                  borderRadius: colors.radius - 4,
                },
              ]}
            >
              <Text
                style={[styles.selectBtnText, { color: colors.primaryForeground }]}
              >
                Select Tournament
              </Text>
            </View>
          </Pressable>
        )}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  header: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-end",
    paddingHorizontal: 20,
    paddingBottom: 20,
  },
  headerGreeting: {
    fontSize: 14,
    fontFamily: "Inter_400Regular",
    color: "rgba(255,255,255,0.7)",
  },
  headerTitle: {
    fontSize: 24,
    fontFamily: "Inter_700Bold",
    color: "#ffffff",
    marginTop: 2,
  },
  logoutBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: "center",
    justifyContent: "center",
  },
  clubBadge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    marginHorizontal: 16,
    marginTop: 12,
    marginBottom: 4,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 100,
    borderWidth: 1,
    alignSelf: "flex-start",
  },
  clubBadgeText: {
    fontSize: 12,
    fontFamily: "Inter_600SemiBold",
  },
  list: {
    padding: 16,
    gap: 12,
  },
  card: {
    padding: 20,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08,
    shadowRadius: 8,
    elevation: 3,
    gap: 10,
    marginBottom: 12,
  },
  cardHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  tournamentIcon: {
    width: 48,
    height: 48,
    borderRadius: 12,
    alignItems: "center",
    justifyContent: "center",
  },
  tournamentName: {
    fontSize: 20,
    fontFamily: "Inter_700Bold",
  },
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
  description: {
    fontSize: 13,
    fontFamily: "Inter_400Regular",
    lineHeight: 19,
  },
  selectBtn: {
    height: 44,
    alignItems: "center",
    justifyContent: "center",
    marginTop: 4,
  },
  selectBtnText: {
    fontSize: 15,
    fontFamily: "Inter_600SemiBold",
  },
});
