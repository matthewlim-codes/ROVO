import { Feather } from "@expo/vector-icons";
import { router } from "expo-router";
import React, { useState } from "react";
import {
  KeyboardAvoidingView,
  Platform,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { Button } from "@/components/Button";
import { Input } from "@/components/Input";
import {
  ClubCodeNetworkError,
  InvalidClubCodeError,
  useAuth,
} from "@/context/AuthContext";
import { useColors } from "@/hooks/useColors";

export default function ClubCodeScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const { enterClubCode, user } = useAuth();
  const [code, setCode] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const handleSubmit = async () => {
    setError("");
    if (!code.trim()) {
      setError("Please enter your club code.");
      return;
    }
    setLoading(true);
    try {
      await enterClubCode(code.trim());
      router.replace("/tournaments");
    } catch (err) {
      if (err instanceof InvalidClubCodeError) {
        setError(
          "We couldn't find that club code. Codes are case sensitive — ask your coach for the latest code and try again."
        );
      } else if (err instanceof ClubCodeNetworkError) {
        setError(
          "We couldn't reach the server to verify your code. Check your connection and try again in a moment."
        );
      } else {
        setError("Something went wrong. Please try again.");
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === "ios" ? "padding" : "height"}
      >
        <View
          style={[
            styles.inner,
            {
              paddingTop: insets.top + (Platform.OS === "web" ? 67 : 0) + 40,
              paddingBottom: insets.bottom + (Platform.OS === "web" ? 34 : 0) + 40,
            },
          ]}
        >
          <View
            style={[styles.iconBox, { backgroundColor: colors.muted }]}
          >
            <Feather name="shield" size={32} color={colors.foreground} />
          </View>

          <View style={styles.textBlock}>
            <Text style={[styles.title, { color: colors.foreground }]}>
              Enter club code
            </Text>
            <Text style={[styles.subtitle, { color: colors.mutedForeground }]}>
              Hi {user?.name?.split(" ")[0]}! Your club director provided a
              code to verify your team membership.
            </Text>
          </View>

          <View style={styles.form}>
            <Input
              placeholder="Club code (e.g. GOLD2024)"
              value={code}
              onChangeText={setCode}
              autoCapitalize="characters"
              autoCorrect={false}
              returnKeyType="done"
              onSubmitEditing={handleSubmit}
              style={{
                letterSpacing: 3,
                fontFamily: "Inter_700Bold",
                fontSize: 18,
                textAlign: "center",
              }}
            />

            {error ? (
              <View
                style={[
                  styles.errorBox,
                  { backgroundColor: "#FEF2F2", borderRadius: 12 },
                ]}
              >
                <Feather name="alert-circle" size={14} color={colors.destructive} />
                <Text style={[styles.errorText, { color: colors.destructive }]}>
                  {error}
                </Text>
              </View>
            ) : null}

            <Button
              title="Verify Code"
              onPress={handleSubmit}
              loading={loading}
              size="lg"
            />
          </View>

          <View
            style={[
              styles.hintBox,
              { backgroundColor: colors.muted, borderRadius: 12 },
            ]}
          >
            <Feather name="info" size={14} color={colors.mutedForeground} />
            <Text style={[styles.hint, { color: colors.mutedForeground }]}>
              Demo codes: GOLD2024 · STORM24 · VBALL25 · ELITE25 · FURY2025
            </Text>
          </View>
        </View>
      </KeyboardAvoidingView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  inner: {
    flex: 1,
    paddingHorizontal: 24,
    gap: 28,
    alignItems: "stretch",
  },
  iconBox: {
    width: 64,
    height: 64,
    borderRadius: 18,
    alignItems: "center",
    justifyContent: "center",
    alignSelf: "flex-start",
  },
  textBlock: { gap: 8 },
  title: {
    fontSize: 32,
    fontFamily: "Inter_700Bold",
    letterSpacing: -0.8,
  },
  subtitle: {
    fontSize: 16,
    fontFamily: "Inter_400Regular",
    lineHeight: 24,
  },
  form: { gap: 12 },
  errorBox: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 8,
    padding: 12,
  },
  errorText: {
    fontSize: 13,
    fontFamily: "Inter_400Regular",
    flex: 1,
    lineHeight: 18,
  },
  hintBox: {
    flexDirection: "row",
    gap: 8,
    alignItems: "flex-start",
    padding: 14,
  },
  hint: {
    fontSize: 13,
    fontFamily: "Inter_400Regular",
    flex: 1,
    lineHeight: 20,
  },
});
