import { Feather } from "@expo/vector-icons";
import { router, useLocalSearchParams } from "expo-router";
import React, { useEffect, useRef, useState } from "react";
import {
  FlatList,
  KeyboardAvoidingView,
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
  const { loadMessages, sendMessage, trips } = useTrip();

  const [text, setText] = useState("");
  const [sending, setSending] = useState(false);
  const inputRef = useRef<TextInput>(null);

  const messages = loadMessages(groupId ?? "");

  const groupTrips = trips.filter((t) => {
    const key = `${t.tournamentId}-${t.airport}-${t.hotelPlaceId || t.hotel}-${t.mode}`;
    return key === groupId;
  });

  const familyCount = new Set(groupTrips.map((t) => t.userId)).size;
  const firstTrip = groupTrips[0];

  useEffect(() => {
    if (messages.length === 0 && firstTrip) {
      sendMessage(groupId ?? "", {
        groupId: groupId ?? "",
        senderId: "system",
        senderName: "ReadySetGo",
        text: `${familyCount} ${familyCount === 1 ? "family" : "families"} in this group. Coordinate your ride from ${firstTrip.airport} to ${firstTrip.hotel}.`,
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

  const renderItem = ({ item }: { item: ChatMessage }) => {
    const isMe = item.senderId === user?.id;
    const isSystem = item.senderId === "system";

    if (isSystem) {
      return (
        <View style={styles.systemRow}>
          <View
            style={[
              styles.systemBubble,
              { backgroundColor: colors.muted, borderRadius: 10 },
            ]}
          >
            <Text style={[styles.systemText, { color: colors.mutedForeground }]}>
              {item.text}
            </Text>
          </View>
        </View>
      );
    }

    return (
      <View
        style={[
          styles.msgRow,
          isMe ? styles.msgRowMe : styles.msgRowOther,
        ]}
      >
        {!isMe && (
          <View
            style={[
              styles.avatar,
              { backgroundColor: colors.muted },
            ]}
          >
            <Text style={[styles.avatarLetter, { color: colors.foreground }]}>
              {item.senderName.charAt(0).toUpperCase()}
            </Text>
          </View>
        )}

        <View
          style={[
            styles.bubbleGroup,
            isMe && styles.bubbleGroupMe,
          ]}
        >
          {!isMe && (
            <Text style={[styles.senderName, { color: colors.mutedForeground }]}>
              {item.senderName}
            </Text>
          )}
          <View
            style={[
              styles.bubble,
              isMe
                ? { backgroundColor: colors.primary, borderBottomRightRadius: 4 }
                : {
                    backgroundColor: colors.card,
                    borderBottomLeftRadius: 4,
                  },
              { borderRadius: 18 },
            ]}
          >
            <Text
              style={[
                styles.bubbleText,
                { color: isMe ? "#FFFFFF" : colors.foreground },
              ]}
            >
              {item.text}
            </Text>
          </View>
          <Text
            style={[
              styles.timestamp,
              { color: colors.mutedForeground },
              isMe && styles.timestampMe,
            ]}
          >
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
            backgroundColor: colors.background,
            paddingTop: insets.top + (Platform.OS === "web" ? 67 : 0) + 8,
            borderBottomColor: colors.separator,
          },
        ]}
      >
        <Pressable onPress={() => router.back()} style={styles.backBtn}>
          <Feather name="arrow-left" size={22} color={colors.foreground} />
        </Pressable>
        <View style={{ flex: 1, gap: 2 }}>
          <Text style={[styles.headerTitle, { color: colors.foreground }]}>
            {familyCount} {familyCount === 1 ? "family" : "families"}
          </Text>
          <Text
            style={[styles.headerSub, { color: colors.mutedForeground }]}
            numberOfLines={1}
          >
            {firstTrip?.airport} → {firstTrip?.hotel}
          </Text>
        </View>
        <View
          style={[
            styles.onlinePill,
            { backgroundColor: colors.accentSurface },
          ]}
        >
          <View
            style={[styles.onlineDot, { backgroundColor: colors.accent }]}
          />
          <Text style={[styles.onlineText, { color: colors.accent }]}>
            {familyCount}
          </Text>
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
          renderItem={renderItem}
          inverted
          contentContainerStyle={styles.messageList}
          showsVerticalScrollIndicator={false}
          keyboardDismissMode="interactive"
          keyboardShouldPersistTaps="handled"
        />

        <View
          style={[
            styles.inputBar,
            {
              backgroundColor: colors.background,
              borderTopColor: colors.separator,
              paddingBottom:
                insets.bottom + (Platform.OS === "web" ? 34 : 0) + 4,
            },
          ]}
        >
          <View
            style={[
              styles.inputWrap,
              { backgroundColor: colors.muted, borderRadius: 24 },
            ]}
          >
            <TextInput
              ref={inputRef}
              style={[
                styles.textInput,
                { color: colors.foreground, fontFamily: "Inter_400Regular" },
              ]}
              placeholder="Message..."
              placeholderTextColor={colors.mutedForeground}
              value={text}
              onChangeText={setText}
              multiline
              maxLength={500}
              onSubmitEditing={Platform.OS === "web" ? handleSend : undefined}
            />
          </View>
          <Pressable
            onPress={handleSend}
            disabled={!text.trim() || sending}
            style={({ pressed }) => [
              styles.sendBtn,
              {
                backgroundColor: text.trim()
                  ? colors.primary
                  : colors.muted,
                opacity: pressed ? 0.7 : 1,
              },
            ]}
          >
            <Feather
              name="send"
              size={17}
              color={text.trim() ? "#fff" : colors.mutedForeground}
            />
          </Pressable>
        </View>
      </KeyboardAvoidingView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  header: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    paddingHorizontal: 16,
    paddingBottom: 14,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  backBtn: {
    width: 40,
    height: 40,
    alignItems: "center",
    justifyContent: "center",
  },
  headerTitle: {
    fontSize: 16,
    fontFamily: "Inter_700Bold",
    letterSpacing: -0.3,
  },
  headerSub: {
    fontSize: 12,
    fontFamily: "Inter_400Regular",
  },
  onlinePill: {
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 100,
  },
  onlineDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
  },
  onlineText: {
    fontSize: 13,
    fontFamily: "Inter_600SemiBold",
  },
  messageList: {
    paddingHorizontal: 16,
    paddingVertical: 12,
    gap: 12,
    flexGrow: 1,
  },
  systemRow: {
    alignItems: "center",
    marginVertical: 4,
  },
  systemBubble: {
    maxWidth: "85%",
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  systemText: {
    fontSize: 12,
    fontFamily: "Inter_400Regular",
    textAlign: "center",
    lineHeight: 18,
  },
  msgRow: {
    flexDirection: "row",
    alignItems: "flex-end",
    gap: 8,
  },
  msgRowOther: {
    justifyContent: "flex-start",
  },
  msgRowMe: {
    flexDirection: "row-reverse",
  },
  avatar: {
    width: 30,
    height: 30,
    borderRadius: 15,
    alignItems: "center",
    justifyContent: "center",
  },
  avatarLetter: {
    fontSize: 13,
    fontFamily: "Inter_700Bold",
  },
  bubbleGroup: {
    maxWidth: "75%",
    gap: 3,
    alignItems: "flex-start",
  },
  bubbleGroupMe: {
    alignItems: "flex-end",
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
    lineHeight: 21,
  },
  timestamp: {
    fontSize: 10,
    fontFamily: "Inter_400Regular",
    paddingHorizontal: 4,
  },
  timestampMe: {
    textAlign: "right",
  },
  inputBar: {
    flexDirection: "row",
    alignItems: "flex-end",
    gap: 8,
    paddingHorizontal: 12,
    paddingTop: 10,
    borderTopWidth: StyleSheet.hairlineWidth,
  },
  inputWrap: {
    flex: 1,
    minHeight: 44,
    maxHeight: 120,
    paddingHorizontal: 16,
    paddingVertical: 10,
    justifyContent: "center",
  },
  textInput: {
    fontSize: 15,
  },
  sendBtn: {
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: "center",
    justifyContent: "center",
  },
});
