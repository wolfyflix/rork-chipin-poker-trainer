import React, { useCallback, useMemo, useRef, useState } from "react";
import { ScrollView, StyleSheet, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import ChipIcon from "@/components/ChipIcon";
import PressButton from "@/components/PressButton";
import TopBar from "@/components/TopBar";
import colors from "@/constants/colors";
import { SQUAD } from "@/lib/curriculum";
import { useGame } from "@/providers/GameProvider";

const MEDALS = ["🥇", "🥈", "🥉"];

export default function SquadScreen() {
  const insets = useSafeAreaInsets();
  const { chips, streak } = useGame();
  const [notice, setNotice] = useState<string | null>(null);
  const noticeTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const leaderboard = useMemo(() => {
    const rows = SQUAD.map((m) => (m.me ? { ...m, chips, st: streak } : m));
    return rows.sort((a, b) => b.chips - a.chips);
  }, [chips, streak]);

  const invite = useCallback(() => {
    setNotice("Invite link copied — send it to the gc 🔗");
    if (noticeTimer.current) clearTimeout(noticeTimer.current);
    noticeTimer.current = setTimeout(() => setNotice(null), 2300);
  }, []);

  return (
    <View style={[styles.screen, { paddingTop: insets.top }]}>
      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: 32 }}>
        <TopBar title="Squad" showChips={false} />
        <View style={styles.leagueBand}>
          <Text style={styles.cup}>🏆</Text>
          <View style={{ flex: 1 }}>
            <Text style={styles.leagueTitle}>The Basement Boys</Text>
            <Text style={styles.leagueSub}>Biggest bankroll Sunday night takes the crown · 5 members</Text>
          </View>
        </View>

        {leaderboard.map((m, i) => (
          <View key={m.n} style={[styles.row, m.me && styles.rowMe]}>
            <Text style={styles.rank}>{MEDALS[i] ?? `#${i + 1}`}</Text>
            <View style={styles.ava}>
              <Text style={styles.avaText}>{m.a}</Text>
            </View>
            <View style={{ flex: 1 }}>
              <Text style={styles.name}>{m.n}</Text>
              <Text style={styles.st}>🔥 {m.st} day streak</Text>
            </View>
            <View style={styles.bankroll}>
              <View style={styles.bankrollRow}>
                <ChipIcon size={11} />
                <Text style={styles.bankrollNum}>{m.chips.toLocaleString()}</Text>
              </View>
              <Text style={styles.bankrollK}>BANKROLL</Text>
            </View>
          </View>
        ))}

        <PressButton label="Invite the group chat 🔗" onPress={invite} style={styles.inviteBtn} testID="invite" />
        <Text style={styles.footer}>Screenshot this when you hit #1. You know you want to.</Text>
      </ScrollView>

      {notice && (
        <View style={[styles.toast, { top: insets.top + 56 }]}>
          <Text style={styles.toastText}>{notice}</Text>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.bg },
  leagueBand: {
    marginHorizontal: 16,
    marginTop: 6,
    marginBottom: 12,
    padding: 16,
    paddingHorizontal: 18,
    borderRadius: 24,
    flexDirection: "row",
    alignItems: "center",
    gap: 14,
    backgroundColor: "rgba(233,196,100,0.09)",
    borderWidth: 1,
    borderColor: "rgba(233,196,100,0.25)",
  },
  cup: { fontSize: 32 },
  leagueTitle: { fontSize: 16, fontFamily: "Outfit_900Black", color: colors.gold2 },
  leagueSub: { fontSize: 12.5, color: colors.muted, fontFamily: "Outfit_600SemiBold", lineHeight: 17 },
  row: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    padding: 13,
    paddingHorizontal: 16,
    marginHorizontal: 16,
    marginVertical: 4,
    borderRadius: 18,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.line,
  },
  rowMe: { borderColor: colors.lineStrong, backgroundColor: "rgba(198,238,199,0.05)" },
  rank: { fontFamily: "Outfit_900Black", fontSize: 16, width: 28, color: colors.dim },
  ava: {
    width: 44,
    height: 44,
    borderRadius: 14,
    backgroundColor: colors.bg2,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
    borderColor: colors.line,
  },
  avaText: { fontSize: 22 },
  name: { fontFamily: "Outfit_800ExtraBold", fontSize: 15, color: colors.cream },
  st: { fontSize: 12, color: colors.muted, fontFamily: "Outfit_600SemiBold" },
  bankroll: { alignItems: "flex-end" },
  bankrollRow: { flexDirection: "row", alignItems: "center", gap: 5 },
  bankrollNum: { fontFamily: "Outfit_900Black", color: colors.gold2, fontSize: 15 },
  bankrollK: { fontSize: 10, color: colors.dim, fontFamily: "Outfit_700Bold", letterSpacing: 1 },
  inviteBtn: { marginHorizontal: 16, marginTop: 16 },
  footer: {
    textAlign: "center",
    color: colors.dim,
    fontSize: 12,
    fontFamily: "Outfit_600SemiBold",
    marginTop: 10,
  },
  toast: {
    position: "absolute",
    alignSelf: "center",
    backgroundColor: "#16281C",
    borderWidth: 1,
    borderColor: colors.lineStrong,
    paddingVertical: 11,
    paddingHorizontal: 18,
    borderRadius: 14,
    zIndex: 60,
  },
  toastText: { color: colors.cream, fontFamily: "Outfit_700Bold", fontSize: 13.5 },
});
