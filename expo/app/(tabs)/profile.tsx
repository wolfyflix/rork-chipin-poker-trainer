import React, { useMemo } from "react";
import { ScrollView, StyleSheet, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import ChipIcon from "@/components/ChipIcon";
import PressButton from "@/components/PressButton";
import TopBar from "@/components/TopBar";
import colors from "@/constants/colors";
import { useGame } from "@/providers/GameProvider";

const LIT_DAYS = new Set([9, 10, 12, 15, 16, 17, 22, 23, 24, 25]);
const WEEK_LABELS = ["M", "T", "W", "T", "F", "S", "S"];
const CHIPS_WEEK = [120, 205, 0, 340, 180, 75, 0];

export default function ProfileScreen() {
  const insets = useSafeAreaInsets();
  const { chips, streak, completed, biggestPot, pro, usesLeft, lives, openPaywall } = useGame();

  const maxWeek = useMemo(() => Math.max(...CHIPS_WEEK, 1), []);

  return (
    <View style={[styles.screen, { paddingTop: insets.top }]}>
      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: 32 }}>
        <TopBar title="Profile" showStreak={false} showChips={false} />

        <View style={styles.head}>
          <View style={styles.ava}>
            <Text style={styles.avaText}>🦈</Text>
          </View>
          <View>
            <Text style={styles.name}>cj</Text>
            <Text style={styles.handle}>@cjwolf · joined July 2026</Text>
          </View>
        </View>

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
        </View>
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
});
