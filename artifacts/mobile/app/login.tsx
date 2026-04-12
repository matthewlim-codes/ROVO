import { Feather } from "@expo/vector-icons";
import { LinearGradient } from "expo-linear-gradient";
import { router } from "expo-router";
import React, { useRef, useState } from "react";
import {
  Image,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { Button } from "@/components/Button";
import { Input } from "@/components/Input";
import { useAuth } from "@/context/AuthContext";
import { useColors } from "@/hooks/useColors";

type Mode = "login" | "register";

export default function LoginScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const { login, register } = useAuth();

  const [mode, setMode] = useState<Mode>("login");
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [showPassword, setShowPassword] = useState(false);

  const emailRef = useRef<TextInput>(null);
  const passwordRef = useRef<TextInput>(null);

  const handleSubmit = async () => {
    setError("");
    if (!email.trim() || !password.trim()) {
      setError("Please fill in all fields.");
      return;
    }
    if (mode === "register" && !name.trim()) {
      setError("Please enter your name.");
      return;
    }
    setLoading(true);
    try {
      if (mode === "login") {
        await login(email.trim(), password);
      } else {
        await register(email.trim(), password, name.trim());
      }
      router.replace("/");
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Something went wrong.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <View style={{ flex: 1 }}>
      <LinearGradient
        colors={[colors.navy, colors.navyLight, "#0f2844"]}
        style={StyleSheet.absoluteFill}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
      />

      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === "ios" ? "padding" : "height"}
      >
        <ScrollView
          contentContainerStyle={[
            styles.scroll,
            {
              paddingTop: insets.top + (Platform.OS === "web" ? 67 : 0) + 20,
              paddingBottom: insets.bottom + (Platform.OS === "web" ? 34 : 0) + 40,
            },
          ]}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          <View style={styles.brandRow}>
            <Image
              source={require("@/assets/images/icon.png")}
              style={styles.logo}
              resizeMode="contain"
            />
            <Text style={styles.brand}>ReadySetGo</Text>
          </View>

          <Text style={styles.tagline}>
            Find your ride.{"\n"}Get there together.
          </Text>

          <View
            style={[
              styles.card,
              {
                backgroundColor: colors.card,
                borderRadius: colors.radius,
              },
            ]}
          >
            <View style={styles.tabs}>
              {(["login", "register"] as Mode[]).map((m) => (
                <Pressable
                  key={m}
                  onPress={() => { setMode(m); setError(""); }}
                  style={[
                    styles.tab,
                    {
                      borderBottomWidth: mode === m ? 2 : 0,
                      borderBottomColor: colors.primary,
                    },
                  ]}
                >
                  <Text
                    style={[
                      styles.tabText,
                      {
                        color: mode === m ? colors.primary : colors.mutedForeground,
                        fontFamily: mode === m ? "Inter_600SemiBold" : "Inter_400Regular",
                      },
                    ]}
                  >
                    {m === "login" ? "Sign In" : "Create Account"}
                  </Text>
                </Pressable>
              ))}
            </View>

            <View style={styles.form}>
              {mode === "register" && (
                <Input
                  label="Full Name"
                  placeholder="Your name"
                  value={name}
                  onChangeText={setName}
                  autoCapitalize="words"
                  returnKeyType="next"
                  onSubmitEditing={() => emailRef.current?.focus()}
                  leftIcon={<Feather name="user" size={18} color={colors.mutedForeground} />}
                />
              )}

              <Input
                ref={emailRef}
                label="Email"
                placeholder="your@email.com"
                value={email}
                onChangeText={setEmail}
                keyboardType="email-address"
                autoCapitalize="none"
                autoCorrect={false}
                returnKeyType="next"
                onSubmitEditing={() => passwordRef.current?.focus()}
                leftIcon={<Feather name="mail" size={18} color={colors.mutedForeground} />}
              />

              <Input
                ref={passwordRef}
                label="Password"
                placeholder="Password"
                value={password}
                onChangeText={setPassword}
                secureTextEntry={!showPassword}
                returnKeyType="done"
                onSubmitEditing={handleSubmit}
                leftIcon={<Feather name="lock" size={18} color={colors.mutedForeground} />}
                rightIcon={
                  <Pressable onPress={() => setShowPassword(!showPassword)}>
                    <Feather
                      name={showPassword ? "eye-off" : "eye"}
                      size={18}
                      color={colors.mutedForeground}
                    />
                  </Pressable>
                }
              />

              {error ? (
                <View
                  style={[
                    styles.errorBox,
                    { backgroundColor: "#fef2f2", borderRadius: colors.radius - 8 },
                  ]}
                >
                  <Feather name="alert-circle" size={14} color={colors.destructive} />
                  <Text style={[styles.errorText, { color: colors.destructive }]}>
                    {error}
                  </Text>
                </View>
              ) : null}

              <Button
                title={mode === "login" ? "Sign In" : "Create Account"}
                onPress={handleSubmit}
                loading={loading}
                size="lg"
              />
            </View>
          </View>

          <Text style={styles.hint}>
            Club codes are provided by your club director
          </Text>
        </ScrollView>
      </KeyboardAvoidingView>
    </View>
  );
}

const styles = StyleSheet.create({
  scroll: {
    flexGrow: 1,
    paddingHorizontal: 24,
    gap: 24,
    alignItems: "stretch",
  },
  brandRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    justifyContent: "center",
    marginTop: 20,
  },
  logo: {
    width: 44,
    height: 44,
    borderRadius: 10,
  },
  brand: {
    fontSize: 28,
    fontFamily: "Inter_700Bold",
    color: "#ffffff",
    letterSpacing: -0.5,
  },
  tagline: {
    fontSize: 22,
    fontFamily: "Inter_700Bold",
    color: "rgba(255,255,255,0.9)",
    textAlign: "center",
    lineHeight: 32,
  },
  card: {
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.15,
    shadowRadius: 20,
    elevation: 8,
    overflow: "hidden",
  },
  tabs: {
    flexDirection: "row",
    borderBottomWidth: 1,
    borderBottomColor: "#e2e8f0",
  },
  tab: {
    flex: 1,
    paddingVertical: 16,
    alignItems: "center",
  },
  tabText: {
    fontSize: 15,
  },
  form: {
    padding: 24,
    gap: 16,
  },
  errorBox: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    padding: 12,
  },
  errorText: {
    fontSize: 13,
    fontFamily: "Inter_400Regular",
    flex: 1,
  },
  hint: {
    color: "rgba(255,255,255,0.5)",
    fontSize: 12,
    fontFamily: "Inter_400Regular",
    textAlign: "center",
  },
});
