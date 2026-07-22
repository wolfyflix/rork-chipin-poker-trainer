import React, { useCallback, useMemo, useRef, useState } from "react";
import {
  Animated,
  LayoutAnimation,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  UIManager,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import ChipIcon from "@/components/ChipIcon";
import PressButton from "@/components/PressButton";
import TopBar from "@/components/TopBar";
import colors from "@/constants/colors";
import { GLOBAL_SEED, SQUAD } from "@/lib/curriculum";
import { useGame } from "@/providers/GameProvider";

const MEDALS = ["🥇", "🥈", "🥉"];

type Tab = "friends" | "global";

if (Platform.OS === "android" && UIManager.setLayoutAnimationEnabledExperimental) {
  UIManager.setLayoutAnimationEnabledExperimental(true);
}

interface LeaderRow {
  n: string;
  a: string;
  chips: number;
  st: number;
  me?: boolean;
  country?: string;
}

export default function SquadScreen() {
  const insets = useSafeAreaInsets();
  const { chips, streak } = useGame();
  const [tab, setTab] = useState<Tab>("friends");
  const [notice, setNotice] = useState<string | null>(null);
  const [addOpen, setAddOpen] = useState<boolean>(false);
  const [handle, setHandle] = useState<string>("");
  const noticeTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const friendsRows = useMemo<LeaderRow[]>(() => {
    const rows = SQUAD.map((m) => (m.me ? { ...m, chips, st: streak } : m));
    return rows.sort((a, b) => b.chips - a.chips);
  }, [chips, streak]);

  const globalRows = useMemo<LeaderRow[]>(() => {
    // Build a global board around the user's real bankroll so it always feels live.
    const me: LeaderRow = { n: "you", a: "🦈", chips, st: streak, me: true, country: "🇺🇸" };
    const seeded: LeaderRow[] = GLOBAL_SEED.map((g) => ({
      n: g.n,
      a: g.a,
      chips: g.chips,
      st: g.st,
      country: g.cc,
    }));
    const all = [...seeded, me].sort((a, b) => b.chips - a.chips);
    return all;
  }, [chips, streak]);

  const rows = tab === "friends" ? friendsRows : globalRows;
  const myRank = rows.findIndex((r) => r.me) + 1;

  const switchTab = useCallback((t: Tab) => {
    if (t === tab) return;
    LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
    setTab(t);
  }, [tab]);

  const flash = useCallback((msg: string) => {
    setNotice(msg);
    if (noticeTimer.current) clearTimeout(noticeTimer.current);
    noticeTimer.current = setTimeout(() => setNotice(null), 2300);
  }, []);

  const invite = useCallback(() => {
    flash("Invite link copied — send it to the gc 🔗");
  }, [flash]);

  const sendRequest = useCallback(() => {
    const clean = handle.trim().replace(/^@/, "");
    if (!clean) {
      flash("Drop a username first ✋");
      return;
    }
    setAddOpen(false);
    setHandle("");
    flash(`Request sent to @${clean} — they'll see it next open`);
  }, [handle, flash]);

  const podium = rows.slice(0, 3);
  const rest = rows.slice(3);

  return (
    <View style={[styles.screen, { paddingTop: insets.top }]}>
      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: 32 }}>
        <TopBar title="Squad" showChips={false} />

        {/* Tab switcher */}
        <View style={styles.tabBar}>
          <Pressable
            style={[styles.tab, tab === "friends" && styles.tabActive]}
            onPress={() => switchTab("friends")}
            testID="tab-friends"
          >
            <Text style={[styles.tabText, tab === "friends" && styles.tabTextActive]}>🤝 Friends</Text>
          </Pressable>
          <Pressable
            style={[styles.tab, tab === "global" && styles.tabActive]}
            onPress={() => switchTab("global")}
            testID="tab-global"
          >
            <Text style={[styles.tabText, tab === "global" && styles.tabTextActive]}>🌍 Global</Text>
          </Pressable>
        </View>

        {/* League band — changes per tab */}
        <View style={styles.leagueBand}>
          <Text style={styles.cup}>{tab === "friends" ? "🏆" : "🌐"}</Text>
          <View style={{ flex: 1 }}>
            <Text style={styles.leagueTitle}>
              {tab === "friends" ? "The Basement Boys" : "ChipIn Global"}
            </Text>
            <Text style={styles.leagueSub}>
              {tab === "friends"
                ? `Biggest bankroll Sunday night takes the crown · ${SQUAD.length} members`
                : `Top players this week · you're #${myRank || "—"} of ${globalRows.length}`}
            </Text>
          </View>
        </View>

        {/* Podium — top 3 with elevated styling */}
        <View style={styles.podiumRow}>
          {podium.map((m, i) => (
            <View
              key={`${m.n}-${i}`}
              style={[styles.podium, i === 0 && styles.podiumFirst, m.me && styles.podiumMe]}
            >
              <Text style={styles.podiumMedal}>{MEDALS[i]}</Text>
              <View style={[styles.podiumAva, i === 0 && styles.podiumAvaFirst]}>
                <Text style={styles.podiumAvaText}>{m.a}</Text>
              </View>
              <Text style={styles.podiumName} numberOfLines={1}>{m.me ? "you" : m.n}</Text>
              <View style={styles.podiumChips}>
                <ChipIcon size={9} />
                <Text style={styles.podiumChipsNum}>{shortChips(m.chips)}</Text>
              </View>
              {tab === "global" && m.country ? (
                <Text style={styles.podiumCountry}>{m.country}</Text>
              ) : (
                <Text style={styles.podiumStreak}>🔥 {m.st}</Text>
              )}
            </View>
          ))}
        </View>

        {/* Your rank chip (Global only, helps you find yourself) */}
        {tab === "global" && (
          <View style={styles.myRankPill} testID="my-rank">
            <Text style={styles.myRankLabel}>YOUR RANK</Text>
            <Text style={styles.myRankNum}>#{myRank || "—"}</Text>
            <View style={styles.myRankChips}>
              <ChipIcon size={10} />
              <Text style={styles.myRankChipsNum}>{chips.toLocaleString()}</Text>
            </View>
          </View>
        )}

        {/* Rest of the leaderboard */}
        {rest.map((m, i) => {
          const rank = i + 4;
          return (
            <View key={`${m.n}-${i}`} style={[styles.row, m.me && styles.rowMe]}>
              <Text style={styles.rank}>#{rank}</Text>
              <View style={styles.ava}>
                <Text style={styles.avaText}>{m.a}</Text>
              </View>
              <View style={{ flex: 1 }}>
                <Text style={styles.name} numberOfLines={1}>{m.me ? "you" : m.n}</Text>
                <Text style={styles.st}>
                  {tab === "global" && m.country ? `${m.country} · ` : ""}🔥 {m.st} day streak
                </Text>
              </View>
              <View style={styles.bankroll}>
                <View style={styles.bankrollRow}>
                  <ChipIcon size={11} />
                  <Text style={styles.bankrollNum}>{m.chips.toLocaleString()}</Text>
                </View>
                <Text style={styles.bankrollK}>BANKROLL</Text>
              </View>
            </View>
          );
        })}

        {tab === "friends" ? (
          <>
            <PressButton
              label="➕ Add a friend"
              variant="ghost"
              onPress={() => setAddOpen(true)}
              style={styles.addBtn}
              testID="add-friend"
            />
            <PressButton label="Invite the group chat 🔗" onPress={invite} style={styles.inviteBtn} testID="invite" />
            <Text style={styles.footer}>Screenshot this when you hit #1. You know you want to.</Text>
          </>
        ) : (
          <Text style={styles.footer}>
            Global ranks update every Monday · climb by stacking chips in The Table and Arena
          </Text>
        )}
      </ScrollView>

      {/* Add friend sheet */}
      {addOpen && (
        <View style={styles.promptWrap}>
          <Pressable style={styles.backdrop} onPress={() => setAddOpen(false)} />
          <View style={styles.sheet}>
            <Text style={styles.sheetEmoji}>🤝</Text>
            <Text style={styles.sheetTitle}>Add a friend</Text>
            <Text style={styles.sheetCopy}>
              Drop their ChipIn username and we'll send a request. When they accept, they'll show up here and on your Friends leaderboard.
            </Text>
            <View style={styles.inputWrap}>
              <Text style={styles.inputPrefix}>@</Text>
              <TextInput
                style={styles.input}
                placeholder="username"
                placeholderTextColor={colors.dim}
                value={handle}
                onChangeText={setHandle}
                autoCapitalize="none"
                autoCorrect={false}
                returnKeyType="send"
                onSubmitEditing={sendRequest}
                testID="friend-handle"
              />
            </View>
            <PressButton label="Send request" onPress={sendRequest} testID="send-request" />
            <PressButton label="Cancel" variant="ghost" onPress={() => setAddOpen(false)} />
          </View>
        </View>
      )}

      {notice && (
        <View style={[styles.toast, { top: insets.top + 56 }]}>
          <Text style={styles.toastText}>{notice}</Text>
        </View>
      )}
    </View>
  );
}

function shortChips(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1).replace(/\.0$/, "")}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(1).replace(/\.0$/, "")}K`;
  return String(n);
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.bg },
  tabBar: {
    flexDirection: "row",
    marginHorizontal: 16,
    marginTop: 4,
    marginBottom: 12,
    backgroundColor: colors.surface,
    borderRadius: 14,
    padding: 4,
    borderWidth: 1,
    borderColor: colors.line,
  },
  tab: { flex: 1, paddingVertical: 10, alignItems: "center", borderRadius: 10 },
  tabActive: { backgroundColor: colors.mint },
  tabText: {
    fontSize: 13,
    fontFamily: "Outfit_800ExtraBold",
    color: colors.muted,
    letterSpacing: 0.2,
  },
  tabTextActive: { color: colors.mintInk },
  leagueBand: {
    marginHorizontal: 16,
    marginBottom: 14,
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
  podiumRow: {
    flexDirection: "row",
    justifyContent: "center",
    alignItems: "flex-end",
    gap: 10,
    marginHorizontal: 16,
    marginBottom: 14,
  },
  podium: {
    flex: 1,
    alignItems: "center",
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.line,
    borderRadius: 18,
    paddingVertical: 14,
    paddingHorizontal: 6,
    gap: 4,
  },
  podiumFirst: {
    borderColor: "rgba(233,196,100,0.45)",
    backgroundColor: "rgba(233,196,100,0.07)",
    paddingVertical: 18,
  },
  podiumMe: { borderColor: colors.mintDeep, backgroundColor: "rgba(198,238,199,0.08)" },
  podiumMedal: { fontSize: 22 },
  podiumAva: {
    width: 42,
    height: 42,
    borderRadius: 14,
    backgroundColor: colors.bg2,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
    borderColor: colors.line,
  },
  podiumAvaFirst: { width: 52, height: 52, borderRadius: 16, borderColor: "rgba(233,196,100,0.4)" },
  podiumAvaText: { fontSize: 22 },
  podiumName: {
    fontSize: 12.5,
    fontFamily: "Outfit_800ExtraBold",
    color: colors.cream,
    maxWidth: 90,
    textAlign: "center",
  },
  podiumChips: { flexDirection: "row", alignItems: "center", gap: 4 },
  podiumChipsNum: { fontFamily: "Outfit_900Black", color: colors.gold2, fontSize: 13 },
  podiumStreak: { fontSize: 11, color: colors.muted, fontFamily: "Outfit_700Bold" },
  podiumCountry: { fontSize: 13 },
  myRankPill: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginHorizontal: 16,
    marginBottom: 12,
    padding: 14,
    paddingHorizontal: 16,
    borderRadius: 16,
    backgroundColor: "rgba(198,238,199,0.08)",
    borderWidth: 1,
    borderColor: colors.mintDeep,
  },
  myRankLabel: { fontSize: 10.5, fontFamily: "Outfit_900Black", color: colors.mint, letterSpacing: 1.1 },
  myRankNum: { fontSize: 20, fontFamily: "Outfit_900Black", color: colors.cream },
  myRankChips: { flexDirection: "row", alignItems: "center", gap: 5 },
  myRankChipsNum: { fontFamily: "Outfit_800ExtraBold", color: colors.chipText, fontSize: 14 },
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
  rowMe: { borderColor: colors.mintDeep, backgroundColor: "rgba(198,238,199,0.07)" },
  rank: { fontFamily: "Outfit_900Black", fontSize: 15, width: 34, color: colors.dim },
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
  addBtn: { marginHorizontal: 16, marginTop: 12 },
  inviteBtn: { marginHorizontal: 16, marginTop: 10 },
  footer: {
    textAlign: "center",
    color: colors.dim,
    fontSize: 12,
    fontFamily: "Outfit_600SemiBold",
    marginTop: 12,
    marginHorizontal: 24,
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
  promptWrap: { position: "absolute", top: 0, bottom: 0, left: 0, right: 0, justifyContent: "flex-end", zIndex: 80 },
  backdrop: { flex: 1, backgroundColor: "rgba(3,8,5,0.6)" },
  sheet: {
    backgroundColor: "#101A13",
    borderTopLeftRadius: 26,
    borderTopRightRadius: 26,
    borderTopWidth: 1,
    borderColor: colors.lineStrong,
    padding: 20,
    paddingBottom: 36,
    alignItems: "stretch",
  },
  sheetEmoji: { fontSize: 44, textAlign: "center", marginBottom: 6 },
  sheetTitle: {
    fontFamily: "Outfit_900Black",
    fontSize: 20,
    textAlign: "center",
    color: colors.cream,
    marginBottom: 8,
  },
  sheetCopy: {
    color: colors.muted,
    fontSize: 13.5,
    fontFamily: "Outfit_600SemiBold",
    lineHeight: 20,
    textAlign: "center",
    marginBottom: 18,
  },
  inputWrap: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: colors.bg2,
    borderWidth: 1,
    borderColor: colors.line,
    borderRadius: 14,
    paddingHorizontal: 14,
    paddingVertical: 4,
    marginBottom: 16,
  },
  inputPrefix: { fontSize: 18, fontFamily: "Outfit_800ExtraBold", color: colors.muted, marginRight: 4 },
  input: {
    flex: 1,
    color: colors.cream,
    fontFamily: "Outfit_700Bold",
    fontSize: 16,
    paddingVertical: 12,
  },
});
