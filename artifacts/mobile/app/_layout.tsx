import {
  Inter_400Regular,
  Inter_500Medium,
  Inter_600SemiBold,
  Inter_700Bold,
  useFonts,
} from "@expo-google-fonts/inter";
import { PlusJakartaSans_700Bold } from "@expo-google-fonts/plus-jakarta-sans";
import { ClerkProvider, ClerkLoaded, ClerkLoading } from "@clerk/expo";
import { tokenCache } from "@clerk/expo/token-cache";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { Stack, router } from "expo-router";
import * as Notifications from "expo-notifications";
import * as SplashScreen from "expo-splash-screen";
import React, { useEffect } from "react";
import { ActivityIndicator, View } from "react-native";
import { GestureHandlerRootView } from "react-native-gesture-handler";
import { SafeAreaProvider } from "react-native-safe-area-context";

import { ErrorBoundary } from "@/components/ErrorBoundary";
import { NotificationBanner } from "@/components/NotificationBanner";
import { AuthProvider } from "@/context/AuthContext";
import { NotificationsProvider } from "@/context/NotificationsContext";
import { TripProvider } from "@/context/TripContext";

SplashScreen.preventAutoHideAsync();

const queryClient = new QueryClient();

const publishableKey = process.env.EXPO_PUBLIC_CLERK_PUBLISHABLE_KEY ?? "";

function NotificationDeepLinkHandler() {
  useEffect(() => {
    const sub = Notifications.addNotificationResponseReceivedListener((response) => {
      const data = response.notification.request.content.data as Record<string, unknown> | undefined;
      const groupId = data?.groupId;
      if (typeof groupId === "string" && groupId) {
        router.push(`/chat/${encodeURIComponent(groupId)}`);
      }
    });
    return () => sub.remove();
  }, []);
  return null;
}

function RootLayoutNav() {
  return (
    <>
      <NotificationDeepLinkHandler />
      <Stack screenOptions={{ headerShown: false }}>
        <Stack.Screen name="index" />
        <Stack.Screen name="onboarding" />
        <Stack.Screen name="login" />
        <Stack.Screen name="sign-up" />
        <Stack.Screen name="club-code" />
        <Stack.Screen name="tournaments" />
        <Stack.Screen name="edit-profile" />
        <Stack.Screen name="travel-info" />
        <Stack.Screen name="matches" />
        <Stack.Screen name="rideshare-matches" />
        <Stack.Screen name="chat/[groupId]" />
        <Stack.Screen name="conversations" />
      </Stack>
    </>
  );
}

export default function RootLayout() {
  const [fontsLoaded, fontError] = useFonts({
    Inter_400Regular,
    Inter_500Medium,
    Inter_600SemiBold,
    Inter_700Bold,
    PlusJakartaSans_700Bold,
  });

  useEffect(() => {
    if (fontsLoaded || fontError) {
      SplashScreen.hideAsync();
    }
  }, [fontsLoaded, fontError]);

  if (!fontsLoaded && !fontError) {
    return <View style={{ flex: 1, backgroundColor: "#fff" }} />;
  }

  return (
    <SafeAreaProvider>
      <ErrorBoundary>
        <ClerkProvider publishableKey={publishableKey} tokenCache={tokenCache}>
          <ClerkLoading>
            <View style={{ flex: 1, alignItems: "center", justifyContent: "center", backgroundColor: "#fff" }}>
              <ActivityIndicator size="large" color="#6366F1" />
            </View>
          </ClerkLoading>
          <ClerkLoaded>
            <QueryClientProvider client={queryClient}>
              <GestureHandlerRootView style={{ flex: 1 }}>
                <AuthProvider>
                  <NotificationsProvider>
                    <TripProvider>
                      <NotificationBanner />
                      <RootLayoutNav />
                    </TripProvider>
                  </NotificationsProvider>
                </AuthProvider>
              </GestureHandlerRootView>
            </QueryClientProvider>
          </ClerkLoaded>
        </ClerkProvider>
      </ErrorBoundary>
    </SafeAreaProvider>
  );
}
