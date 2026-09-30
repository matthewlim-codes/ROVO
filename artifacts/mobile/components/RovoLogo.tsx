import React from "react";
import {
  Image,
  StyleSheet,
  View,
  type ImageStyle,
  type StyleProp,
  type ViewStyle,
} from "react-native";

type Props = {
  size?: number;
  style?: StyleProp<ViewStyle>;
  imageStyle?: StyleProp<ImageStyle>;
};

export function RovoLogo({ size = 88, style, imageStyle }: Props) {
  const radius = Math.round(size * 0.2);
  return (
    <View
      style={[
        styles.wrap,
        { width: size, height: size, borderRadius: radius },
        style,
      ]}
    >
      <Image
        source={require("../assets/images/rovo-logo.png")}
        style={[{ width: size, height: size }, imageStyle]}
        resizeMode="cover"
        accessibilityLabel="Rovo"
      />
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    overflow: "hidden",
    backgroundColor: "#000",
  },
});
