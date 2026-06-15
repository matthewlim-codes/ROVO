import AsyncStorage from "@react-native-async-storage/async-storage";
import { Redirect } from "expo-router";
import React, { useEffect, useState } from "react";
import { ActivityIndicator, View } from "react-native";

import { useAuth } from "@/context/AuthContext";
import { useColors } from "@/hooks/useColors";
import { PENDING_JOIN_SHARE_KEY } from "@/utils/tripShare";

export default function Index() {
  const { user, isLoading } = useAuth();
  const colors = useColors();
  const [onboardingChecked, setOnboardingChecked] = useState(false);
  const [onboardingDone, setOnboardingDone] = useState(false);
  const [pendingShareId, setPendingShareId] = useState<string | null>(null);

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

  useEffect(() => {
    if (!user?.clubCodeEntered) return;
    AsyncStorage.getItem(PENDING_JOIN_SHARE_KEY)
      .then((value) => {
        if (value) {
          setPendingShareId(value);
          AsyncStorage.removeItem(PENDING_JOIN_SHARE_KEY).catch(() => {});
        }
      })
      .catch(() => {});
  }, [user?.clubCodeEntered]);

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

  if (pendingShareId) {
    return <Redirect href={`/trip/${encodeURIComponent(pendingShareId)}`} />;
  }

  return <Redirect href="/tournaments" />;
}
