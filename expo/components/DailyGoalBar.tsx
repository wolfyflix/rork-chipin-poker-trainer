import React, { useEffect, useRef } from "react";
import { Animated, Easing, StyleSheet, Text, View } from "react-native";

import colors from "@/constants/colors";
import { DAILY_GOAL_XP, useGame } from "@/providers/GameProvider";

/**
 * Daily goal progress bar — Duolingo-style. Shows XP earned today toward the
 * daily goal, with a smooth animated fill and a celebratory state when met.
 * Mint fill while in progress, gold flame-glow when the goal is hit.
 */
export default function DailyGoalBar() {
  const { dailyXp, dailyGoalMet } = useGame();
  const target = Math.min(1, dailyXp / DAILY_GOAL_XP);
  const anim = useRef<Animated.Value>(new Animated.Value(0)).current;
  const firstRun = useRef(true);

  useEffect(() => {
    if (firstRun.current) {
      anim.setValue(target);
      firstRun.current = false;
      return;
    }
    Animated.timing(anim, {
      toValue: target,
      duration: 650,
      easing: Easing.out(Easing.cubic),
      useNativeDriver: false,
    }).start();
  }, [target, anim]);

  const width = anim.interpolate({
    inputRange: [0, 1],
    outputRange: ["0%", "100%"],
  });

  const remaining = Math.max(0, DAILY_GOAL_XP - dailyXp);

  return (
    <View style={styles.wrap} testID="daily-goal-bar">
      <View style={styles.headRow}>
        <View style={styles.labelRow}>
          <Text style={styles.flame}>{dailyGoalMet ? "🔥" : "🎯"}</Text>
          <Text style={styles.label}>DAILY GOAL</Text>
        </View>
        <Text style={styles.countText}>
          {dailyGoalMet ? (
            <Text style={styles.metText}>Goal hit — see you tomorrow 🏆</Text>
          ) : (
            <>
              <Text style={styles.xpNum}>{dailyXp}</Text>
              <Text style={styles.xpDen}> / {DAILY_GOAL_XP} XP · {remaining} to go</Text>
            </>
          )}
        </Text>
      </View>

      <View style={[styles.track, dailyGoalMet && styles.trackMet]}>
        <Animated.View
          style={[
            styles.fill,
            dailyGoalMet ? styles.fillMet : styles.fillProg,
            { width },
          ]}
        />
        {/* Tick markers at 25/50/75% */}
        {[0.25, 0.5, 0.75].map((t) => (
          <View key={t} style={[styles.tick, { left: `${t * 100}%` }]} />
        ))}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    marginHorizontal: 16,
    marginTop: 8,
    marginBottom: 4,
    padding: 14,
    paddingHorizontal: 16,
    borderRadius: 20,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.line,
  },
  headRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 10,
    gap: 8,
  },
  labelRow: { flexDirection: "row", alignItems: "center", gap: 6 },
  flame: { fontSize: 14 },
  label: {
    fontSize: 10.5,
    fontFamily: "Outfit_900Black",
    color: colors.muted,
    letterSpacing: 1.1,
  },
  countText: { fontSize: 12, fontFamily: "Outfit_700Bold" },
  xpNum: { color: colors.mint2, fontFamily: "Outfit_900Black", fontSize: 14 },
  xpDen: { color: colors.muted, fontFamily: "Outfit_600SemiBold" },
  metText: { color: colors.gold2, fontFamily: "Outfit_800ExtraBold", fontSize: 12.5 },
  track: {
    height: 10,
    borderRadius: 6,
    backgroundColor: colors.bg2,
    borderWidth: 1,
    borderColor: colors.line,
    overflow: "hidden",
    position: "relative",
  },
  trackMet: { borderColor: "rgba(233,196,100,0.4)" },
  fill: {
    position: "absolute",
    top: 0,
    bottom: 0,
    left: 0,
    borderRadius: 6,
  },
  fillProg: {
    backgroundColor: colors.mint,
    shadowColor: colors.mintDeep,
    shadowOpacity: 0.5,
    shadowRadius: 6,
    shadowOffset: { width: 0, height: 0 },
    elevation: 2,
  },
  fillMet: {
    backgroundColor: colors.gold,
    shadowColor: colors.gold,
    shadowOpacity: 0.7,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 0 },
    elevation: 3,
  },
  tick: {
    position: "absolute",
    top: 0,
    bottom: 0,
    width: 1,
    backgroundColor: "rgba(255,255,255,0.08)",
  },
});
