import React, { useCallback, useState } from "react";
import { Modal, Pressable, ScrollView, StyleSheet, Text, View } from "react-native";

import PressButton from "@/components/PressButton";
import colors from "@/constants/colors";
import { useGame } from "@/providers/GameProvider";

type Tier = "yr" | "mo" | "wk";

const TIER_CTA: Record<Tier, string> = {
  yr: "Unlock the year — $69.99",
  mo: "Start 3-day free trial",
  wk: "Get the Weekend Pass — $6.99",
};
const TIER_FINE: Record<Tier, string> = {
  yr: "Cancel anytime in 2 taps. $5.83/month — cheaper than one bad river call.",
  mo: "Free for 3 days, then $14.99/month. Cancel anytime in 2 taps.",
  wk: "One week of full access, starts right now. No trial on the pass.",
};

const FEATURES: { icon: string; title: string; sub: string }[] = [
  { icon: "🗺️", title: "Every lesson unit unlocked", sub: "Pot Odds, Reading the Board, and everything we ship next." },
  { icon: "♾️", title: "Unlimited tools", sub: "Who Won, My Odds, every calculator — no daily cap." },
  { icon: "🛟", title: "Broke insurance", sub: "Bust your bankroll? Instant free refill, every time." },
  { icon: "🧠", title: "Deeper explanations", sub: "Not just the answer — the why, so it sticks." },
];

/**
 * 3-tier paywall UI. Stage 3 will connect this to RevenueCat —
 * for now the CTA is a visual placeholder.
 */
export default function PaywallSheet() {
  const { paywallVisible, paywallMessage, closePaywall } = useGame();
  const [tier, setTier] = useState<Tier>("yr");
  const [notice, setNotice] = useState<boolean>(false);

  const handleCTA = useCallback(() => {
    setNotice(true);
    setTimeout(() => setNotice(false), 2500);
  }, []);

  return (
    <Modal visible={paywallVisible} transparent animationType="slide" onRequestClose={closePaywall}>
      <Pressable style={styles.backdrop} onPress={closePaywall} />
      <View style={styles.sheet}>
        <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.content}>
          <Text style={styles.crown}>👑</Text>
          <Text style={styles.title}>
            ChipIn <Text style={styles.titleGold}>Pro</Text>
          </Text>
          <Text style={styles.sub}>{paywallMessage ?? "Every unit, every tool, no limits.\nPick your lane."}</Text>

          {FEATURES.map((f) => (
            <View key={f.title} style={styles.feat}>
              <View style={styles.featIcon}>
                <Text style={styles.featEmoji}>{f.icon}</Text>
              </View>
              <View style={styles.featBody}>
                <Text style={styles.featTitle}>{f.title}</Text>
                <Text style={styles.featSub}>{f.sub}</Text>
              </View>
            </View>
          ))}

          <View style={styles.tiers}>
            <Pressable style={[styles.tier, tier === "yr" && styles.tierOn]} onPress={() => setTier("yr")} testID="tier-yr">
              <View style={[styles.badge, styles.badgeGold]}>
                <Text style={styles.badgeGoldText}>BEST VALUE</Text>
              </View>
              <View style={styles.tierBody}>
                <Text style={styles.tierName}>Annual Masterclass</Text>
                <Text style={styles.tierSub}>The whole year, locked in</Text>
              </View>
              <View style={styles.tierPrice}>
                <Text style={styles.tierP}>$69.99</Text>
                <Text style={styles.tierPer}>$5.83/mo</Text>
              </View>
            </Pressable>
            <Pressable style={[styles.tier, tier === "mo" && styles.tierOn]} onPress={() => setTier("mo")} testID="tier-mo">
              <View style={[styles.badge, styles.badgeGreen]}>
                <Text style={styles.badgeGreenText}>3-DAY FREE TRIAL</Text>
              </View>
              <View style={styles.tierBody}>
                <Text style={styles.tierName}>Monthly Pro</Text>
                <Text style={styles.tierSub}>The standard training plan</Text>
              </View>
              <View style={styles.tierPrice}>
                <Text style={styles.tierP}>$14.99</Text>
                <Text style={styles.tierPer}>per month</Text>
              </View>
            </Pressable>
            <Pressable style={[styles.tier, tier === "wk" && styles.tierOn]} onPress={() => setTier("wk")} testID="tier-wk">
              <View style={styles.tierBody}>
                <Text style={styles.tierName}>Weekend Pass</Text>
                <Text style={styles.tierSub}>Just need it for this weekend&apos;s game?</Text>
              </View>
              <View style={styles.tierPrice}>
                <Text style={styles.tierP}>$6.99</Text>
                <Text style={styles.tierPer}>per week</Text>
              </View>
            </Pressable>
          </View>

          <PressButton label={TIER_CTA[tier]} variant="gold" onPress={handleCTA} />
          {notice && <Text style={styles.notice}>Purchases arrive with the RevenueCat build — coming soon.</Text>}
          <PressButton label="Not now" variant="ghost" onPress={closePaywall} />
          <Text style={styles.fine}>{TIER_FINE[tier]}</Text>
        </ScrollView>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: { flex: 1, backgroundColor: "rgba(3,8,5,0.72)" },
  sheet: {
    maxHeight: "92%",
    backgroundColor: "#12251A",
    borderTopLeftRadius: 30,
    borderTopRightRadius: 30,
    borderTopWidth: 1,
    borderColor: "rgba(233,196,100,0.35)",
  },
  content: { padding: 22, paddingBottom: 40 },
  crown: { textAlign: "center", fontSize: 50 },
  title: {
    textAlign: "center",
    fontSize: 25,
    fontFamily: "Outfit_900Black",
    letterSpacing: -0.5,
    marginTop: 8,
    marginBottom: 4,
    color: colors.cream,
  },
  titleGold: { color: colors.gold2 },
  sub: {
    textAlign: "center",
    color: colors.muted,
    fontSize: 14,
    fontFamily: "Outfit_600SemiBold",
    marginBottom: 20,
    lineHeight: 21,
  },
  feat: { flexDirection: "row", gap: 12, alignItems: "flex-start", marginBottom: 13 },
  featIcon: {
    width: 34,
    height: 34,
    borderRadius: 11,
    backgroundColor: "rgba(233,196,100,0.1)",
    borderWidth: 1,
    borderColor: "rgba(233,196,100,0.25)",
    alignItems: "center",
    justifyContent: "center",
  },
  featEmoji: { fontSize: 16 },
  featBody: { flex: 1 },
  featTitle: { fontSize: 14.5, fontFamily: "Outfit_800ExtraBold", color: colors.cream },
  featSub: { fontSize: 12.5, color: colors.muted, fontFamily: "Outfit_600SemiBold", lineHeight: 17 },
  tiers: { marginTop: 20, marginBottom: 14 },
  tier: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    padding: 14,
    paddingHorizontal: 16,
    marginBottom: 12,
    borderRadius: 18,
    borderWidth: 2,
    borderColor: colors.line,
    backgroundColor: colors.surface,
  },
  tierOn: { borderColor: colors.gold, backgroundColor: "rgba(233,196,100,0.08)" },
  badge: {
    position: "absolute",
    top: -10,
    left: 14,
    paddingVertical: 3,
    paddingHorizontal: 9,
    borderRadius: 99,
  },
  badgeGold: { backgroundColor: colors.gold },
  badgeGoldText: { fontSize: 9.5, fontFamily: "Outfit_900Black", color: "#3B2A05", letterSpacing: 0.5 },
  badgeGreen: { backgroundColor: colors.good },
  badgeGreenText: { fontSize: 9.5, fontFamily: "Outfit_900Black", color: "#05301A", letterSpacing: 0.5 },
  tierBody: { flex: 1 },
  tierName: { fontFamily: "Outfit_900Black", fontSize: 15, color: colors.cream },
  tierSub: { fontSize: 11.5, color: colors.muted, fontFamily: "Outfit_600SemiBold", marginTop: 1 },
  tierPrice: { alignItems: "flex-end" },
  tierP: { fontFamily: "Outfit_900Black", fontSize: 17, color: colors.cream },
  tierPer: { fontSize: 10.5, color: colors.dim, fontFamily: "Outfit_700Bold" },
  notice: {
    textAlign: "center",
    color: colors.gold2,
    fontSize: 12.5,
    fontFamily: "Outfit_700Bold",
    marginBottom: 4,
  },
  fine: {
    textAlign: "center",
    fontSize: 11,
    color: colors.dim,
    fontFamily: "Outfit_600SemiBold",
    marginTop: 10,
    lineHeight: 16,
  },
});
