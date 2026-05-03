import AsyncStorage from "@react-native-async-storage/async-storage";
import { Feather } from "@expo/vector-icons";
import { router } from "expo-router";
import React, { useRef, useState } from "react";
import {
  Dimensions,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { useColors } from "@/hooks/useColors";

const { width: SCREEN_WIDTH } = Dimensions.get("window");

const SLIDES = [
  {
    icon: "map-pin" as const,
    title: "Save your trip",
    body: "Enter your flight details — arrival or departure airport, hotel, and time. Takes 30 seconds.",
  },
  {
    icon: "users" as const,
    title: "Get matched",
    body: "Rovo finds other families from your tournament arriving or leaving around the same time from the same airport.",
  },
  {
    icon: "message-circle" as const,
    title: "Coordinate together",
    body: "Message your matches directly to split a ride, share hotel tips, or connect with your volleyball community.",
  },
];

async function completeOnboarding() {
  await AsyncStorage.setItem("rsg_onboarding_done", "1");
  router.replace("/");
}

export default function OnboardingScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const scrollRef = useRef<ScrollView>(null);
  const [currentIndex, setCurrentIndex] = useState(0);

  const goNext = async () => {
    if (currentIndex < SLIDES.length - 1) {
      const next = currentIndex + 1;
      scrollRef.current?.scrollTo({ x: SCREEN_WIDTH * next, animated: true });
      setCurrentIndex(next);
    } else {
      await completeOnboarding();
    }
  };

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <View style={[styles.topBar, { paddingTop: insets.top + (Platform.OS === "web" ? 67 : 0) + 12 }]}>
        <View style={styles.logoWrap}>
          <View style={[styles.logoPill, { backgroundColor: colors.primary }]}>
            <Text style={styles.logoText}>ROVO</Text>
          </View>
        </View>
        {currentIndex < SLIDES.length - 1 && (
          <Pressable onPress={completeOnboarding} hitSlop={16}>
            <Text style={[styles.skipText, { color: colors.mutedForeground }]}>Skip</Text>
          </Pressable>
        )}
      </View>

      <ScrollView
        ref={scrollRef}
        horizontal
        pagingEnabled
        scrollEnabled={false}
        showsHorizontalScrollIndicator={false}
        style={{ flex: 1 }}
      >
        {SLIDES.map((s, i) => (
          <View key={i} style={[styles.slide, { width: SCREEN_WIDTH }]}>
            <View style={[styles.iconCircle, { backgroundColor: colors.accentSurface }]}>
              <Feather name={s.icon} size={52} color={colors.accent} />
            </View>
            <Text style={[styles.title, { color: colors.foreground }]}>{s.title}</Text>
            <Text style={[styles.body, { color: colors.mutedForeground }]}>{s.body}</Text>
          </View>
        ))}
      </ScrollView>

      <View
        style={[
          styles.footer,
          {
            paddingBottom: insets.bottom + (Platform.OS === "web" ? 34 : 0) + 32,
          },
        ]}
      >
        <View style={styles.dots}>
          {SLIDES.map((_, i) => (
            <View
              key={i}
              style={[
                styles.dot,
                {
                  backgroundColor: i === currentIndex ? colors.primary : colors.muted,
                  width: i === currentIndex ? 22 : 8,
                },
              ]}
            />
          ))}
        </View>

        <Pressable
          onPress={goNext}
          style={({ pressed }) => [
            styles.btn,
            {
              backgroundColor: colors.primary,
              opacity: pressed ? 0.85 : 1,
              transform: [{ scale: pressed ? 0.97 : 1 }],
            },
          ]}
        >
          <Text style={styles.btnText}>
            {currentIndex < SLIDES.length - 1 ? "Next" : "Get started"}
          </Text>
          <Feather
            name={currentIndex < SLIDES.length - 1 ? "arrow-right" : "check"}
            size={18}
            color="#fff"
          />
        </Pressable>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  topBar: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 24,
    paddingBottom: 8,
  },
  logoWrap: { flex: 1 },
  logoPill: {
    alignSelf: "flex-start",
    paddingHorizontal: 14,
    paddingVertical: 6,
    borderRadius: 100,
  },
  logoText: {
    color: "#fff",
    fontSize: 13,
    fontFamily: "Inter_700Bold",
    letterSpacing: 4,
  },
  skipText: {
    fontSize: 14,
    fontFamily: "Inter_500Medium",
  },
  slide: {
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 40,
    gap: 24,
  },
  iconCircle: {
    width: 128,
    height: 128,
    borderRadius: 64,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 8,
  },
  title: {
    fontSize: 32,
    fontFamily: "Inter_700Bold",
    letterSpacing: -0.8,
    textAlign: "center",
  },
  body: {
    fontSize: 17,
    fontFamily: "Inter_400Regular",
    lineHeight: 26,
    textAlign: "center",
  },
  footer: {
    alignItems: "center",
    paddingHorizontal: 24,
    gap: 24,
  },
  dots: {
    flexDirection: "row",
    gap: 6,
    alignItems: "center",
  },
  dot: {
    height: 8,
    borderRadius: 4,
  },
  btn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    width: "100%",
    justifyContent: "center",
    paddingVertical: 17,
    borderRadius: 100,
  },
  btnText: {
    fontSize: 17,
    fontFamily: "Inter_700Bold",
    color: "#fff",
  },
});
