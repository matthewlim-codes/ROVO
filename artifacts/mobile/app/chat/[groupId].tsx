import { Feather } from "@expo/vector-icons";
import { router, useLocalSearchParams } from "expo-router";
import { KeyboardAvoidingView } from "react-native-keyboard-controller";
import React, { useEffect, useRef, useState } from "react";
import {
  FlatList,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { useAuth } from "@/context/AuthContext";
import { ChatMessage, useTrip } from "@/context/TripContext";
import { useColors } from "@/hooks/useColors";
import { formatMessageTime } from "@/utils/time";

export default function ChatScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const { groupId } = useLocalSearchParams<{ groupId: string }>();
  const { user } = useAuth();
  const { loadMessages, sendMessage, trips, selectedTournament } = useTrip();

  const [text, setText] = useState("");
  const [sending, setSending] = useState(false);
  const inputRef = useRef<TextInput>(null);

  const messages = loadMessages(groupId ?? "");

  const groupTrips = trips.filter((t) => {
    const key = `${t.tournamentId}-${t.airport}-${t.hotelPlaceId || t.hotel}-${t.mode}`;
    return key === groupId;
  });

  const familyCount = new Set(groupTrips.map((t) => t.userId)).size;

  useEffect(() => {
    if (messages.length === 0 && groupTrips.length > 0) {
      const first = groupTrips[0];
      sendMessage(groupId ?? "", {
        groupId: groupId ?? "",
        senderId: "system",
        senderName: "ReadySetGo",
        text: `Group created for ${first.airport} → ${first.hotel} (${first.mode}). ${familyCount} ${familyCount === 1 ? "family" : "families"} in this group. Coordinate your ride!`,
        timestamp: new Date().toISOString(),
      });
    }
  }, []);

  const handleSend = async () => {
    const trimmed = text.trim();
    if (!trimmed || !user) return;
    setSending(true);
    setText("");
    await sendMessage(groupId ?? "", {
      groupId: groupId ?? "",
      senderId: user.id,
      senderName: user.name,
      text: trimmed,
      timestamp: new Date().toISOString(),
    });
    setSending(false);
    inputRef.current?.focus();
  };

  const renderMessage = ({ item }: { item: ChatMessage }) => {
    const isMe = item.senderId === user?.id;
    const isSystem = item.senderId === "system";

    if (isSystem) {
      return (
        <View style={styles.systemMsg}>
          <Text style={[styles.systemText, { color: colors.mutedForeground }]}>
            {item.text}
          </Text>
        </View>
      );
    }

    return (
      <View style={[styles.msgRow, isMe && styles.msgRowMe]}>
        {!isMe && (
          <View style={[styles.avatar, { backgroundColor: colors.accent }]}>
            <Text style={[styles.avatarText, { color: colors.orange }]}>
              {item.senderName.charAt(0).toUpperCase()}
            </Text>
          </View>
        )}
        <View style={{ maxWidth: "75%", gap: 3 }}>
          {!isMe && (
            <Text style={[styles.senderName, { color: colors.mutedForeground }]}>
              {item.senderName}
            </Text>
          )}
          <View
            style={[
              styles.bubble,
              {
                backgroundColor: isMe ? colors.primary : colors.card,
                borderRadius: colors.radius,
                borderBottomRightRadius: isMe ? 4 : colors.radius,
                borderBottomLeftRadius: isMe ? colors.radius : 4,
              },
            ]}
          >
            <Text style={[styles.bubbleText, { color: isMe ? "#fff" : colors.foreground }]}>
              {item.text}
            </Text>
          </View>
          <Text style={[styles.timestamp, { color: colors.mutedForeground }, isMe && { textAlign: "right" }]}>
            {formatMessageTime(item.timestamp)}
          </Text>
        </View>
      </View>
    );
  };

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <View
        style={[
          styles.header,
          {
            backgroundColor: colors.navy,
            paddingTop: insets.top + (Platform.OS === "web" ? 67 : 0),
          },
        ]}
      >
        <Pressable
          onPress={() => router.back()}
          style={[styles.backBtn, { backgroundColor: "rgba(255,255,255,0.15)" }]}
        >
          <Feather name="arrow-left" size={20} color="#fff" />
        </Pressable>
        <View style={{ flex: 1 }}>
          <Text style={styles.headerTitle}>
            {familyCount} {familyCount === 1 ? "Family" : "Families"} in Group
          </Text>
          <Text style={styles.headerSub} numberOfLines={1}>
            {groupTrips[0]?.airport} — {groupTrips[0]?.hotel}
          </Text>
        </View>
        <View
          style={[
            styles.onlineBadge,
            { backgroundColor: "rgba(255,255,255,0.15)" },
          ]}
        >
          <View style={[styles.onlineDot, { backgroundColor: colors.success }]} />
          <Text style={styles.onlineText}>{familyCount}</Text>
        </View>
      </View>

      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior="padding"
        keyboardVerticalOffset={0}
      >
        <FlatList
          data={[...messages].reverse()}
          keyExtractor={(item) => item.id}
          renderItem={renderMessage}
          inverted
          contentContainerStyle={[
            styles.messageList,
            {
              paddingBottom: 8,
            },
          ]}
          showsVerticalScrollIndicator={false}
          keyboardDismissMode="interactive"
          keyboardShouldPersistTaps="handled"
        />

        <View
          style={[
            styles.inputContainer,
            {
              backgroundColor: colors.card,
              borderTopColor: colors.border,
              paddingBottom:
                insets.bottom + (Platform.OS === "web" ? 34 : 0),
            },
          ]}
        >
          <TextInput
            ref={inputRef}
            style={[
              styles.textInput,
              {
                backgroundColor: colors.muted,
                color: colors.foreground,
                borderRadius: 24,
                borderColor: colors.border,
              },
            ]}
            placeholder="Message..."
            placeholderTextColor={colors.mutedForeground}
            value={text}
            onChangeText={setText}
            multiline
            maxLength={500}
            onSubmitEditing={Platform.OS === "web" ? handleSend : undefined}
          />
          <Pressable
            onPress={handleSend}
            disabled={!text.trim() || sending}
            style={({ pressed }) => [
              styles.sendBtn,
              {
                backgroundColor:
                  text.trim() ? colors.primary : colors.muted,
                opacity: pressed ? 0.8 : 1,
              },
            ]}
          >
            <Feather
              name="send"
              size={18}
              color={text.trim() ? "#fff" : colors.mutedForeground}
            />
          </Pressable>
        </View>
      </KeyboardAvoidingView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  header: {
    flexDirection: "row",
    alignItems: "flex-end",
    gap: 12,
    paddingHorizontal: 20,
    paddingBottom: 16,
  },
  backBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: "center",
    justifyContent: "center",
  },
  headerTitle: {
    fontSize: 16,
    fontFamily: "Inter_700Bold",
    color: "#fff",
  },
  headerSub: {
    fontSize: 12,
    fontFamily: "Inter_400Regular",
    color: "rgba(255,255,255,0.7)",
  },
  onlineBadge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 20,
  },
  onlineDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  onlineText: {
    fontSize: 13,
    fontFamily: "Inter_600SemiBold",
    color: "#fff",
  },
  messageList: {
    padding: 16,
    gap: 16,
    flexGrow: 1,
  },
  msgRow: {
    flexDirection: "row",
    gap: 10,
    alignItems: "flex-end",
  },
  msgRowMe: {
    flexDirection: "row-reverse",
  },
  avatar: {
    width: 32,
    height: 32,
    borderRadius: 16,
    alignItems: "center",
    justifyContent: "center",
  },
  avatarText: {
    fontSize: 14,
    fontFamily: "Inter_700Bold",
  },
  senderName: {
    fontSize: 11,
    fontFamily: "Inter_500Medium",
    paddingHorizontal: 4,
  },
  bubble: {
    paddingHorizontal: 14,
    paddingVertical: 10,
  },
  bubbleText: {
    fontSize: 15,
    fontFamily: "Inter_400Regular",
    lineHeight: 22,
  },
  timestamp: {
    fontSize: 10,
    fontFamily: "Inter_400Regular",
    paddingHorizontal: 4,
  },
  systemMsg: {
    alignItems: "center",
    paddingHorizontal: 20,
    marginVertical: 4,
  },
  systemText: {
    fontSize: 12,
    fontFamily: "Inter_400Regular",
    textAlign: "center",
    lineHeight: 18,
  },
  inputContainer: {
    flexDirection: "row",
    alignItems: "flex-end",
    gap: 10,
    padding: 12,
    paddingHorizontal: 16,
    borderTopWidth: 1,
  },
  textInput: {
    flex: 1,
    minHeight: 44,
    maxHeight: 120,
    paddingHorizontal: 16,
    paddingVertical: 10,
    fontSize: 15,
    fontFamily: "Inter_400Regular",
    borderWidth: 1,
  },
  sendBtn: {
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: "center",
    justifyContent: "center",
  },
});
