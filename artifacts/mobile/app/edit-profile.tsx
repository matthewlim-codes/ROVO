import { Feather } from "@expo/vector-icons";
import { Image } from "expo-image";
import * as ImagePicker from "expo-image-picker";
import { router } from "expo-router";
import React, { useState } from "react";
import {
  Alert,
  KeyboardAvoidingView,
  Linking,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { FeedbackModal } from "@/components/FeedbackModal";
import { useAuth } from "@/context/AuthContext";
import { useColors } from "@/hooks/useColors";
import { getAdminUrl } from "@/utils/api";

export default function EditProfileScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const { user, updateProfile } = useAuth();
  const [name, setName] = useState(user?.name ?? "");
  const [email, setEmail] = useState(user?.email ?? "");
  const [avatarUri, setAvatarUri] = useState<string | undefined | null>(
    user?.avatarUri
  );
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [feedbackOpen, setFeedbackOpen] = useState(false);

  const handlePickPhoto = async () => {
    try {
      const perm = await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (!perm.granted) {
        Alert.alert(
          "Permission needed",
          "Please allow photo access to change your profile picture."
        );
        return;
      }
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.Images,
        allowsEditing: true,
        aspect: [1, 1],
        quality: 0.8,
      });
      if (!result.canceled && result.assets[0]?.uri) {
        setAvatarUri(result.assets[0].uri);
      }
    } catch (e) {
      Alert.alert("Could not pick image", String(e));
    }
  };

  const handleRemovePhoto = () => {
    if (Platform.OS === "web") {
      setAvatarUri(null);
    } else {
      Alert.alert("Remove photo?", "Your profile picture will be removed.", [
        { text: "Cancel", style: "cancel" },
        {
          text: "Remove",
          style: "destructive",
          onPress: () => setAvatarUri(null),
        },
      ]);
    }
  };

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
      await updateProfile({
        name,
        email,
        avatarUri:
          avatarUri === null ? null : avatarUri ?? user?.avatarUri,
      });
      router.back();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not save changes.");
    } finally {
      setSaving(false);
    }
  };

  const initial = (user?.name ?? "?").charAt(0).toUpperCase();
  const showAvatar = !!avatarUri;

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
        <View style={styles.avatarColumn}>
          <Pressable
            onPress={handlePickPhoto}
            style={[
              styles.avatar,
              {
                backgroundColor: colors.muted,
                borderColor: colors.separator,
              },
            ]}
          >
            {showAvatar ? (
              <Image
                source={{ uri: avatarUri! }}
                style={styles.avatarImage}
                contentFit="cover"
              />
            ) : (
              <Text style={[styles.avatarText, { color: colors.foreground }]}>
                {initial}
              </Text>
            )}
            <View
              style={[
                styles.cameraBadge,
                { backgroundColor: colors.primary, borderColor: colors.background },
              ]}
            >
              <Feather name="camera" size={14} color="#fff" />
            </View>
          </Pressable>

          <View style={styles.avatarActions}>
            <Pressable
              onPress={handlePickPhoto}
              style={[
                styles.avatarActionBtn,
                {
                  backgroundColor: colors.muted,
                  borderColor: colors.separator,
                },
              ]}
            >
              <Feather name="image" size={14} color={colors.foreground} />
              <Text
                style={[
                  styles.avatarActionText,
                  { color: colors.foreground },
                ]}
              >
                {showAvatar ? "Change photo" : "Add photo"}
              </Text>
            </Pressable>
            {showAvatar ? (
              <Pressable
                onPress={handleRemovePhoto}
                style={[
                  styles.avatarActionBtn,
                  {
                    backgroundColor: "transparent",
                    borderColor: colors.separator,
                  },
                ]}
              >
                <Feather name="trash-2" size={14} color="#dc2626" />
                <Text
                  style={[styles.avatarActionText, { color: "#dc2626" }]}
                >
                  Remove
                </Text>
              </Pressable>
            ) : null}
          </View>
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

        {user?.isAdmin ? (
        <Pressable
          onPress={async () => {
            const url = getAdminUrl();
            try {
              await Linking.openURL(url);
            } catch {
              Alert.alert("Could not open admin page", url);
            }
          }}
          style={({ pressed }) => [
            styles.adminRow,
            {
              backgroundColor: colors.card,
              borderColor: colors.separator,
              opacity: pressed ? 0.85 : 1,
            },
          ]}
        >
          <View
            style={[
              styles.adminIcon,
              { backgroundColor: colors.muted },
            ]}
          >
            <Feather
              name="external-link"
              size={16}
              color={colors.foreground}
            />
          </View>
          <View style={{ flex: 1 }}>
            <Text style={[styles.adminTitle, { color: colors.foreground }]}>
              Manage club codes
            </Text>
            <Text
              style={[
                styles.adminSub,
                { color: colors.mutedForeground },
              ]}
            >
              Opens the admin page in your browser
            </Text>
          </View>
          <Feather
            name="chevron-right"
            size={18}
            color={colors.mutedForeground}
          />
        </Pressable>
        ) : null}

        <Pressable
          onPress={() => setFeedbackOpen(true)}
          style={({ pressed }) => [
            styles.adminRow,
            {
              backgroundColor: colors.card,
              borderColor: colors.separator,
              opacity: pressed ? 0.85 : 1,
            },
          ]}
        >
          <View style={[styles.adminIcon, { backgroundColor: colors.muted }]}>
            <Feather name="message-square" size={16} color={colors.foreground} />
          </View>
          <View style={{ flex: 1 }}>
            <Text style={[styles.adminTitle, { color: colors.foreground }]}>
              Send feedback
            </Text>
            <Text style={[styles.adminSub, { color: colors.mutedForeground }]}>
              Bugs, ideas, anything on your mind
            </Text>
          </View>
          <Feather name="chevron-right" size={18} color={colors.mutedForeground} />
        </Pressable>

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
      <FeedbackModal visible={feedbackOpen} onClose={() => setFeedbackOpen(false)} />
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
  avatarColumn: {
    alignItems: "center",
    gap: 12,
    marginBottom: 4,
  },
  avatar: {
    width: 96,
    height: 96,
    borderRadius: 48,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
    overflow: "visible",
  },
  avatarImage: {
    width: "100%",
    height: "100%",
    borderRadius: 48,
  },
  avatarText: {
    fontSize: 36,
    fontFamily: "Inter_700Bold",
  },
  cameraBadge: {
    position: "absolute",
    bottom: -2,
    right: -2,
    width: 30,
    height: 30,
    borderRadius: 15,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 2,
  },
  avatarActions: {
    flexDirection: "row",
    gap: 8,
  },
  avatarActionBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 100,
    borderWidth: 1,
  },
  avatarActionText: {
    fontSize: 12,
    fontFamily: "Inter_600SemiBold",
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
  adminRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    paddingHorizontal: 14,
    paddingVertical: 12,
    borderRadius: 12,
    borderWidth: 1,
    marginTop: 4,
  },
  adminIcon: {
    width: 32,
    height: 32,
    borderRadius: 16,
    alignItems: "center",
    justifyContent: "center",
  },
  adminTitle: {
    fontSize: 14,
    fontFamily: "Inter_600SemiBold",
  },
  adminSub: {
    fontSize: 12,
    fontFamily: "Inter_400Regular",
    marginTop: 2,
  },
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
