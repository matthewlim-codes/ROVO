import { Platform } from "react-native";
import * as Device from "expo-device";
import * as Notifications from "expo-notifications";

import { apiFetch } from "./api";

Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowBanner: true,
    shouldShowList: true,
    shouldPlaySound: true,
    shouldSetBadge: false,
  }),
});

export async function registerForPushAndUpload(userId: string): Promise<string | null> {
  try {
    if (Platform.OS === "web" || !Device.isDevice) return null;

    const { status: existing } = await Notifications.getPermissionsAsync();
    let granted = existing;
    if (existing !== "granted") {
      const req = await Notifications.requestPermissionsAsync();
      granted = req.status;
    }
    if (granted !== "granted") return null;

    if (Platform.OS === "android") {
      await Notifications.setNotificationChannelAsync("default", {
        name: "default",
        importance: Notifications.AndroidImportance.DEFAULT,
      });
    }

    const tokenResp = await Notifications.getExpoPushTokenAsync();
    const token = tokenResp.data;
    if (!token) return null;

    await apiFetch("/push-tokens", {
      method: "POST",
      body: JSON.stringify({ token, userId, platform: Platform.OS }),
    });
    return token;
  } catch {
    return null;
  }
}
