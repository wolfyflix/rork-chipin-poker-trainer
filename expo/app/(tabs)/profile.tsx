import React, { useCallback, useMemo, useState } from "react";
import { Linking, Pressable, ScrollView, StyleSheet, Switch, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useRouter } from "expo-router";

import ChipIcon from "@/components/ChipIcon";
import DailyGoalBar from "@/components/DailyGoalBar";
import PressButton from "@/components/PressButton";
import TopBar from "@/components/TopBar";
import colors from "@/constants/colors";
import { restorePurchases, isPurchasesConfigured } from "@/lib/revenuecat";
import { enableStreakReminders, disableStreakReminders, isNotificationsEnabled, sendTestNotification } from "@/lib/notifications";
import { loadHandHistory, type HandHistoryEntry } from "@/lib/handHistory";
import { useAuth } from "@/providers/AuthProvider";
import { useGame } from "@/providers/GameProvider";
import { useQuery } from "@tanstack/react-query";

const LIT_DAYS = new Set([9, 10, 12, 15, 16, 17, 22, 23, 24, 25]);
const WEEK_LABELS = ["M", "T", "W", "T", "F", "S", "S"];
const CHIPS_WEEK = [120, 205, 0, 340, 180, 75, 0];

export default function ProfileScreen() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { user, isAuthed, signOut } = useAuth();
  const { chips, streak, completed, biggestPot, pro, usesLeft, lives, openPaywall, refreshProStatus, dailyXp, dailyGoalMet, dailyGoal, playerName, playerHandle, playerAvatar } = useGame();
  const [restoring, setResting] = useState<boolean>(false);
  const [restoreMsg, setRestoreMsg] = useState<string | null>(null);
  const [notifEnabled, setNotifEnabled] = useState<boolean>(false);
  const [notifBusy, setNotifBusy] = useState<boolean>(false);
  const [notifMsg, setNotifMsg] = useState<string | null>(null);

  const maxWeek = useMemo(() => Math.max(...CHIPS_WEEK, 1), []);

  // Load notification setting on mount
  React.useEffect(() => {
    isNotificationsEnabled().then(setNotifEnabled);
  }, []);

  // Load hand history from cloud when authed
  const { data: handHistory } = useQuery<HandHistoryEntry[]>({
    queryKey: ["hand-history", user?.id],
    queryFn: () => (user?.id ? loadHandHistory(user.id, 10) : Promise.resolve([])),
    enabled: !!user?.id,
    staleTime: 30_000,
  });

  const handleRestore = useCallback(async () => {
    if (!isPurchasesConfigured()) {
      setRestoreMsg("Purchases aren't available in this build.");
      setTimeout(() => setRestoreMsg(null), 3000);
      return;
    }
    setResting(true);
    const res = await restorePurchases();
    setResting(false);
    if (res.ok) {
      await refreshProStatus();
      setRestoreMsg("Pro restored 👑 — welcome back.");
    } else if (!res.cancelled) {
      setRestoreMsg(res.error);
    } else {
      setRestoreMsg("No active purchases to restore.");
    }
    setTimeout(() => setRestoreMsg(null), 3000);
  }, [refreshProStatus]);

  const openLink = useCallback((url: string) => {
    Linking.openURL(url).catch(() => {
      setRestoreMsg("Couldn't open the link.");
      setTimeout(() => setRestoreMsg(null), 3000);
    });
  }, []);

  const goToAuth = useCallback(() => {
    router.push("/auth");
  }, [router]);

  const handleSignOut = useCallback(async () => {
    await signOut();
  }, [signOut]);

  const toggleNotifications = useCallback(async () => {
    setNotifBusy(true);
    if (notifEnabled) {
      await disableStreakReminders();
      setNotifEnabled(false);
      setNotifMsg("Streak reminders turned off.");
    } else {
      const ok = await enableStreakReminders();
      if (ok) {
        setNotifEnabled(true);
        setNotifMsg("Streak reminders on! We'll ping you at 6 PM daily.");
      } else {
        setNotifMsg("Couldn't enable notifications — check your settings.");
      }
    }
    setNotifBusy(false);
    setTimeout(() => setNotifMsg(null), 3500);
  }, [notifEnabled]);

  const handleTestNotif = useCallback(async () => {
    await sendTestNotification();
    setNotifMsg("Test notification sent!");
    setTimeout(() => setNotifMsg(null), 3000);
  }, []);

  return (
    <View style={[styles.screen, { paddingTop: insets.top }]}>
      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: 32 }}>
        <TopBar title="Profile" showStreak={false} showChips={false} />

        <View style={styles.head}>
          <View style={styles.ava}>
            <Text style={styles.avaText}>{playerAvatar}</Text>
          </View>
          <View>
            <Text style={styles.name}>{playerName}</Text>
            <Text style={styles.handle}>@{playerHandle} · {isAuthed ? "signed in" : "guest — sign up to save progress"}</Text>
          </View>
        </View>

        <DailyGoalBar />

        <View style={styles.tileGrid}>
          <View style={styles.tile}>
            <Text style={[styles.tileV, { color: colors.hot }]}>🔥 {streak} days</Text>
            <Text style={styles.tileK}>Streak</Text>
          </View>
          <View style={styles.tile}>
            <View style={styles.tileChipRow}>
              <ChipIcon size={16} />
              <Text style={[styles.tileV, { color: colors.chipText }]}>{chips.toLocaleString()}</Text>
            </View>
            <Text style={styles.tileK}>Bankroll</Text>
          </View>
          <View style={styles.tile}>
            <Text style={[styles.tileV, { color: colors.red }]}>{lives}♥</Text>
            <Text style={styles.tileK}>Lives</Text>
          </View>
          <View style={styles.tile}>
            <Text style={[styles.tileV, { color: colors.good }]}>{completed.size}</Text>
            <Text style={styles.tileK}>Lessons done</Text>
          </View>
          <View style={styles.tile}>
            <Text style={[styles.tileV, { color: colors.gold2 }]}>{biggestPot}</Text>
            <Text style={styles.tileK}>Biggest pot won</Text>
          </View>
        </View>

        <View style={styles.panel}>
          <Text style={styles.sectionLabel}>Streak calendar — July</Text>
          <View style={styles.calLabels}>
            {WEEK_LABELS.map((d, i) => (
              <Text key={`${d}-${i}`} style={styles.calLabel}>{d}</Text>
            ))}
          </View>
          <View style={styles.cal}>
            {Array.from({ length: 28 }, (_, i) => (
              <View
                key={i}
                style={[styles.calDay, LIT_DAYS.has(i) && styles.calLit, i === 25 && styles.calToday]}
              />
            ))}
          </View>
        </View>

        <View style={styles.panel}>
          <Text style={styles.sectionLabel}>Chips won this week</Text>
          <View style={styles.chart}>
            {CHIPS_WEEK.map((v, i) => (
              <View key={i} style={styles.chartCol}>
                <Text style={[styles.chartVal, v === 0 && { color: colors.dim }]}>{v || "–"}</Text>
                <View
                  style={[
                    styles.chartBar,
                    { height: Math.max(4, (v / maxWeek) * 72) },
                    v === 0 && styles.chartBarMute,
                  ]}
                />
                <Text style={styles.chartDay}>{WEEK_LABELS[i]}</Text>
              </View>
            ))}
          </View>
        </View>

        <View style={styles.subCard}>
          <View style={styles.subRow}>
            <Text style={styles.subTitle}>{pro ? "👑 ChipIn Pro" : "Free plan"}</Text>
            <View style={pro ? styles.badgePro : styles.badgeFree}>
              <Text style={pro ? styles.badgeProText : styles.badgeFreeText}>{pro ? "ACTIVE" : "FREE"}</Text>
            </View>
          </View>
          <Text style={styles.subCopy}>
            {pro
              ? "Everything unlocked. Unlimited tools. Unlimited lives. Broke insurance armed. You're him."
              : `Unit 1 + ${usesLeft} tool runs left today. Pro removes every limit.`}
          </Text>
          {!pro && <PressButton label="See Pro plans" variant="gold" onPress={() => openPaywall()} testID="see-pro" />}
          <PressButton
            label={restoring ? "Restoring…" : "Restore purchases"}
            variant="ghost"
            onPress={handleRestore}
            disabled={restoring}
            testID="restore-purchases"
          />
          {restoreMsg ? <Text style={styles.restoreMsg}>{restoreMsg}</Text> : null}
        </View>

        {/* Notifications section */}
        <View style={styles.subCard}>
          <Text style={styles.sectionLabel}>Notifications</Text>
          <View style={styles.notifRow}>
            <View style={{ flex: 1 }}>
              <Text style={styles.notifTitle}>🔥 Daily streak reminder</Text>
              <Text style={styles.notifSub}>We'll ping you at 6 PM so you don't lose your streak.</Text>
            </View>
            <Switch
              value={notifEnabled}
              onValueChange={toggleNotifications}
              disabled={notifBusy}
              trackColor={{ false: colors.surface2, true: colors.mintDeep }}
              thumbColor={notifEnabled ? colors.mint2 : colors.muted}
              testID="notif-toggle"
            />
          </View>
          {notifEnabled && (
            <PressButton label="Send test notification" variant="ghost" onPress={handleTestNotif} small />
          )}
          {notifMsg ? <Text style={styles.restoreMsg}>{notifMsg}</Text> : null}
        </View>

        {/* Hand history section */}
        {isAuthed && handHistory && handHistory.length > 0 && (
          <View style={styles.subCard}>
            <Text style={styles.sectionLabel}>Recent Hand History</Text>
            {handHistory.slice(0, 5).map((h) => (
              <View key={h.id} style={styles.handHistoryRow}>
                <View style={{ flex: 1 }}>
                  <Text style={styles.handHistoryWinner}>
                    {h.tie ? `Chop: ${h.winners.join(" + ")}` : `🏆 ${h.winners[0]}`}
                  </Text>
                  <Text style={styles.handHistoryHand}>{h.winning_hand}</Text>
                </View>
                <Text style={styles.handHistoryPlayers}>
                  {h.players.length} players
                </Text>
              </View>
            ))}
          </View>
        )}

        {/* Account section */}
        <View style={styles.subCard}>
          <Text style={styles.sectionLabel}>Account</Text>
          {isAuthed ? (
            <>
              <Text style={styles.accountEmail}>{user?.email ?? "Signed in"}</Text>
              <PressButton label="Sign out" variant="ghost" onPress={handleSignOut} />
            </>
          ) : (
            <>
              <Text style={styles.accountEmail}>Playing as guest</Text>
              <Text style={styles.subCopy}>Create an account to save your progress, sync across devices, and add friends.</Text>
              <PressButton label="Sign up / Sign in" onPress={goToAuth} />
            </>
          )}
        </View>

        <View style={styles.legalRow}>
          <Pressable onPress={() => openLink("https://chipin.app/terms")} testID="terms-link">
            <Text style={styles.legalLink}>Terms of Service</Text>
          </Pressable>
          <Text style={styles.legalDot}>·</Text>
          <Pressable onPress={() => openLink("https://chipin.app/privacy")} testID="privacy-link">
            <Text style={styles.legalLink}>Privacy Policy</Text>
          </Pressable>
        </View>
        <Text style={styles.versionText}>ChipIn v1.0.0 · Made for the home game</Text>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.bg },
  head: { flexDirection: "row", alignItems: "center", gap: 16, paddingHorizontal: 20, paddingVertical: 8 },
  ava: {
    width: 74,
    height: 74,
    borderRadius: 24,
    backgroundColor: colors.table2,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
    borderColor: colors.lineStrong,
  },
  avaText: { fontSize: 36 },
  name: { fontSize: 23, fontFamily: "Outfit_900Black", letterSpacing: -0.5, color: colors.cream },
  handle: { color: colors.muted, fontSize: 13, fontFamily: "Outfit_600SemiBold" },
  tileGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 10,
    marginHorizontal: 16,
    marginTop: 14,
  },
  tile: {
    width: "48%",
    flexGrow: 1,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.line,
    borderRadius: 18,
    padding: 14,
    paddingHorizontal: 16,
  },
  tileChipRow: { flexDirection: "row", alignItems: "center", gap: 7 },
  tileV: { fontSize: 23, fontFamily: "Outfit_900Black", letterSpacing: -0.5, color: colors.cream },
  tileK: {
    fontSize: 10.5,
    fontFamily: "Outfit_800ExtraBold",
    letterSpacing: 1,
    color: colors.muted,
    textTransform: "uppercase",
    marginTop: 2,
  },
  panel: {
    marginHorizontal: 16,
    marginTop: 12,
    padding: 18,
    borderRadius: 24,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.line,
  },
  sectionLabel: {
    fontSize: 11.5,
    fontFamily: "Outfit_800ExtraBold",
    letterSpacing: 1.6,
    color: colors.dim,
    textTransform: "uppercase",
    marginBottom: 10,
  },
  calLabels: { flexDirection: "row", gap: 6, marginBottom: 6 },
  calLabel: {
    flex: 1,
    fontSize: 10,
    fontFamily: "Outfit_800ExtraBold",
    color: colors.dim,
    textAlign: "center",
    letterSpacing: 1,
  },
  cal: { flexDirection: "row", flexWrap: "wrap", gap: 6 },
  calDay: {
    width: "12%",
    flexGrow: 1,
    aspectRatio: 1,
    borderRadius: 8,
    backgroundColor: colors.bg2,
    borderWidth: 1,
    borderColor: colors.line,
  },
  calLit: { backgroundColor: colors.mint, borderColor: colors.mint },
  calToday: { borderWidth: 2, borderColor: colors.mint2 },
  chart: { flexDirection: "row", alignItems: "flex-end", gap: 8, height: 110, paddingTop: 6 },
  chartCol: { flex: 1, alignItems: "center", justifyContent: "flex-end", gap: 6, height: "100%" },
  chartVal: { fontSize: 10, fontFamily: "Outfit_800ExtraBold", color: colors.mint },
  chartBar: { width: "100%", borderRadius: 7, backgroundColor: colors.mintDeep },
  chartBarMute: { backgroundColor: colors.surface2, borderWidth: 1, borderColor: colors.line },
  chartDay: { fontSize: 10, fontFamily: "Outfit_800ExtraBold", color: colors.dim, letterSpacing: 0.5 },
  subCard: {
    marginHorizontal: 16,
    marginTop: 12,
    padding: 18,
    borderRadius: 24,
    borderWidth: 1,
    borderColor: "rgba(233,196,100,0.3)",
    backgroundColor: "rgba(233,196,100,0.07)",
  },
  subRow: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 12 },
  subTitle: { fontFamily: "Outfit_900Black", fontSize: 17, color: colors.cream },
  badgeFree: {
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.line,
    paddingVertical: 5,
    paddingHorizontal: 10,
    borderRadius: 999,
  },
  badgeFreeText: { color: colors.muted, fontSize: 11, fontFamily: "Outfit_800ExtraBold", letterSpacing: 1 },
  badgePro: {
    backgroundColor: colors.gold,
    paddingVertical: 5,
    paddingHorizontal: 10,
    borderRadius: 999,
  },
  badgeProText: { color: "#3B2A05", fontSize: 11, fontFamily: "Outfit_900Black", letterSpacing: 1 },
  subCopy: {
    fontSize: 13,
    color: colors.muted,
    fontFamily: "Outfit_600SemiBold",
    marginBottom: 12,
    lineHeight: 19,
  },
  restoreMsg: {
    textAlign: "center",
    fontSize: 12.5,
    fontFamily: "Outfit_700Bold",
    color: colors.mint2,
    marginTop: 6,
    marginBottom: 4,
  },
  accountEmail: {
    fontSize: 14,
    fontFamily: "Outfit_700Bold",
    color: colors.cream,
    marginBottom: 12,
  },
  legalRow: {
    flexDirection: "row",
    justifyContent: "center",
    alignItems: "center",
    gap: 8,
    marginTop: 16,
  },
  legalLink: {
    fontSize: 12.5,
    fontFamily: "Outfit_700Bold",
    color: colors.mint,
  },
  legalDot: { color: colors.dim, fontSize: 12.5 },
  versionText: {
    textAlign: "center",
    fontSize: 11,
    fontFamily: "Outfit_600SemiBold",
    color: colors.dim,
    marginTop: 6,
    marginBottom: 4,
  },
  notifRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    marginBottom: 8,
  },
  notifTitle: {
    fontSize: 14.5,
    fontFamily: "Outfit_800ExtraBold",
    color: colors.cream,
  },
  notifSub: {
    fontSize: 12,
    color: colors.muted,
    fontFamily: "Outfit_600SemiBold",
    marginTop: 2,
    lineHeight: 17,
  },
  handHistoryRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: colors.line,
  },
  handHistoryWinner: {
    fontSize: 14,
    fontFamily: "Outfit_800ExtraBold",
    color: colors.cream,
  },
  handHistoryHand: {
    fontSize: 12,
    color: colors.muted,
    fontFamily: "Outfit_600SemiBold",
    marginTop: 2,
  },
  handHistoryPlayers: {
    fontSize: 11,
    fontFamily: "Outfit_700Bold",
    color: colors.dim,
  },
});
