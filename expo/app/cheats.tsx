import { useRouter } from "expo-router";
import React, { useMemo } from "react";
import { Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import PlayingCard from "@/components/PlayingCard";
import colors from "@/constants/colors";
import { CHEAT_RANKS, CHEAT_TERMS } from "@/lib/curriculum";
import { RANK_NAMES } from "@/lib/poker";

const GRID_ORDER = [14, 13, 12, 11, 10, 9, 8, 7, 6];
const RAISE = new Set(["AA", "KK", "QQ", "JJ", "TT", "AKs", "AQs", "AJs", "KQs", "AK", "AQ"]);
const MAYBE = new Set(["99", "88", "77", "66", "ATs", "KJs", "QJs", "JTs", "T9s", "98s", "AJ", "KQ", "KJ", "QJ", "JT"]);

export default function CheatsScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();

  const grid = useMemo(() => {
    return GRID_ORDER.map((r1) =>
      GRID_ORDER.map((r2) => {
        const hi = Math.max(r1, r2);
        const lo = Math.min(r1, r2);
        const suited = r2 > r1;
        const nm = r1 === r2 ? RANK_NAMES[r1] + RANK_NAMES[r1] : RANK_NAMES[hi] + RANK_NAMES[lo] + (suited ? "s" : "");
        const short = nm.replace(/10/g, "T");
        const cls: "raise" | "maybe" | "fold" = RAISE.has(short) ? "raise" : MAYBE.has(short) ? "maybe" : "fold";
        return { short, cls };
      }),
    );
  }, []);

  return (
    <View style={[styles.screen, { paddingTop: 12 }]}>
      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: insets.bottom + 32 }}>
        <View style={styles.topbar}>
          <View style={styles.brandRow}>
            <View style={styles.brandChip} />
            <Text style={styles.brand}>Cheat Sheets</Text>
          </View>
          <Pressable style={styles.closeBtn} onPress={() => router.back()} testID="close-cheats">
            <Text style={styles.closeText}>✕</Text>
          </Pressable>
        </View>
        <Text style={styles.pageSub}>For when someone says &quot;wait, does a flush beat a straight?&quot;</Text>

        <Text style={styles.sectionLabel}>Hand rankings — best to worst</Text>
        {CHEAT_RANKS.map((cr, i) => (
          <View key={cr.n} style={styles.rankRow}>
            <View style={styles.num}>
              <Text style={styles.numText}>{i + 1}</Text>
            </View>
            <Text style={styles.rankName}>{cr.n}</Text>
            <View style={styles.exRow}>
              {cr.ex.map((c, ci) => (
                <PlayingCard key={ci} card={c} size="tiny" />
              ))}
            </View>
          </View>
        ))}

        <Text style={[styles.sectionLabel, { marginTop: 20 }]}>Starting hands from late position</Text>
        <View style={styles.grid}>
          {grid.map((row, ri) => (
            <View key={ri} style={styles.gridRow}>
              {row.map((cell, ci) => (
                <View
                  key={ci}
                  style={[
                    styles.cell,
                    cell.cls === "raise" && { backgroundColor: "#2E9E5B" },
                    cell.cls === "maybe" && { backgroundColor: "#8F7A2A" },
                    cell.cls === "fold" && { backgroundColor: "#232E27" },
                  ]}
                >
                  <Text style={[styles.cellText, cell.cls === "fold" && { color: colors.dim }]}>{cell.short}</Text>
                </View>
              ))}
            </View>
          ))}
        </View>
        <View style={styles.legend}>
          <View style={styles.legendItem}>
            <View style={[styles.legendDot, { backgroundColor: "#2E9E5B" }]} />
            <Text style={styles.legendText}>Raise</Text>
          </View>
          <View style={styles.legendItem}>
            <View style={[styles.legendDot, { backgroundColor: "#8F7A2A" }]} />
            <Text style={styles.legendText}>Playable</Text>
          </View>
          <View style={styles.legendItem}>
            <View style={[styles.legendDot, { backgroundColor: "#232E27" }]} />
            <Text style={styles.legendText}>Fold</Text>
          </View>
        </View>

        <Text style={[styles.sectionLabel, { marginTop: 20 }]}>Words people say at poker night</Text>
        {CHEAT_TERMS.map(([term, def]) => (
          <View key={term} style={styles.term}>
            <Text style={styles.termName}>{term}</Text>
            <Text style={styles.termDef}>{def}</Text>
          </View>
        ))}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.bg },
  topbar: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 20,
    paddingTop: 14,
    paddingBottom: 4,
  },
  brandRow: { flexDirection: "row", alignItems: "center", gap: 7 },
  brandChip: {
    width: 22,
    height: 22,
    borderRadius: 11,
    backgroundColor: colors.table,
    borderWidth: 3,
    borderStyle: "dashed",
    borderColor: colors.mint,
  },
  brand: { fontFamily: "Outfit_900Black", fontSize: 22, letterSpacing: -0.8, color: colors.cream },
  closeBtn: {
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.line,
    borderRadius: 999,
    paddingVertical: 6,
    paddingHorizontal: 12,
  },
  closeText: { color: colors.mint, fontSize: 15, fontFamily: "Outfit_800ExtraBold" },
  pageSub: {
    paddingHorizontal: 20,
    paddingBottom: 8,
    fontSize: 13.5,
    color: colors.muted,
    fontFamily: "Outfit_600SemiBold",
  },
  sectionLabel: {
    fontSize: 11.5,
    fontFamily: "Outfit_800ExtraBold",
    letterSpacing: 1.6,
    color: colors.dim,
    textTransform: "uppercase",
    marginHorizontal: 20,
    marginTop: 12,
    marginBottom: 4,
  },
  rankRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    paddingVertical: 11,
    paddingHorizontal: 14,
    marginHorizontal: 16,
    marginVertical: 3.5,
    borderRadius: 16,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.line,
  },
  num: {
    width: 26,
    height: 26,
    borderRadius: 9,
    backgroundColor: "rgba(198,238,199,0.09)",
    alignItems: "center",
    justifyContent: "center",
  },
  numText: { color: colors.mint, fontFamily: "Outfit_900Black", fontSize: 13 },
  rankName: { fontFamily: "Outfit_800ExtraBold", fontSize: 13.5, minWidth: 96, color: colors.cream },
  exRow: { flexDirection: "row", gap: 4, marginLeft: "auto" },
  grid: { marginHorizontal: 16, gap: 4 },
  gridRow: { flexDirection: "row", gap: 4 },
  cell: {
    flex: 1,
    aspectRatio: 1,
    borderRadius: 6,
    alignItems: "center",
    justifyContent: "center",
  },
  cellText: { fontSize: 9, fontFamily: "Outfit_800ExtraBold", color: "rgba(255,255,255,0.85)" },
  legend: { flexDirection: "row", gap: 14, marginHorizontal: 20, marginTop: 10 },
  legendItem: { flexDirection: "row", alignItems: "center", gap: 5 },
  legendDot: { width: 12, height: 12, borderRadius: 4 },
  legendText: { fontSize: 11.5, fontFamily: "Outfit_700Bold", color: colors.muted },
  term: {
    marginHorizontal: 16,
    marginVertical: 4,
    padding: 13,
    paddingHorizontal: 16,
    borderRadius: 16,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.line,
  },
  termName: { color: colors.mint, fontSize: 14.5, fontFamily: "Outfit_800ExtraBold" },
  termDef: {
    fontSize: 13,
    color: colors.muted,
    fontFamily: "Outfit_600SemiBold",
    lineHeight: 19,
    marginTop: 3,
  },
});
