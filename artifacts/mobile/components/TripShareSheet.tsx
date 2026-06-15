import { Feather } from "@expo/vector-icons";
import React, { useMemo } from "react";
import {
  ActivityIndicator,
  Modal,
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
import type { Tournament, Trip } from "@/context/TripContext";
import { useColors } from "@/hooks/useColors";
import {
  buildTripShareDetails,
  buildTripShareMessage,
  buildTripShareUrl,
} from "@/utils/tripShare";

interface TripShareSheetProps {
  visible: boolean;
  trip: Trip | null | undefined;
  tournament: Tournament | null | undefined;
  onClose: () => void;
}

export function TripShareSheet({
  visible,
  trip,
  tournament,
  onClose,
}: TripShareSheetProps) {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const [sharing, setSharing] = React.useState(false);

  const sharePayload = useMemo(() => {
    if (!trip) return null;
    const details = buildTripShareDetails(trip, tournament);
    const shareUrl = buildTripShareUrl(details);
    return {
      details,
      shareUrl,
      message: buildTripShareMessage(details, shareUrl),
    };
  }, [trip, tournament]);

  const handleShare = async () => {
    if (!sharePayload) return;
    setSharing(true);
    try {
      await Share.share({
        title: "Rovo trip card",
        message: sharePayload.message,
        url: sharePayload.shareUrl,
      });
      onClose();
    } catch {
      // The native share sheet throws when dismissed on some platforms.
    } finally {
      setSharing(false);
    }
  };

  return (
    <Modal
      visible={visible}
      transparent
      animationType="slide"
      onRequestClose={onClose}
    >
      <Pressable style={styles.backdrop} onPress={onClose} />
      <View
        style={[
          styles.sheet,
          {
            backgroundColor: colors.background,
            paddingBottom: insets.bottom + (Platform.OS === "web" ? 34 : 0) + 12,
          },
        ]}
      >
        <View style={[styles.sheetHandle, { backgroundColor: colors.muted }]} />
        <View style={styles.headerRow}>
          <View style={{ flex: 1 }}>
            <Text style={[styles.title, { color: colors.foreground }]}>
              Share your trip card
            </Text>
            <Text style={[styles.subtitle, { color: colors.mutedForeground }]}>
              Parents can scan the QR or forward the link in seconds.
            </Text>
          </View>
          <Pressable
            onPress={onClose}
            style={[styles.closeBtn, { backgroundColor: colors.muted }]}
          >
            <Feather name="x" size={18} color={colors.foreground} />
          </Pressable>
        </View>

        <ScrollView
          contentContainerStyle={styles.content}
          showsVerticalScrollIndicator={false}
        >
          {sharePayload ? (
            <TripShareCard
              details={sharePayload.details}
              shareUrl={sharePayload.shareUrl}
            />
          ) : (
            <View style={styles.loadingCard}>
              <ActivityIndicator color={colors.primary} />
            </View>
          )}
        </ScrollView>

        <Pressable
          onPress={handleShare}
          disabled={!sharePayload || sharing}
          style={({ pressed }) => [
            styles.shareBtn,
            {
              backgroundColor: colors.primary,
              opacity: pressed || sharing || !sharePayload ? 0.82 : 1,
            },
          ]}
        >
          {sharing ? (
            <ActivityIndicator color={colors.primaryForeground} />
          ) : (
            <>
              <Feather name="share-2" size={18} color={colors.primaryForeground} />
              <Text
                style={[
                  styles.shareBtnText,
                  { color: colors.primaryForeground },
                ]}
              >
                Share card
              </Text>
            </>
          )}
        </Pressable>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: "rgba(15,23,42,0.5)",
  },
  sheet: {
    maxHeight: "88%",
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
    paddingHorizontal: 16,
    paddingTop: 12,
  },
  sheetHandle: {
    width: 38,
    height: 4,
    borderRadius: 2,
    alignSelf: "center",
    marginBottom: 14,
  },
  headerRow: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 12,
    paddingHorizontal: 2,
    marginBottom: 14,
  },
  title: {
    fontSize: 22,
    fontFamily: "Inter_700Bold",
    letterSpacing: -0.5,
  },
  subtitle: {
    fontSize: 13,
    fontFamily: "Inter_400Regular",
    lineHeight: 19,
    marginTop: 3,
  },
  closeBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: "center",
    justifyContent: "center",
  },
  content: {
    paddingBottom: 14,
  },
  loadingCard: {
    minHeight: 240,
    alignItems: "center",
    justifyContent: "center",
  },
  shareBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 10,
    paddingVertical: 15,
    borderRadius: 18,
  },
  shareBtnText: {
    fontSize: 16,
    fontFamily: "Inter_700Bold",
  },
});
