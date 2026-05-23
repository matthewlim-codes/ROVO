import { useClerk } from "@clerk/expo";
import { router } from "expo-router";
import * as WebBrowser from "expo-web-browser";
import React, { useEffect } from "react";
import { ActivityIndicator, Platform, StyleSheet, View } from "react-native";

WebBrowser.maybeCompleteAuthSession();

export default function SSOCallbackScreen() {
  const clerk = useClerk();

  useEffect(() => {
    if (Platform.OS !== "web") {
      router.replace("/");
      return;
    }

    void clerk
      .handleRedirectCallback({
        signInForceRedirectUrl: "/",
        signUpForceRedirectUrl: "/",
      })
      .catch(() => {
        router.replace("/login");
      });
  }, [clerk]);

  return (
    <View style={styles.container}>
      <ActivityIndicator size="large" color="#6366F1" />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#fff",
  },
});
