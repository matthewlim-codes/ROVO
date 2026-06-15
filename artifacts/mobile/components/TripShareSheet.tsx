import { Feather } from "@expo/vector-icons";
import * as Clipboard from "expo-clipboard";
import * as Sharing from "expo-sharing";
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
import { captureRef } from "react-native-view-shot";

import { TripShareCard } from "@/components/TripShareCard";
import type { Tournament, Trip } from "@/context/TripContext";
import { useColors } from "@/hooks/useColors";
import {
  buildTripShareDetails,
  buildTripShareMessage,
  buildTripShortUrl,
  createTripShare,
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
  const [shareId, setShareId] = React.useState<string | null>(null);
  const [shareError, setShareError] = React.useState("");
  const [copied, setCopied] = React.useState(false);
  const cardRef = React.useRef<View>(null);

  const sharePayload = useMemo(() => {
    if (!trip || !shareId) return null;
    const details = buildTripShareDetails(trip, tournament, shareId);
    const shareUrl = buildTripShortUrl(shareId);
    return {
      details,
      shareUrl,
      message: buildTripShareMessage(details, shareUrl),
    };
  }, [shareId, trip, tournament]);

  React.useEffect(() => {
    let cancelled = false;
    if (!visible || !trip) return;

    setShareError("");
    setCopied(false);
    setShareId(null);

    createTripShare(trip.id)
      .then((share) => {
        if (!cancelled) setShareId(share.id);
      })
      .catch(() => {
        if (!cancelled) {
          setShareError("Could not create a share link. Try again in a moment.");
        }
      });

    return () => {
      cancelled = true;
    };
  }, [trip?.id, visible]);

  const handleShare = async () => {
    if (!sharePayload) return;
    setSharing(true);
    try {
      if (Platform.OS !== "web" && cardRef.current) {
        try {
          const imageUri = await captureRef(cardRef.current, {
            format: "png",
            quality: 1,
          });
          await Share.share({
            title: "Rovo Travel Info Card",
            message: sharePayload.message,
            url: imageUri,
          });
          onClose();
          return;
        } catch {
          const canShareFile = await Sharing.isAvailableAsync().catch(() => false);
          if (canShareFile && cardRef.current) {
            const imageUri = await captureRef(cardRef.current, {
              format: "png",
              quality: 1,
            });
            await Sharing.shareAsync(imageUri, {
              dialogTitle: "Share Rovo trip card",
              mimeType: "image/png",
              UTI: "public.png",
            });
            await Clipboard.setStringAsync(sharePayload.shareUrl);
            setCopied(true);
            onClose();
            return;
          }
        }
      }

      await Share.share({ title: "Rovo Travel Info Card", message: sharePayload.message });
      onClose();
    } catch {
      // The native share sheet throws when dismissed on some platforms.
    } finally {
      setSharing(false);
    }
  };

  const handleCopy = async () => {
    if (!sharePayload) return;
    await Clipboard.setStringAsync(sharePayload.shareUrl);
    setCopied(true);
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
              ref={cardRef}
              details={sharePayload.details}
              shareUrl={sharePayload.shareUrl}
            />
          ) : (
            <View style={styles.loadingCard}>
              {shareError ? (
                <>
                  <Feather name="alert-circle" size={24} color={colors.destructive} />
                  <Text style={[styles.errorText, { color: colors.destructive }]}>
                    {shareError}
                  </Text>
                </>
              ) : (
                <>
                  <ActivityIndicator color={colors.primary} />
                  <Text style={[styles.loadingText, { color: colors.mutedForeground }]}>
                    Creating secure short link...
                  </Text>
                </>
              )}
            </View>
          )}
        </ScrollView>

        <Pressable
          onPress={handleCopy}
          disabled={!sharePayload}
          style={({ pressed }) => [
            styles.copyBtn,
            {
              backgroundColor: colors.card,
              borderColor: colors.separator,
              opacity: pressed || !sharePayload ? 0.75 : 1,
            },
          ]}
        >
          <Feather
            name={copied ? "check" : "link"}
            size={16}
            color={copied ? colors.accent : colors.foreground}
          />
          <Text
            style={[
              styles.copyBtnText,
              { color: copied ? colors.accent : colors.foreground },
            ]}
          >
            {copied ? "Link copied" : "Copy short link"}
          </Text>
        </Pressable>

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
                Share image card
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
    gap: 10,
    paddingHorizontal: 24,
  },
  loadingText: {
    fontSize: 13,
    fontFamily: "Inter_500Medium",
    textAlign: "center",
  },
  errorText: {
    fontSize: 13,
    fontFamily: "Inter_500Medium",
    textAlign: "center",
    lineHeight: 18,
  },
  copyBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    paddingVertical: 13,
    borderRadius: 16,
    borderWidth: 1,
    marginBottom: 8,
  },
  copyBtnText: {
    fontSize: 14,
    fontFamily: "Inter_700Bold",
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
