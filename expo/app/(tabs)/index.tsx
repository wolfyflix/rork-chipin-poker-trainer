import { useRouter } from "expo-router";
import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Animated, Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import ChipIcon from "@/components/ChipIcon";
import DailyGoalBar from "@/components/DailyGoalBar";
import PlayingCard from "@/components/PlayingCard";
import PressButton from "@/components/PressButton";
import TopBar from "@/components/TopBar";
import colors from "@/constants/colors";
import { CURRICULUM, Lesson, Unit } from "@/lib/curriculum";
import { MAX_LIVES, STREAK_RECOVERY_COST, TABLE_UNLOCK_LESSONS, useGame } from "@/providers/GameProvider";

function PulsingNode({ children }: { children: React.ReactNode }) {
  const anim = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    Animated.loop(
      Animated.sequence([
        Animated.timing(anim, { toValue: 1, duration: 1000, useNativeDriver: true }),
        Animated.timing(anim, { toValue: 0, duration: 1000, useNativeDriver: true }),
      ]),
    ).start();
  }, [anim]);
  const scale = anim.interpolate({ inputRange: [0, 1], outputRange: [1, 1.06] });
  return <Animated.View style={{ transform: [{ scale }] }}>{children}</Animated.View>;
}

function LivesHeart({ filled }: { filled: boolean }) {
  return <Text style={[styles.lifeHeart, filled ? styles.lifeOn : styles.lifeOff]}>♥</Text>;
}

export default function LearnScreen() {
  const { chips, completed, pro, openPaywall, dailyClaimed, claimDailyDrop, lives, tableUnlocked, streak, streakBroken, restoreStreak } = useGame();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const [notice, setNotice] = useState<string | null>(null);
  const [tablePrompt, setTablePrompt] = useState<boolean>(false);
  const [recoverOpen, setRecoverOpen] = useState<boolean>(false);
  const noticeTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const showNotice = useCallback((msg: string) => {
    setNotice(msg);
    if (noticeTimer.current) clearTimeout(noticeTimer.current);
    noticeTimer.current = setTimeout(() => setNotice(null), 2300);
  }, []);

  const tryRestoreStreak = useCallback(() => {
    const ok = restoreStreak();
    if (ok) {
      setRecoverOpen(false);
      showNotice(`🔥 Streak restored for ${STREAK_RECOVERY_COST} chips`);
    } else {
      showNotice(`Need ${STREAK_RECOVERY_COST} chips to restore your streak`);
    }
  }, [restoreStreak, showNotice]);

  const tapNode = useCallback(
    (unit: Unit, lesson: Lesson, index: number) => {
      if (!(unit.free || pro)) {
        openPaywall("That unit is Pro territory.\nPick a plan and it's all open.");
        return;
      }
      const prevDone = index === 0 || completed.has(unit.lessons[index - 1].id);
      if (!prevDone) {
        showNotice("Finish the one before it first 👀");
        return;
      }
      if (lives <= 0) {
        showNotice("Out of lives — they refill over time, or go Pro for unlimited.");
        return;
      }
      router.push({
        pathname: "/lesson",
        params: { unitId: unit.id, lessonId: lesson.id, reward: String(unit.reward) },
      });
    },
    [pro, completed, lives, router, openPaywall, showNotice],
  );

  const openTable = useCallback(() => {
    if (!tableUnlocked) {
      setTablePrompt(true);
      return;
    }
    if (chips < 200) {
      if (!dailyClaimed) {
        claimDailyDrop();
        showNotice("🎁 Daily chip drop claimed — +500");
      } else {
        showNotice("Need 200 chips to sit down — hit the Arena to earn some");
      }
      return;
    }
    router.push("/table");
  }, [tableUnlocked, chips, dailyClaimed, claimDailyDrop, showNotice, router]);

  const map = useMemo(() => {
    return CURRICULUM.map((unit) => {
      const unlocked = unit.free || pro;
      let currentPlaced = false;
      const nodes = unit.lessons.map((ls, i) => {
        const done = completed.has(ls.id);
        const prevDone = i === 0 ? true : completed.has(unit.lessons[i - 1].id);
        let state: "done" | "current" | "locked" = "locked";
        if (unlocked) {
          if (done) state = "done";
          else if (prevDone && !currentPlaced) {
            state = "current";
            currentPlaced = true;
          }
        }
        return { ls, i, state };
      });
      return { unit, unlocked, nodes };
    });
  }, [pro, completed]);

  return (
    <View style={[styles.screen, { paddingTop: insets.top }]}>
      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: 32 }}>
        <TopBar title="Chip" accentTitle="In" showCheats />

        {/* Lives + streak row — Duolingo style */}
        <View style={styles.livesRow}>
          <View style={styles.livesPill}>
            {Array.from({ length: MAX_LIVES }, (_, i) => (
              <LivesHeart key={i} filled={i < lives} />
            ))}
            <Text style={styles.livesText}>{lives}/{MAX_LIVES}</Text>
          </View>
          <Pressable
            style={[styles.streakPill, streakBroken && styles.streakPillBroken]}
            onPress={() => streakBroken && setRecoverOpen(true)}
            disabled={!streakBroken}
            testID="streak-pill"
          >
            <Text style={styles.streakFlame}>{streakBroken ? "💔" : "🔥"}</Text>
            <Text style={[styles.streakNum, streakBroken && styles.streakNumBroken]}>{streak}</Text>
            {streakBroken && <Text style={styles.streakRestore}>Restore ›</Text>}
          </Pressable>
        </View>

        <DailyGoalBar />

        <View style={styles.hero}>
          <View style={styles.heroFelt} />
          <View style={styles.heroContent}>
            <Text style={styles.heroTitle}>Yo cj, ready to{"\n"}take their chips?</Text>
            <Text style={styles.heroSub}>Lessons are free. Get one right, earn chips. Get it wrong, lose a life.</Text>
          </View>
          <View style={styles.fan}>
            <View style={[styles.fanCard, { transform: [{ rotate: "14deg" }], right: 4, top: -6 }]}>
              <PlayingCard card={{ r: 14, s: 1 }} size="mini" />
            </View>
            <View style={[styles.fanCard, { transform: [{ rotate: "-8deg" }], right: 52, top: 4 }]}>
              <PlayingCard card={{ r: 14, s: 0 }} size="mini" />
            </View>
          </View>
          <View style={styles.heroBadge}>
            <Text style={styles.heroBadgeText}>3-HANDED · NO LIMIT</Text>
          </View>
        </View>

        {map.map(({ unit, unlocked, nodes }) => (
          <View key={unit.id}>
            <View style={[styles.unitHead, unlocked && styles.unitHeadOpen]}>
              <View style={styles.unitEmoji}>
                <Text style={styles.unitEmojiText}>{unit.emoji}</Text>
              </View>
              <View style={styles.unitInfo}>
                <Text style={styles.unitTitle}>{unit.title}</Text>
                <Text style={styles.unitTagline}>{unit.tagline}</Text>
              </View>
              {unlocked ? (
                <View style={styles.rewardBadge}>
                  <ChipIcon size={10} />
                  <Text style={styles.rewardBadgeText}>+{unit.reward}</Text>
                </View>
              ) : (
                <View style={styles.proBadge}>
                  <Text style={styles.proBadgeText}>👑 PRO</Text>
                </View>
              )}
            </View>

            <View style={styles.path}>
              {nodes.map(({ ls, i, state }) => {
                const sideIdx = i % 2 === 0 ? 0 : Math.floor(i / 2) % 2 === 0 ? -62 : 62;
                const icon = state === "done" ? "✓" : state === "current" ? (ls.boss ? "🏆" : "★") : ls.boss ? "🏆" : "🔒";
                const nodeInner = (
                  <Pressable
                    onPress={() => tapNode(unit, ls, i)}
                    style={[
                      styles.node,
                      state === "locked" ? styles.nodeLocked : styles.nodeActive,
                    ]}
                    testID={`node-${ls.id}`}
                  >
                    <Text style={[styles.nodeIcon, state !== "locked" ? styles.nodeIconActive : styles.nodeIconLocked]}>
                      {icon}
                    </Text>
                  </Pressable>
                );
                return (
                  <View key={ls.id} style={[styles.nodeRow, { transform: [{ translateX: sideIdx }] }]}>
                    {state === "current" && (
                      <View style={styles.startChip}>
                        <Text style={styles.startChipText}>START</Text>
                        <View style={styles.startChipArrow} />
                      </View>
                    )}
                    {state === "current" ? <PulsingNode>{nodeInner}</PulsingNode> : nodeInner}
                    <Text style={[styles.nodeLabel, state === "current" && styles.nodeLabelCurrent]}>{ls.title}</Text>
                  </View>
                );
              })}
            </View>
          </View>
        ))}

        {/* The Table — locked until you've done enough lessons */}
        <Pressable style={[styles.tableCard, !tableUnlocked && styles.tableCardLocked]} onPress={openTable} testID="the-table-card">
          <View style={styles.tableCardLeft}>
            <Text style={styles.tableEmoji}>{tableUnlocked ? "♠️" : "🔒"}</Text>
            <View style={{ flex: 1 }}>
              <Text style={styles.tableTitle}>The Table</Text>
              <Text style={styles.tableSub}>
                {tableUnlocked
                  ? "Put your skills to the test. Heads-up vs 2 AI — live odds, real showdowns."
                  : `Finish ${TABLE_UNLOCK_LESSONS} lessons to unlock a real game vs the AI.`}
              </Text>
            </View>
          </View>
          <View style={styles.tableBuyin}>
            <ChipIcon size={11} />
            <Text style={styles.tableBuyinText}>200 buy-in</Text>
          </View>
        </Pressable>
      </ScrollView>

      {notice && (
        <View style={[styles.toast, { top: insets.top + 56 }]}>
          <Text style={styles.toastText}>{notice}</Text>
        </View>
      )}

      {tablePrompt && (
        <View style={styles.promptWrap}>
          <Pressable style={styles.backdrop} onPress={() => setTablePrompt(false)} />
          <View style={styles.sheet}>
            <Text style={styles.sheetEmoji}>♠️</Text>
            <Text style={styles.sheetTitle}>Not so fast.</Text>
            <Text style={styles.sheetCopy}>
              You&apos;ve learned the basics — now put them to the test. Finish {TABLE_UNLOCK_LESSONS} lessons and The Table unlocks: a real 3-handed game vs two AI opponents, live odds, full streets, showdown judged by the real evaluator.
            </Text>
            <PressButton label="Back to lessons" variant="ghost" onPress={() => setTablePrompt(false)} />
          </View>
        </View>
      )}

      {recoverOpen && (
        <View style={styles.promptWrap}>
          <Pressable style={styles.backdrop} onPress={() => setRecoverOpen(false)} />
          <View style={styles.sheet}>
            <Text style={styles.sheetEmoji}>💔</Text>
            <Text style={styles.sheetTitle}>Streak broken?</Text>
            <Text style={styles.sheetCopy}>
              You missed a day and your {streak}-day streak is on the line. Pay {STREAK_RECOVERY_COST} chips to restore it — Duolingo-style. One-time offer per break.
            </Text>
            <View style={styles.recoverRow}>
              <ChipIcon size={18} />
              <Text style={styles.recoverCost}>{STREAK_RECOVERY_COST}</Text>
              <Text style={styles.recoverBal}>· you have {chips.toLocaleString()}</Text>
            </View>
            <PressButton
              label={chips >= STREAK_RECOVERY_COST ? `Restore streak for ${STREAK_RECOVERY_COST} chips` : "Not enough chips"}
              disabled={chips < STREAK_RECOVERY_COST}
              onPress={tryRestoreStreak}
              testID="confirm-restore"
            />
            <PressButton label="Let it go" variant="ghost" onPress={() => setRecoverOpen(false)} />
          </View>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.bg },
  livesRow: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingHorizontal: 20, paddingBottom: 6, gap: 10 },
  livesPill: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.line,
    borderRadius: 999,
    paddingVertical: 6,
    paddingHorizontal: 12,
  },
  streakPill: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    backgroundColor: "rgba(233,196,100,0.1)",
    borderWidth: 1,
    borderColor: "rgba(233,196,100,0.3)",
    borderRadius: 999,
    paddingVertical: 6,
    paddingHorizontal: 12,
  },
  streakPillBroken: {
    backgroundColor: "rgba(228,87,61,0.1)",
    borderColor: "rgba(228,87,61,0.4)",
  },
  streakFlame: { fontSize: 15 },
  streakNum: { fontFamily: "Outfit_900Black", fontSize: 14, color: colors.gold2 },
  streakNumBroken: { color: colors.red },
  streakRestore: { fontSize: 10, fontFamily: "Outfit_800ExtraBold", color: colors.mint, letterSpacing: 0.3 },
  recoverRow: { flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 6, marginBottom: 18 },
  recoverCost: { fontFamily: "Outfit_900Black", fontSize: 20, color: colors.chipText },
  recoverBal: { fontSize: 12, color: colors.muted, fontFamily: "Outfit_600SemiBold" },
  lifeHeart: { fontSize: 15, fontFamily: "Outfit_900Black" },
  lifeOn: { color: colors.red },
  lifeOff: { color: colors.dim },
  livesText: {
    marginLeft: 8,
    color: colors.muted,
    fontSize: 12,
    fontFamily: "Outfit_800ExtraBold",
    letterSpacing: 0.4,
  },
  hero: {
    marginHorizontal: 16,
    marginBottom: 14,
    marginTop: 2,
    padding: 20,
    borderRadius: 24,
    borderWidth: 1.5,
    borderColor: colors.table,
    overflow: "hidden",
    minHeight: 120,
    position: "relative",
  },
  heroFelt: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: colors.table2,
  },
  heroContent: { zIndex: 2 },
  heroBadge: {
    position: "absolute",
    bottom: 12,
    right: 12,
    backgroundColor: "rgba(10,15,12,0.6)",
    borderWidth: 1,
    borderColor: "rgba(198,238,199,0.2)",
    borderRadius: 999,
    paddingVertical: 4,
    paddingHorizontal: 9,
    zIndex: 3,
  },
  heroBadgeText: {
    fontSize: 8.5,
    fontFamily: "Outfit_900Black",
    color: colors.mint2,
    letterSpacing: 1.2,
  },
  heroTitle: {
    fontSize: 21,
    fontFamily: "Outfit_900Black",
    letterSpacing: -0.4,
    lineHeight: 26,
    color: colors.cream,
  },
  heroSub: {
    fontSize: 13,
    color: "rgba(226,248,225,0.8)",
    fontFamily: "Outfit_600SemiBold",
    marginTop: 4,
    maxWidth: "72%",
  },
  fan: { position: "absolute", right: 0, top: 14, width: 130, height: 110 },
  fanCard: { position: "absolute" },
  unitHead: {
    marginHorizontal: 16,
    marginTop: 14,
    marginBottom: 4,
    padding: 16,
    paddingHorizontal: 18,
    borderRadius: 24,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.line,
    flexDirection: "row",
    alignItems: "center",
    gap: 14,
  },
  unitHeadOpen: { borderColor: colors.lineStrong },
  unitEmoji: {
    width: 52,
    height: 52,
    borderRadius: 16,
    backgroundColor: colors.bg2,
    borderWidth: 1,
    borderColor: colors.line,
    alignItems: "center",
    justifyContent: "center",
  },
  unitEmojiText: { fontSize: 26 },
  unitInfo: { flex: 1 },
  unitTitle: { fontSize: 18, fontFamily: "Outfit_800ExtraBold", letterSpacing: -0.3, color: colors.cream },
  unitTagline: { fontSize: 12.5, color: colors.muted, fontFamily: "Outfit_500Medium" },
  rewardBadge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
    backgroundColor: "rgba(67,209,124,0.12)",
    borderWidth: 1,
    borderColor: "rgba(67,209,124,0.3)",
    paddingVertical: 5,
    paddingHorizontal: 10,
    borderRadius: 999,
  },
  rewardBadgeText: { color: colors.good, fontSize: 11, fontFamily: "Outfit_800ExtraBold" },
  proBadge: {
    backgroundColor: "rgba(233,196,100,0.1)",
    borderWidth: 1,
    borderColor: "rgba(233,196,100,0.25)",
    paddingVertical: 5,
    paddingHorizontal: 10,
    borderRadius: 999,
  },
  proBadgeText: { color: colors.gold, fontSize: 11, fontFamily: "Outfit_800ExtraBold" },
  path: { paddingTop: 8, paddingBottom: 18 },
  nodeRow: { alignItems: "center", paddingTop: 22, paddingBottom: 16 },
  node: {
    width: 74,
    height: 74,
    borderRadius: 37,
    alignItems: "center",
    justifyContent: "center",
  },
  nodeActive: {
    backgroundColor: colors.mint,
    shadowColor: colors.mintDeep,
    shadowOpacity: 1,
    shadowRadius: 0,
    shadowOffset: { width: 0, height: 5 },
    elevation: 5,
  },
  nodeLocked: {
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.line,
  },
  nodeIcon: { fontSize: 25 },
  nodeIconActive: { color: colors.mintInk, fontFamily: "Outfit_900Black" },
  nodeIconLocked: { color: colors.dim },
  nodeLabel: {
    marginTop: 8,
    width: 130,
    fontSize: 12,
    fontFamily: "Outfit_700Bold",
    color: colors.muted,
    textAlign: "center",
    lineHeight: 15,
  },
  nodeLabelCurrent: { color: colors.mint },
  startChip: {
    backgroundColor: colors.mint,
    paddingVertical: 5,
    paddingHorizontal: 12,
    borderRadius: 10,
    marginBottom: 8,
    alignItems: "center",
  },
  startChipText: {
    fontSize: 11,
    fontFamily: "Outfit_900Black",
    color: colors.mintInk,
    letterSpacing: 0.4,
  },
  startChipArrow: {
    position: "absolute",
    top: "100%",
    borderWidth: 6,
    borderColor: "transparent",
    borderTopColor: colors.mint,
  },
  tableCard: {
    marginHorizontal: 16,
    marginTop: 10,
    padding: 18,
    borderRadius: 24,
    backgroundColor: colors.surface2,
    borderWidth: 2,
    borderColor: colors.table,
    flexDirection: "row",
    alignItems: "center",
    gap: 14,
  },
  tableCardLocked: { borderColor: colors.line, backgroundColor: colors.surface, opacity: 0.85 },
  tableCardLeft: { flexDirection: "row", alignItems: "center", gap: 14, flex: 1 },
  tableEmoji: { fontSize: 34 },
  tableTitle: {
    fontSize: 18,
    fontFamily: "Outfit_900Black",
    letterSpacing: -0.3,
    color: colors.cream,
  },
  tableSub: {
    fontSize: 12.5,
    color: colors.muted,
    fontFamily: "Outfit_600SemiBold",
    lineHeight: 17,
    marginTop: 2,
  },
  tableBuyin: {
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
    backgroundColor: "rgba(216,73,58,0.12)",
    borderWidth: 1,
    borderColor: "rgba(216,73,58,0.3)",
    paddingVertical: 5,
    paddingHorizontal: 10,
    borderRadius: 999,
  },
  tableBuyinText: { color: colors.chipText, fontSize: 11, fontFamily: "Outfit_800ExtraBold" },
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
});
