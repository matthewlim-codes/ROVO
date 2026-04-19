import { Feather } from "@expo/vector-icons";
import { Image } from "expo-image";
import * as ImagePicker from "expo-image-picker";
import { router } from "expo-router";
import React, { useState } from "react";
import {
  Alert,
  FlatList,
  Modal,
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
  const { tournaments, setSelectedTournament, setTournamentImage } = useTrip();
  const [confirmLogout, setConfirmLogout] = useState(false);

  const handleSelect = (t: Tournament) => {
    setSelectedTournament(t);
    router.push("/travel-info");
  };

  const handlePickImage = async (tournamentId: string) => {
    try {
      const perm = await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (!perm.granted) {
        Alert.alert(
          "Permission needed",
          "Please allow photo access to add a tournament image."
        );
        return;
      }
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.Images,
        allowsEditing: true,
        aspect: [16, 9],
        quality: 0.8,
      });
      if (!result.canceled && result.assets[0]?.uri) {
        await setTournamentImage(tournamentId, result.assets[0].uri);
      }
    } catch (e) {
      Alert.alert("Could not add image", String(e));
    }
  };

  const handleLogoutPress = () => {
    if (Platform.OS === "web") {
      setConfirmLogout(true);
    } else {
      Alert.alert(
        "Log out",
        "Are you sure you want to log out?",
        [
          { text: "No", style: "cancel" },
          {
            text: "Yes",
            style: "destructive",
            onPress: async () => {
              await logout();
              router.replace("/login");
            },
          },
        ],
        { cancelable: true }
      );
    }
  };

  const confirmLogoutYes = async () => {
    setConfirmLogout(false);
    await logout();
    router.replace("/login");
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
        <View style={styles.headerLeft}>
          <Text style={[styles.greeting, { color: colors.mutedForeground }]}>
            Good to see you, {user?.name?.split(" ")[0]}
          </Text>
          <Text style={[styles.headerTitle, { color: colors.foreground }]}>
            Tournaments
          </Text>
        </View>
        <View style={styles.headerActions}>
          <Pressable
            onPress={() => router.push("/edit-profile")}
            style={[
              styles.editProfileBtn,
              {
                backgroundColor: colors.muted,
                borderColor: colors.separator,
              },
            ]}
          >
            <Feather name="user" size={14} color={colors.foreground} />
            <Text
              style={[styles.editProfileText, { color: colors.foreground }]}
            >
              Edit profile
            </Text>
          </Pressable>
          <Pressable onPress={handleLogoutPress} style={styles.logoutBtn}>
            <Feather name="log-out" size={20} color={colors.mutedForeground} />
          </Pressable>
        </View>
      </View>

      <View
        style={[
          styles.clubStrip,
          {
            backgroundColor: colors.accentSurface,
            borderColor: colors.accentBorder,
          },
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
        renderItem={({ item }) => (
          <TournamentCard
            item={item}
            onPress={() => handleSelect(item)}
            onPickImage={() => handlePickImage(item.id)}
          />
        )}
      />

      <Modal
        visible={confirmLogout}
        transparent
        animationType="fade"
        onRequestClose={() => setConfirmLogout(false)}
      >
        <Pressable
          style={styles.modalBackdrop}
          onPress={() => setConfirmLogout(false)}
        >
          <Pressable
            style={[styles.modalCard, { backgroundColor: colors.card }]}
            onPress={(e) => e.stopPropagation()}
          >
            <Text style={[styles.modalTitle, { color: colors.foreground }]}>
              Log out?
            </Text>
            <Text
              style={[styles.modalBody, { color: colors.mutedForeground }]}
            >
              Are you sure you want to log out?
            </Text>
            <View style={styles.modalActions}>
              <Pressable
                onPress={() => setConfirmLogout(false)}
                style={[
                  styles.modalBtn,
                  {
                    backgroundColor: colors.muted,
                  },
                ]}
              >
                <Text
                  style={[styles.modalBtnText, { color: colors.foreground }]}
                >
                  No
                </Text>
              </Pressable>
              <Pressable
                onPress={confirmLogoutYes}
                style={[
                  styles.modalBtn,
                  { backgroundColor: colors.primary },
                ]}
              >
                <Text style={[styles.modalBtnText, { color: "#fff" }]}>
                  Yes
                </Text>
              </Pressable>
            </View>
          </Pressable>
        </Pressable>
      </Modal>
    </View>
  );
}

function TournamentCard({
  item,
  onPress,
  onPickImage,
}: {
  item: Tournament;
  onPress: () => void;
  onPickImage: () => void;
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
      <Pressable
        onPress={onPickImage}
        style={[
          styles.imageWrap,
          {
            backgroundColor: colors.muted,
            borderColor: colors.separator,
          },
        ]}
      >
        {item.imageUri ? (
          <>
            <Image
              source={{ uri: item.imageUri }}
              style={styles.image}
              contentFit="cover"
            />
            <View style={styles.imageEditBadge}>
              <Feather name="edit-2" size={12} color="#fff" />
            </View>
          </>
        ) : (
          <View style={styles.imagePlaceholder}>
            <Feather name="image" size={28} color={colors.mutedForeground} />
            <Text
              style={[
                styles.imagePlaceholderText,
                { color: colors.mutedForeground },
              ]}
            >
              Tap to add a tournament image
            </Text>
          </View>
        )}
      </Pressable>

      <View style={styles.cardContent}>
        <View style={styles.cardTop}>
          <View
            style={[
              styles.tournamentEmoji,
              { backgroundColor: colors.muted },
            ]}
          >
            <Feather name="award" size={22} color={colors.foreground} />
          </View>
          <Feather
            name="chevron-right"
            size={20}
            color={colors.mutedForeground}
          />
        </View>

        <Text style={[styles.tournamentName, { color: colors.foreground }]}>
          {item.name}
        </Text>

        <View style={styles.metaGroup}>
          <View style={styles.metaRow}>
            <Feather
              name="map-pin"
              size={13}
              color={colors.mutedForeground}
            />
            <Text
              style={[styles.metaText, { color: colors.mutedForeground }]}
              numberOfLines={1}
            >
              {item.location}
            </Text>
          </View>
          <View style={styles.metaRow}>
            <Feather
              name="calendar"
              size={13}
              color={colors.mutedForeground}
            />
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
    gap: 12,
  },
  headerLeft: { flexShrink: 1 },
  headerActions: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
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
  editProfileBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 100,
    borderWidth: 1,
  },
  editProfileText: {
    fontSize: 12,
    fontFamily: "Inter_600SemiBold",
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
    boxShadow: "0px 2px 10px rgba(0,0,0,0.06)",
    elevation: 2,
    marginBottom: 12,
    overflow: "hidden",
  },
  imageWrap: {
    width: "100%",
    aspectRatio: 16 / 9,
    borderBottomWidth: 1,
    alignItems: "center",
    justifyContent: "center",
    overflow: "hidden",
  },
  image: {
    width: "100%",
    height: "100%",
  },
  imageEditBadge: {
    position: "absolute",
    top: 10,
    right: 10,
    backgroundColor: "rgba(0,0,0,0.55)",
    width: 28,
    height: 28,
    borderRadius: 14,
    alignItems: "center",
    justifyContent: "center",
  },
  imagePlaceholder: {
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
  },
  imagePlaceholderText: {
    fontSize: 12,
    fontFamily: "Inter_500Medium",
  },
  cardContent: {
    padding: 20,
    gap: 12,
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
  modalBackdrop: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.45)",
    alignItems: "center",
    justifyContent: "center",
    padding: 24,
  },
  modalCard: {
    width: "100%",
    maxWidth: 360,
    borderRadius: 20,
    padding: 22,
    gap: 8,
  },
  modalTitle: {
    fontSize: 18,
    fontFamily: "Inter_700Bold",
  },
  modalBody: {
    fontSize: 14,
    fontFamily: "Inter_400Regular",
    marginBottom: 12,
  },
  modalActions: {
    flexDirection: "row",
    gap: 10,
  },
  modalBtn: {
    flex: 1,
    paddingVertical: 12,
    borderRadius: 100,
    alignItems: "center",
  },
  modalBtnText: {
    fontSize: 15,
    fontFamily: "Inter_600SemiBold",
  },
});
