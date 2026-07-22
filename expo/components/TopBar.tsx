import { useRouter } from "expo-router";
import React, { useCallback, useEffect, useRef } from "react";
import { Animated, Pressable, StyleSheet, Text, View } from "react-native";

import ChipIcon from "@/components/ChipIcon";
import colors from "@/constants/colors";
import { useGame } from "@/providers/GameProvider";

interface TopBarProps {
  title: string;
  accentTitle?: string;
  showCheats?: boolean;
  showStreak?: boolean;
  showChips?: boolean;
}

function FlameEmoji() {
  const anim = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    Animated.loop(
      Animated.sequence([
        Animated.timing(anim, { toValue: 1, duration: 800, useNativeDriver: true }),
        Animated.timing(anim, { toValue: 0, duration: 800, useNativeDriver: true }),
      ]),
    ).start();
  }, [anim]);
  const scale = anim.interpolate({ inputRange: [0, 1], outputRange: [1, 1.12] });
  const rotate = anim.interpolate({ inputRange: [0, 1], outputRange: ["-3deg", "3deg"] });
  return (
    <Animated.Text style={[styles.flame, { transform: [{ scale }, { rotate }] }]}>🔥</Animated.Text>
  );
}

/** Sticky top bar: brand + streak / chips pills. */
export default function TopBar({ title, accentTitle, showCheats = false, showStreak = true, showChips = true }: TopBarProps) {
  const { streak, chips } = useGame();
  const router = useRouter();

  const openCheats = useCallback(() => {
    router.push("/cheats");
  }, [router]);

  return (
    <View style={styles.bar}>
      <View style={styles.brandRow}>
        <View style={styles.brandChip} />
        <Text style={styles.brand}>
          {title}
          {accentTitle ? <Text style={styles.brandAccent}>{accentTitle}</Text> : null}
        </Text>
      </View>
      <View style={styles.pills}>
        {showCheats && (
          <Pressable style={styles.pill} onPress={openCheats} testID="cheats-button">
            <Text style={styles.pillEmoji}>📋</Text>
          </Pressable>
        )}
        {showStreak && (
          <View style={styles.pill}>
            <FlameEmoji />
            <Text style={styles.streakText}>{streak}</Text>
          </View>
        )}
        {showChips && (
          <View style={styles.pill}>
            <ChipIcon size={15} />
            <Text style={styles.chipsText}>{chips.toLocaleString()}</Text>
          </View>
        )}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  bar: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 20,
    paddingTop: 14,
    paddingBottom: 10,
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
  brand: {
    fontFamily: "Outfit_900Black",
    fontSize: 24,
    letterSpacing: -1,
    color: colors.cream,
  },
  brandAccent: { color: colors.mint },
  pills: { flexDirection: "row", gap: 8, alignItems: "center" },
  pill: {
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.line,
    borderRadius: 999,
    paddingVertical: 6,
    paddingHorizontal: 12,
  },
  pillEmoji: { fontSize: 15 },
  flame: { fontSize: 14 },
  streakText: { fontFamily: "Outfit_800ExtraBold", fontSize: 14, color: colors.hot },
  chipsText: { fontFamily: "Outfit_800ExtraBold", fontSize: 14, color: colors.chipText },
});
