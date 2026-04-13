import React, { forwardRef } from "react";
import {
  StyleSheet,
  Text,
  TextInput,
  TextInputProps,
  View,
  ViewStyle,
} from "react-native";

import { useColors } from "@/hooks/useColors";

interface InputProps extends TextInputProps {
  label?: string;
  error?: string;
  containerStyle?: ViewStyle;
  leftIcon?: React.ReactNode;
  rightIcon?: React.ReactNode;
}

export const Input = forwardRef<TextInput, InputProps>(function Input(
  { label, error, containerStyle, leftIcon, rightIcon, style, ...props },
  ref
) {
  const colors = useColors();

  return (
    <View style={[styles.container, containerStyle]}>
      {label && (
        <Text style={[styles.label, { color: colors.mutedForeground }]}>
          {label}
        </Text>
      )}
      <View
        style={[
          styles.inputRow,
          {
            backgroundColor: colors.input,
            borderColor: error ? colors.destructive : "transparent",
            borderRadius: 12,
          },
          error && { borderWidth: 1.5 },
        ]}
      >
        {leftIcon && <View style={styles.iconLeft}>{leftIcon}</View>}
        <TextInput
          ref={ref}
          style={[
            styles.input,
            {
              color: colors.foreground,
              fontFamily: "Inter_400Regular",
              paddingLeft: leftIcon ? 0 : 16,
              paddingRight: rightIcon ? 0 : 16,
            },
            style,
          ]}
          placeholderTextColor={colors.mutedForeground}
          {...props}
        />
        {rightIcon && <View style={styles.iconRight}>{rightIcon}</View>}
      </View>
      {error && (
        <Text style={[styles.error, { color: colors.destructive }]}>
          {error}
        </Text>
      )}
    </View>
  );
});

const styles = StyleSheet.create({
  container: {
    gap: 8,
  },
  label: {
    fontSize: 13,
    fontFamily: "Inter_500Medium",
  },
  inputRow: {
    flexDirection: "row",
    alignItems: "center",
    height: 52,
  },
  iconLeft: {
    paddingLeft: 14,
    paddingRight: 10,
  },
  iconRight: {
    paddingRight: 14,
    paddingLeft: 10,
  },
  input: {
    flex: 1,
    fontSize: 16,
    height: "100%",
  },
  error: {
    fontSize: 12,
    fontFamily: "Inter_400Regular",
  },
});
