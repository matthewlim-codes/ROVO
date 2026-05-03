import AsyncStorage from "@react-native-async-storage/async-storage";
import { Redirect } from "expo-router";
import React, { useEffect, useState } from "react";
import { ActivityIndicator, View } from "react-native";

import { useAuth } from "@/context/AuthContext";
import { useColors } from "@/hooks/useColors";

export default function Index() {
  const { user, isLoading } = useAuth();
  const colors = useColors();
  const [onboardingChecked, setOnboardingChecked] = useState(false);
  const [onboardingDone, setOnboardingDone] = useState(false);

  useEffect(() => {
    AsyncStorage.getItem("rsg_onboarding_done")
      .then((val) => {
        setOnboardingDone(val === "1");
        setOnboardingChecked(true);
      })
      .catch(() => {
        setOnboardingDone(true);
        setOnboardingChecked(true);
      });
  }, []);

  if (isLoading || !onboardingChecked) {
    return (
      <View style={{ flex: 1, alignItems: "center", justifyContent: "center", backgroundColor: colors.background }}>
        <ActivityIndicator color={colors.primary} size="large" />
      </View>
    );
  }

  if (!user) {
    return <Redirect href="/login" />;
  }

  if (!onboardingDone) {
    return <Redirect href="/onboarding" />;
  }

  if (!user.clubCodeEntered) {
    return <Redirect href="/club-code" />;
  }

  return <Redirect href="/tournaments" />;
}
