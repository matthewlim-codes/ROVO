import { Feather } from "@expo/vector-icons";
import { LinearGradient } from "expo-linear-gradient";
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
import { useAuth } from "@/context/AuthContext";
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
    } catch {
      setError(
        "Code is case sensitive. Please check with your club director to confirm your team has access."
      );
    } finally {
      setLoading(false);
    }
  };

  return (
    <View style={{ flex: 1 }}>
      <LinearGradient
        colors={[colors.navy, "#264d7a"]}
        style={StyleSheet.absoluteFill}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
      />

      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === "ios" ? "padding" : "height"}
      >
        <View
          style={[
            styles.container,
            {
              paddingTop: insets.top + (Platform.OS === "web" ? 67 : 0) + 40,
              paddingBottom: insets.bottom + (Platform.OS === "web" ? 34 : 0) + 40,
            },
          ]}
        >
          <View style={styles.iconBox}>
            <Feather name="shield" size={48} color="#fff" />
          </View>

          <Text style={styles.title}>Enter Club Code</Text>
          <Text style={styles.subtitle}>
            Hi {user?.name?.split(" ")[0]}! Your club director provided a unique
            code to verify your team membership.
          </Text>

          <View
            style={[
              styles.card,
              { backgroundColor: colors.card, borderRadius: colors.radius },
            ]}
          >
            <Input
              label="Club Code"
              placeholder="e.g. GOLD2024"
              value={code}
              onChangeText={setCode}
              autoCapitalize="characters"
              autoCorrect={false}
              returnKeyType="done"
              onSubmitEditing={handleSubmit}
              leftIcon={<Feather name="key" size={18} color={colors.mutedForeground} />}
              style={{ letterSpacing: 2, fontFamily: "Inter_700Bold" }}
            />

            {error ? (
              <View
                style={[
                  styles.errorBox,
                  {
                    backgroundColor: "#fef2f2",
                    borderRadius: colors.radius - 8,
                  },
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

          <View style={styles.hintBox}>
            <Feather name="info" size={14} color="rgba(255,255,255,0.6)" />
            <Text style={styles.hint}>
              Codes are case sensitive. Contact your club director if you
              don&apos;t have one.
            </Text>
          </View>

          <Text style={styles.demoHint}>
            Demo codes: GOLD2024, STORM24, VBALL25, ELITE25, FURY2025
          </Text>
        </View>
      </KeyboardAvoidingView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    paddingHorizontal: 24,
    gap: 24,
    alignItems: "stretch",
  },
  iconBox: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: "rgba(255,255,255,0.15)",
    alignItems: "center",
    justifyContent: "center",
    alignSelf: "center",
  },
  title: {
    fontSize: 28,
    fontFamily: "Inter_700Bold",
    color: "#ffffff",
    textAlign: "center",
  },
  subtitle: {
    fontSize: 16,
    fontFamily: "Inter_400Regular",
    color: "rgba(255,255,255,0.8)",
    textAlign: "center",
    lineHeight: 24,
  },
  card: {
    padding: 24,
    gap: 16,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.15,
    shadowRadius: 20,
    elevation: 8,
  },
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
  },
  hint: {
    color: "rgba(255,255,255,0.6)",
    fontSize: 12,
    fontFamily: "Inter_400Regular",
    flex: 1,
    lineHeight: 18,
  },
  demoHint: {
    color: "rgba(255,255,255,0.4)",
    fontSize: 11,
    fontFamily: "Inter_400Regular",
    textAlign: "center",
  },
});
