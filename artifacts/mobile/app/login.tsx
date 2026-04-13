import { Feather } from "@expo/vector-icons";
import { router } from "expo-router";
import React, { useRef, useState } from "react";
import {
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
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === "ios" ? "padding" : "height"}
      >
        <ScrollView
          contentContainerStyle={[
            styles.scroll,
            {
              paddingTop: insets.top + (Platform.OS === "web" ? 67 : 0) + 40,
              paddingBottom: insets.bottom + (Platform.OS === "web" ? 34 : 0) + 40,
            },
          ]}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          <View style={styles.brand}>
            <View
              style={[
                styles.logoMark,
                { backgroundColor: colors.primary },
              ]}
            >
              <Text style={styles.logoMarkText}>R</Text>
            </View>
            <Text style={[styles.brandName, { color: colors.foreground }]}>
              ReadySetGo
            </Text>
          </View>

          <View style={styles.heading}>
            <Text style={[styles.title, { color: colors.foreground }]}>
              {mode === "login" ? "Welcome back" : "Create account"}
            </Text>
            <Text style={[styles.subtitle, { color: colors.mutedForeground }]}>
              {mode === "login"
                ? "Sign in to coordinate your ride"
                : "Join your club and find your ride"}
            </Text>
          </View>

          <View style={styles.form}>
            {mode === "register" && (
              <Input
                placeholder="Full name"
                value={name}
                onChangeText={setName}
                autoCapitalize="words"
                returnKeyType="next"
                onSubmitEditing={() => emailRef.current?.focus()}
                leftIcon={
                  <Feather name="user" size={18} color={colors.mutedForeground} />
                }
              />
            )}

            <Input
              ref={emailRef}
              placeholder="Email address"
              value={email}
              onChangeText={setEmail}
              keyboardType="email-address"
              autoCapitalize="none"
              autoCorrect={false}
              returnKeyType="next"
              onSubmitEditing={() => passwordRef.current?.focus()}
              leftIcon={
                <Feather name="mail" size={18} color={colors.mutedForeground} />
              }
            />

            <Input
              ref={passwordRef}
              placeholder="Password"
              value={password}
              onChangeText={setPassword}
              secureTextEntry={!showPassword}
              returnKeyType="done"
              onSubmitEditing={handleSubmit}
              leftIcon={
                <Feather name="lock" size={18} color={colors.mutedForeground} />
              }
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
              title={mode === "login" ? "Sign In" : "Create Account"}
              onPress={handleSubmit}
              loading={loading}
              size="lg"
            />
          </View>

          <View style={styles.switchRow}>
            <Text style={[styles.switchText, { color: colors.mutedForeground }]}>
              {mode === "login"
                ? "Don't have an account?"
                : "Already have an account?"}
            </Text>
            <Pressable
              onPress={() => {
                setMode(mode === "login" ? "register" : "login");
                setError("");
              }}
            >
              <Text
                style={[
                  styles.switchLink,
                  { color: colors.foreground },
                ]}
              >
                {mode === "login" ? "Sign up" : "Sign in"}
              </Text>
            </Pressable>
          </View>

          <Text style={[styles.hint, { color: colors.mutedForeground }]}>
            Demo: register any email, then enter club code GOLD2024
          </Text>
        </ScrollView>
      </KeyboardAvoidingView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  scroll: {
    flexGrow: 1,
    paddingHorizontal: 24,
    gap: 32,
  },
  brand: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
  },
  logoMark: {
    width: 36,
    height: 36,
    borderRadius: 10,
    alignItems: "center",
    justifyContent: "center",
  },
  logoMarkText: {
    fontSize: 18,
    fontFamily: "Inter_700Bold",
    color: "#FFFFFF",
  },
  brandName: {
    fontSize: 20,
    fontFamily: "Inter_700Bold",
    letterSpacing: -0.5,
  },
  heading: {
    gap: 6,
  },
  title: {
    fontSize: 32,
    fontFamily: "Inter_700Bold",
    letterSpacing: -0.8,
    lineHeight: 38,
  },
  subtitle: {
    fontSize: 16,
    fontFamily: "Inter_400Regular",
    lineHeight: 22,
  },
  form: {
    gap: 12,
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
  switchRow: {
    flexDirection: "row",
    justifyContent: "center",
    gap: 6,
  },
  switchText: {
    fontSize: 14,
    fontFamily: "Inter_400Regular",
  },
  switchLink: {
    fontSize: 14,
    fontFamily: "Inter_600SemiBold",
    textDecorationLine: "underline",
  },
  hint: {
    fontSize: 12,
    fontFamily: "Inter_400Regular",
    textAlign: "center",
    lineHeight: 18,
  },
});
