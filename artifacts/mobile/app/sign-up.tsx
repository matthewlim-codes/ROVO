import { Feather } from "@expo/vector-icons";
import { useSignUp, useSSO } from "@clerk/expo";
import * as AuthSession from "expo-auth-session";
import { type Href, router } from "expo-router";
import * as WebBrowser from "expo-web-browser";
import React, { useEffect, useRef, useState } from "react";
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
import { useColors } from "@/hooks/useColors";
import { apiFetch } from "@/utils/api";

WebBrowser.maybeCompleteAuthSession();

function useWarmUpBrowser() {
  useEffect(() => {
    if (Platform.OS !== "android") return;
    void WebBrowser.warmUpAsync();
    return () => {
      void WebBrowser.coolDownAsync();
    };
  }, []);
}

function clerkErrorMessage(err: unknown): string {
  const e = err as {
    errors?: Array<{ message?: string; longMessage?: string }>;
    message?: string;
  };
  return (
    e?.errors?.[0]?.longMessage ||
    e?.errors?.[0]?.message ||
    e?.message ||
    "Something went wrong."
  );
}

function navigateAfterAuth(decorateUrl: (url: string) => string) {
  const url = decorateUrl("/");
  if (url.startsWith("http")) {
    if (typeof window !== "undefined") window.location.href = url;
  } else {
    router.replace(url as Href);
  }
}

export default function SignUpScreen() {
  useWarmUpBrowser();
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const { signUp, errors, fetchStatus } = useSignUp();
  const { startSSOFlow } = useSSO();

  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [code, setCode] = useState("");
  const [googleLoading, setGoogleLoading] = useState(false);
  const [statusError, setStatusError] = useState("");
  const [showPassword, setShowPassword] = useState(false);

  const emailRef = useRef<TextInput>(null);
  const passwordRef = useRef<TextInput>(null);

  const loading = fetchStatus === "fetching";

  const isVerify =
    signUp?.status === "missing_requirements" &&
    (signUp?.unverifiedFields ?? []).includes("email_address") &&
    (signUp?.missingFields ?? []).length === 0;

  const handleSubmit = async () => {
    setStatusError("");
    if (!name.trim() || !email.trim() || !password.trim()) {
      setStatusError("Please fill in all fields.");
      return;
    }
    const { error: signUpError } = await signUp.password({
      emailAddress: email.trim(),
      password,
    });
    if (signUpError) {
      setStatusError(signUpError.message ?? "Sign-up failed.");
      return;
    }
    await signUp.verifications.sendEmailCode();
  };

  const handleVerify = async () => {
    setStatusError("");
    if (!code.trim()) {
      setStatusError("Please enter the code we emailed you.");
      return;
    }
    await signUp.verifications.verifyEmailCode({ code: code.trim() });
    if (signUp.status === "complete") {
      await signUp.finalize({
        navigate: async ({ decorateUrl }) => {
          if (name.trim()) {
            try {
              await apiFetch("/profile", {
                method: "PUT",
                body: JSON.stringify({ name: name.trim() }),
              });
            } catch {
              // name will be empty in profile; user can set it in edit-profile
            }
          }
          navigateAfterAuth(decorateUrl);
        },
      });
    } else {
      setStatusError("Verification did not complete. Please try again.");
    }
  };

  const handleResend = async () => {
    setStatusError("");
    await signUp.verifications.sendEmailCode();
  };

  const handleGoogle = async () => {
    setStatusError("");
    setGoogleLoading(true);
    try {
      const { createdSessionId, setActive } = await startSSOFlow({
        strategy: "oauth_google",
        redirectUrl: AuthSession.makeRedirectUri(),
      });
      if (createdSessionId && setActive) {
        await setActive({
          session: createdSessionId,
          navigate: async ({ decorateUrl }) => navigateAfterAuth(decorateUrl),
        });
      } else {
        setStatusError("Google sign-in incomplete. Please try again.");
      }
    } catch (e) {
      setStatusError(clerkErrorMessage(e));
    } finally {
      setGoogleLoading(false);
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
              paddingBottom:
                insets.bottom + (Platform.OS === "web" ? 34 : 0) + 40,
            },
          ]}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          <View style={styles.brand}>
            <View style={styles.logoCard}>
              <Text style={styles.logoWordmark}>rovo</Text>
            </View>
          </View>

          <View style={styles.heading}>
            <Text style={[styles.title, { color: colors.foreground }]}>
              {isVerify ? "Verify your email" : "Create account"}
            </Text>
            <Text style={[styles.subtitle, { color: colors.mutedForeground }]}>
              {isVerify
                ? `We sent a code to ${email}. Enter it below.`
                : "Join your club and find your ride"}
            </Text>
          </View>

          {!isVerify ? (
            <View style={styles.form}>
              <Pressable
                onPress={handleGoogle}
                disabled={googleLoading || loading}
                style={({ pressed }) => [
                  styles.googleBtn,
                  {
                    borderColor: colors.border,
                    backgroundColor: colors.card,
                    opacity: pressed || googleLoading ? 0.7 : 1,
                  },
                ]}
              >
                <Feather name="chrome" size={18} color={colors.foreground} />
                <Text style={[styles.googleBtnText, { color: colors.foreground }]}>
                  {googleLoading ? "Opening Google…" : "Continue with Google"}
                </Text>
              </Pressable>

              <View style={styles.divider}>
                <View style={[styles.dividerLine, { backgroundColor: colors.border }]} />
                <Text style={[styles.dividerText, { color: colors.mutedForeground }]}>
                  or
                </Text>
                <View style={[styles.dividerLine, { backgroundColor: colors.border }]} />
              </View>

              <Input
                placeholder="Full name"
                value={name}
                onChangeText={setName}
                autoCapitalize="words"
                autoCorrect={false}
                returnKeyType="next"
                onSubmitEditing={() => emailRef.current?.focus()}
                leftIcon={<Feather name="user" size={18} color={colors.mutedForeground} />}
              />

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
                leftIcon={<Feather name="mail" size={18} color={colors.mutedForeground} />}
              />
              {errors?.fields?.emailAddress && (
                <Text style={[styles.fieldError, { color: colors.destructive }]}>
                  {errors.fields.emailAddress.message}
                </Text>
              )}

              <Input
                ref={passwordRef}
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
              {errors?.fields?.password && (
                <Text style={[styles.fieldError, { color: colors.destructive }]}>
                  {errors.fields.password.message}
                </Text>
              )}

              {/* Required: Clerk bot sign-up protection */}
              <View nativeID="clerk-captcha" />

              {statusError ? (
                <View style={[styles.errorBox, { backgroundColor: "#FEF2F2" }]}>
                  <Feather name="alert-circle" size={14} color={colors.destructive} />
                  <Text style={[styles.errorText, { color: colors.destructive }]}>
                    {statusError}
                  </Text>
                </View>
              ) : null}

              <Button
                title="Create Account"
                onPress={handleSubmit}
                loading={loading}
                size="lg"
              />
            </View>
          ) : (
            <View style={styles.form}>
              <Input
                placeholder="6-digit code"
                value={code}
                onChangeText={setCode}
                keyboardType="number-pad"
                autoCapitalize="none"
                autoCorrect={false}
                returnKeyType="done"
                onSubmitEditing={handleVerify}
                leftIcon={<Feather name="key" size={18} color={colors.mutedForeground} />}
              />
              {errors?.fields?.code && (
                <Text style={[styles.fieldError, { color: colors.destructive }]}>
                  {errors.fields.code.message}
                </Text>
              )}

              {statusError ? (
                <View style={[styles.errorBox, { backgroundColor: "#FEF2F2" }]}>
                  <Feather name="alert-circle" size={14} color={colors.destructive} />
                  <Text style={[styles.errorText, { color: colors.destructive }]}>
                    {statusError}
                  </Text>
                </View>
              ) : null}

              <Button
                title="Verify Email"
                onPress={handleVerify}
                loading={loading}
                size="lg"
              />
              <Pressable onPress={handleResend} disabled={loading}>
                <Text style={[styles.secondaryLink, { color: colors.mutedForeground }]}>
                  Resend code
                </Text>
              </Pressable>
            </View>
          )}

          <View style={styles.switchRow}>
            <Text style={[styles.switchText, { color: colors.mutedForeground }]}>
              Already have an account?
            </Text>
            <Pressable onPress={() => router.replace("/login" as Href)}>
              <Text style={[styles.switchLink, { color: colors.foreground }]}>
                Sign in
              </Text>
            </Pressable>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  scroll: { flexGrow: 1, paddingHorizontal: 24, gap: 32 },
  brand: { alignItems: "flex-start" },
  logoCard: {
    width: 88,
    height: 88,
    backgroundColor: "#000",
    borderRadius: 18,
    alignItems: "center",
    justifyContent: "center",
  },
  logoWordmark: {
    fontFamily: "PlusJakartaSans_700Bold",
    fontSize: 26,
    color: "#fff",
    letterSpacing: -0.6,
  },
  heading: { gap: 6 },
  title: { fontSize: 32, fontFamily: "Inter_700Bold", letterSpacing: -0.8, lineHeight: 38 },
  subtitle: { fontSize: 16, fontFamily: "Inter_400Regular", lineHeight: 22 },
  form: { gap: 12 },
  googleBtn: {
    height: 48, borderRadius: 12, borderWidth: 1,
    flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 10,
  },
  googleBtnText: { fontSize: 15, fontFamily: "Inter_600SemiBold" },
  divider: { flexDirection: "row", alignItems: "center", gap: 12, marginVertical: 4 },
  dividerLine: { flex: 1, height: 1 },
  dividerText: { fontSize: 12, fontFamily: "Inter_500Medium" },
  fieldError: { fontSize: 12, fontFamily: "Inter_400Regular", marginTop: -4 },
  errorBox: {
    flexDirection: "row", alignItems: "flex-start", gap: 8, padding: 12, borderRadius: 12,
  },
  errorText: { fontSize: 13, fontFamily: "Inter_400Regular", flex: 1, lineHeight: 18 },
  switchRow: { flexDirection: "row", justifyContent: "center", gap: 6 },
  switchText: { fontSize: 14, fontFamily: "Inter_400Regular" },
  switchLink: { fontSize: 14, fontFamily: "Inter_600SemiBold", textDecorationLine: "underline" },
  secondaryLink: { fontSize: 13, fontFamily: "Inter_500Medium", textAlign: "center", marginTop: 4 },
});
