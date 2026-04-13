import * as Haptics from "expo-haptics";
import React from "react";
import {
  ActivityIndicator,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  ViewStyle,
} from "react-native";

import { useColors } from "@/hooks/useColors";

interface ButtonProps {
  title: string;
  onPress: () => void;
  variant?: "primary" | "secondary" | "ghost" | "success" | "danger";
  loading?: boolean;
  disabled?: boolean;
  style?: ViewStyle;
  size?: "sm" | "md" | "lg";
}

export function Button({
  title,
  onPress,
  variant = "primary",
  loading = false,
  disabled = false,
  style,
  size = "md",
}: ButtonProps) {
  const colors = useColors();

  const handlePress = () => {
    if (Platform.OS !== "web") {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    }
    onPress();
  };

  const bgColor =
    variant === "primary"
      ? colors.primary
      : variant === "secondary"
        ? colors.muted
        : variant === "success"
          ? colors.accent
          : variant === "danger"
            ? colors.destructive
            : "transparent";

  const textColor =
    variant === "secondary"
      ? colors.foreground
      : variant === "ghost"
        ? colors.foreground
        : "#FFFFFF";

  const height = size === "sm" ? 40 : size === "lg" ? 58 : 52;
  const fontSize = size === "sm" ? 14 : size === "lg" ? 17 : 16;

  return (
    <Pressable
      onPress={handlePress}
      disabled={disabled || loading}
      style={({ pressed }) => [
        styles.base,
        {
          backgroundColor: bgColor,
          height,
          borderRadius: height / 2,
          opacity: pressed ? 0.75 : disabled ? 0.4 : 1,
          transform: [{ scale: pressed ? 0.98 : 1 }],
        },
        variant === "ghost" && {
          borderWidth: 1.5,
          borderColor: colors.border,
        },
        style,
      ]}
    >
      {loading ? (
        <ActivityIndicator color={textColor} />
      ) : (
        <Text style={[styles.text, { color: textColor, fontSize }]}>
          {title}
        </Text>
      )}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  base: {
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 24,
  },
  text: {
    fontFamily: "Inter_600SemiBold",
    letterSpacing: 0.1,
  },
});
