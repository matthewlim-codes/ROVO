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
  variant?: "primary" | "secondary" | "ghost" | "danger";
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
        ? colors.secondary
        : variant === "danger"
          ? colors.destructive
          : "transparent";

  const textColor =
    variant === "ghost" ? colors.primary : colors.primaryForeground;

  const height = size === "sm" ? 40 : size === "lg" ? 60 : 52;
  const fontSize = size === "sm" ? 14 : size === "lg" ? 18 : 16;

  return (
    <Pressable
      onPress={handlePress}
      disabled={disabled || loading}
      style={({ pressed }) => [
        styles.base,
        {
          backgroundColor: bgColor,
          height,
          borderRadius: colors.radius,
          opacity: pressed || disabled ? 0.7 : 1,
        },
        variant === "ghost" && {
          borderWidth: 1.5,
          borderColor: colors.primary,
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
    paddingHorizontal: 20,
  },
  text: {
    fontFamily: "Inter_600SemiBold",
    letterSpacing: 0.2,
  },
});
