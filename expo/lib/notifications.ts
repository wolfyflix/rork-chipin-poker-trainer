import * as Notifications from "expo-notifications";
import { Platform } from "react-native";
import AsyncStorage from "@react-native-async-storage/async-storage";

/**
 * Push Notifications module — daily streak reminders.
 * Uses expo-notifications for local scheduled notifications.
 * No server needed — everything is scheduled on-device.
 */

const STREAK_REMINDER_ID = "@chipin_streak_reminder";
const NOTIF_ENABLED_KEY = "@chipin_notif_enabled";

/** Configure notification behavior (call once at app start). */
Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: true,
    shouldPlaySound: true,
    shouldSetBadge: false,
    shouldShowBanner: true,
    shouldShowList: true,
  }),
});

/** Request notification permissions. Returns true if granted. */
export async function requestNotificationPermission(): Promise<boolean> {
  try {
    const { status: existing } = await Notifications.getPermissionsAsync();
    if (existing === "granted") return true;
    const { status } = await Notifications.requestPermissionsAsync();
    return status === "granted";
  } catch {
    return false;
  }
}

/** Check if notifications are enabled. */
export async function isNotificationsEnabled(): Promise<boolean> {
  try {
    const val = await AsyncStorage.getItem(NOTIF_ENABLED_KEY);
    return val === "true";
  } catch {
    return false;
  }
}

/** Enable daily streak reminder notifications at 6 PM local time. */
export async function enableStreakReminders(): Promise<boolean> {
  const granted = await requestNotificationPermission();
  if (!granted) return false;

  // Cancel any existing reminder
  await disableStreakReminders();

  // Schedule a daily reminder at 6 PM
  await Notifications.scheduleNotificationAsync({
    content: {
      title: "🔥 Don't lose your streak!",
      body: "One quick lesson keeps your streak alive. Tap to play now.",
      data: { screen: "learn" },
    },
    trigger: {
      type: "calendar",
      hour: 18,
      minute: 0,
      repeats: true,
    } as Notifications.CalendarTriggerInput,
  });

  await AsyncStorage.setItem(NOTIF_ENABLED_KEY, "true");
  return true;
}

/** Disable all scheduled streak reminders. */
export async function disableStreakReminders(): Promise<void> {
  try {
    const scheduled = await Notifications.getAllScheduledNotificationsAsync();
    for (const notif of scheduled) {
      if (notif.content.data?.screen === "learn") {
        await Notifications.cancelScheduledNotificationAsync(notif.identifier);
      }
    }
    await AsyncStorage.setItem(NOTIF_ENABLED_KEY, "false");
  } catch {
    /* ignore */
  }
}

/** Send an immediate test notification. */
export async function sendTestNotification(): Promise<void> {
  await Notifications.scheduleNotificationAsync({
    content: {
      title: "🃏 ChipIn",
      body: "Notifications are on! We'll remind you to keep your streak alive.",
      data: { screen: "learn" },
    },
    trigger: null,
  });
}
