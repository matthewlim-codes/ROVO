import React, { useEffect, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { Feather } from "@expo/vector-icons";

import { apiFetch } from "@/utils/api";
import { useColors } from "@/hooks/useColors";

export interface PendingSurvey {
  matchEventId: string;
  tournamentId: string;
  mode: "arrival" | "departure";
  matchedAt: string;
  tripDatetime: string;
  airport: string;
  hotel: string;
  otherUserName: string;
  otherUserTeam: string;
}

type Rating = "great" | "good" | "okay" | "didnt_ride";

const RATINGS: { key: Rating; label: string; icon: keyof typeof Feather.glyphMap }[] = [
  { key: "great", label: "Great", icon: "star" },
  { key: "good", label: "Good", icon: "thumbs-up" },
  { key: "okay", label: "Okay", icon: "minus-circle" },
  { key: "didnt_ride", label: "Didn't ride", icon: "x-circle" },
];

interface Props {
  survey: PendingSurvey | null;
  onClose: () => void;
  onSubmitted: () => void;
}

export function RideSurveyModal({ survey, onClose, onSubmitted }: Props) {
  const colors = useColors();
  const [rating, setRating] = useState<Rating | null>(null);
  const [moneySaved, setMoneySaved] = useState("");
  const [notes, setNotes] = useState("");
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    setRating(null);
    setMoneySaved("");
    setNotes("");
  }, [survey?.matchEventId]);

  if (!survey) return null;

  const handleDismiss = async () => {
    try {
      await apiFetch("/surveys/dismiss", {
        method: "POST",
        body: JSON.stringify({ matchEventId: survey.matchEventId }),
      });
    } catch {}
    onClose();
  };

  const handleSubmit = async () => {
    if (!rating) return;
    setSubmitting(true);
    try {
      const parsedMoney = moneySaved.trim() ? Number.parseInt(moneySaved, 10) : null;
      await apiFetch("/surveys", {
        method: "POST",
        body: JSON.stringify({
          matchEventId: survey.matchEventId,
          rating,
          moneySavedDollars:
            parsedMoney !== null && !Number.isNaN(parsedMoney) ? parsedMoney : null,
          notes: notes.trim() || undefined,
        }),
      });
      Alert.alert("Thanks!", "Your feedback helps us improve Rovo.");
      onSubmitted();
      onClose();
    } catch (e) {
      Alert.alert("Could not save", e instanceof Error ? e.message : String(e));
    } finally {
      setSubmitting(false);
    }
  };

  const rideLabel = survey.mode === "arrival" ? "arrival ride" : "departure ride";

  return (
    <Modal visible animationType="slide" transparent onRequestClose={handleDismiss}>
      <KeyboardAvoidingView
        style={styles.backdrop}
        behavior={Platform.OS === "ios" ? "padding" : undefined}
      >
        <Pressable style={StyleSheet.absoluteFill} onPress={handleDismiss} />
        <View style={[styles.sheet, { backgroundColor: colors.background }]}>
          <View style={styles.header}>
            <Text style={[styles.title, { color: colors.foreground }]}>How was your ride?</Text>
            <Pressable onPress={handleDismiss} hitSlop={8}>
              <Feather name="x" size={22} color={colors.mutedForeground} />
            </Pressable>
          </View>

          <Text style={[styles.sub, { color: colors.mutedForeground }]}>
            You matched with {survey.otherUserName}
            {survey.otherUserTeam ? ` (${survey.otherUserTeam})` : ""} for your {rideLabel} via{" "}
            {survey.airport} → {survey.hotel}.
          </Text>

          <Text style={[styles.label, { color: colors.foreground }]}>How did it go?</Text>
          <View style={styles.ratingRow}>
            {RATINGS.map((r) => {
              const selected = rating === r.key;
              return (
                <Pressable
                  key={r.key}
                  onPress={() => setRating(r.key)}
                  style={[
                    styles.ratingBtn,
                    {
                      borderColor: selected ? colors.foreground : colors.separator,
                      backgroundColor: selected ? colors.foreground : colors.card,
                    },
                  ]}
                >
                  <Feather
                    name={r.icon}
                    size={18}
                    color={selected ? colors.background : colors.mutedForeground}
                  />
                  <Text
                    style={[
                      styles.ratingLabel,
                      { color: selected ? colors.background : colors.foreground },
                    ]}
                  >
                    {r.label}
                  </Text>
                </Pressable>
              );
            })}
          </View>

          {rating && rating !== "didnt_ride" && (
            <>
              <Text style={[styles.label, { color: colors.foreground }]}>
                About how much did you save? (optional)
              </Text>
              <View style={styles.moneyRow}>
                <Text style={[styles.dollar, { color: colors.mutedForeground }]}>$</Text>
                <TextInput
                  value={moneySaved}
                  onChangeText={(t) => setMoneySaved(t.replace(/[^0-9]/g, ""))}
                  placeholder="0"
                  placeholderTextColor={colors.mutedForeground}
                  keyboardType="number-pad"
                  style={[
                    styles.moneyInput,
                    {
                      color: colors.foreground,
                      borderColor: colors.separator,
                      backgroundColor: colors.card,
                    },
                  ]}
                />
              </View>
            </>
          )}

          <TextInput
            value={notes}
            onChangeText={setNotes}
            placeholder="Anything else? (optional)"
            placeholderTextColor={colors.mutedForeground}
            multiline
            style={[
              styles.notesInput,
              {
                color: colors.foreground,
                borderColor: colors.separator,
                backgroundColor: colors.card,
              },
            ]}
          />

          <Pressable
            onPress={handleSubmit}
            disabled={submitting || !rating}
            style={({ pressed }) => [
              styles.btn,
              {
                backgroundColor: colors.foreground,
                opacity: submitting || !rating ? 0.5 : pressed ? 0.85 : 1,
              },
            ]}
          >
            {submitting ? (
              <ActivityIndicator color={colors.background} />
            ) : (
              <Text style={[styles.btnText, { color: colors.background }]}>Submit</Text>
            )}
          </Pressable>

          <Pressable onPress={handleDismiss} style={styles.skipBtn}>
            <Text style={[styles.skipText, { color: colors.mutedForeground }]}>Not now</Text>
          </Pressable>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: { flex: 1, backgroundColor: "rgba(0,0,0,0.4)", justifyContent: "flex-end" },
  sheet: {
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    padding: 20,
    paddingBottom: 30,
    gap: 12,
  },
  header: { flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  title: { fontSize: 18, fontFamily: "Inter_700Bold" },
  sub: { fontSize: 13, fontFamily: "Inter_400Regular", lineHeight: 18 },
  label: { fontSize: 14, fontFamily: "Inter_600SemiBold", marginTop: 4 },
  ratingRow: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  ratingBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderRadius: 10,
    borderWidth: 1,
  },
  ratingLabel: { fontSize: 13, fontFamily: "Inter_600SemiBold" },
  moneyRow: { flexDirection: "row", alignItems: "center", gap: 6 },
  dollar: { fontSize: 18, fontFamily: "Inter_600SemiBold" },
  moneyInput: {
    flex: 1,
    borderWidth: 1,
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontSize: 16,
    fontFamily: "Inter_400Regular",
  },
  notesInput: {
    minHeight: 72,
    borderWidth: 1,
    borderRadius: 12,
    padding: 14,
    fontSize: 14,
    fontFamily: "Inter_400Regular",
    textAlignVertical: "top",
  },
  btn: {
    paddingVertical: 14,
    borderRadius: 12,
    alignItems: "center",
    marginTop: 4,
  },
  btnText: { fontSize: 15, fontFamily: "Inter_700Bold" },
  skipBtn: { alignItems: "center", paddingVertical: 8 },
  skipText: { fontSize: 14, fontFamily: "Inter_500Medium" },
});
