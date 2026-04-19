import { Feather } from "@expo/vector-icons";
import { router } from "expo-router";
import React, { useState } from "react";
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

import { useAuth } from "@/context/AuthContext";
import { useColors } from "@/hooks/useColors";

export default function EditProfileScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const { user, updateProfile } = useAuth();
  const [name, setName] = useState(user?.name ?? "");
  const [email, setEmail] = useState(user?.email ?? "");
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const handleSave = async () => {
    setError(null);
    if (!name.trim()) {
      setError("Name cannot be empty.");
      return;
    }
    if (!email.trim() || !email.includes("@")) {
      setError("Please enter a valid email.");
      return;
    }
    setSaving(true);
    try {
      await updateProfile({ name, email });
      router.back();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not save changes.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <KeyboardAvoidingView
      style={[styles.container, { backgroundColor: colors.background }]}
      behavior={Platform.OS === "ios" ? "padding" : undefined}
    >
      <View
        style={[
          styles.header,
          {
            paddingTop: insets.top + (Platform.OS === "web" ? 67 : 0) + 8,
            borderBottomColor: colors.separator,
          },
        ]}
      >
        <Pressable onPress={() => router.back()} style={styles.iconBtn}>
          <Feather name="chevron-left" size={24} color={colors.foreground} />
        </Pressable>
        <Text style={[styles.headerTitle, { color: colors.foreground }]}>
          Edit profile
        </Text>
        <View style={styles.iconBtn} />
      </View>

      <ScrollView
        contentContainerStyle={styles.content}
        keyboardShouldPersistTaps="handled"
      >
        <View
          style={[styles.avatar, { backgroundColor: colors.muted }]}
        >
          <Text style={[styles.avatarText, { color: colors.foreground }]}>
            {(user?.name ?? "?").charAt(0).toUpperCase()}
          </Text>
        </View>

        <View style={styles.field}>
          <Text style={[styles.label, { color: colors.mutedForeground }]}>
            Name
          </Text>
          <TextInput
            value={name}
            onChangeText={setName}
            style={[
              styles.input,
              {
                color: colors.foreground,
                backgroundColor: colors.card,
                borderColor: colors.separator,
              },
            ]}
            placeholder="Your name"
            placeholderTextColor={colors.mutedForeground}
          />
        </View>

        <View style={styles.field}>
          <Text style={[styles.label, { color: colors.mutedForeground }]}>
            Email
          </Text>
          <TextInput
            value={email}
            onChangeText={setEmail}
            style={[
              styles.input,
              {
                color: colors.foreground,
                backgroundColor: colors.card,
                borderColor: colors.separator,
              },
            ]}
            placeholder="you@example.com"
            placeholderTextColor={colors.mutedForeground}
            autoCapitalize="none"
            keyboardType="email-address"
          />
        </View>

        <View style={styles.field}>
          <Text style={[styles.label, { color: colors.mutedForeground }]}>
            Club
          </Text>
          <View
            style={[
              styles.input,
              styles.readonly,
              {
                backgroundColor: colors.muted,
                borderColor: colors.separator,
              },
            ]}
          >
            <Text style={{ color: colors.foreground }}>
              {user?.club || "—"}
            </Text>
            <Text style={{ color: colors.mutedForeground, fontSize: 12 }}>
              {user?.team || ""}
            </Text>
          </View>
        </View>

        {error ? (
          <Text style={[styles.error, { color: "#dc2626" }]}>{error}</Text>
        ) : null}

        <Pressable
          onPress={handleSave}
          disabled={saving}
          style={({ pressed }) => [
            styles.saveBtn,
            {
              backgroundColor: colors.primary,
              opacity: pressed || saving ? 0.85 : 1,
            },
          ]}
        >
          <Text style={styles.saveBtnText}>
            {saving ? "Saving…" : "Save changes"}
          </Text>
        </Pressable>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 12,
    paddingBottom: 14,
    borderBottomWidth: 1,
  },
  iconBtn: {
    width: 40,
    height: 40,
    alignItems: "center",
    justifyContent: "center",
  },
  headerTitle: {
    fontSize: 17,
    fontFamily: "Inter_600SemiBold",
  },
  content: {
    padding: 20,
    gap: 16,
  },
  avatar: {
    width: 84,
    height: 84,
    borderRadius: 42,
    alignSelf: "center",
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 8,
  },
  avatarText: {
    fontSize: 32,
    fontFamily: "Inter_700Bold",
  },
  field: { gap: 6 },
  label: {
    fontSize: 12,
    fontFamily: "Inter_500Medium",
    textTransform: "uppercase",
    letterSpacing: 0.6,
  },
  input: {
    borderWidth: 1,
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontSize: 15,
    fontFamily: "Inter_400Regular",
  },
  readonly: { gap: 2 },
  error: {
    fontSize: 13,
    fontFamily: "Inter_500Medium",
  },
  saveBtn: {
    marginTop: 8,
    paddingVertical: 14,
    borderRadius: 100,
    alignItems: "center",
  },
  saveBtnText: {
    color: "#fff",
    fontSize: 15,
    fontFamily: "Inter_600SemiBold",
  },
});
