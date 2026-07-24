import React, { useCallback, useRef, useState } from "react";
import {
  Animated,
  Dimensions,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useRouter } from "expo-router";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { Check, ChevronRight } from "lucide-react-native";

import PlayingCard from "@/components/PlayingCard";
import PressButton from "@/components/PressButton";
import colors from "@/constants/colors";
import { Card } from "@/lib/poker";

const SCREEN_W = Dimensions.get("window").width;
const HOWTO_SEEN_KEY = "@chipin_howto_seen";

interface Step {
  emoji: string;
  title: string;
  body: string;
  cards?: Card[];
  label?: string;
}

const STEPS: Step[] = [
  {
    emoji: "🎴",
    title: "The Deal",
    body: 'Every player gets 2 hidden cards — your "hole cards." Only you can see them. A round of betting follows.',
    cards: [{ r: 14, s: 0 }, { r: 13, s: 1 }],
    label: "YOUR HOLE CARDS",
  },
  {
    emoji: "🔥",
    title: "The Flop",
    body: "3 shared cards are dealt face-up in the middle. Everyone uses these. Bet again — are you getting stronger?",
    cards: [{ r: 14, s: 2 }, { r: 7, s: 3 }, { r: 2, s: 1 }],
    label: "THE FLOP",
  },
  {
    emoji: "🎲",
    title: "The Turn",
    body: "1 more shared card hits the board. The picture gets clearer. Another betting round — push or pump the brakes?",
    cards: [{ r: 14, s: 2 }, { r: 7, s: 3 }, { r: 2, s: 1 }, { r: 9, s: 0 }],
    label: "THE TURN",
  },
  {
    emoji: "🌊",
    title: "The River",
    body: "The last shared card. All 5 community cards are out. One final betting round before the truth.",
    cards: [{ r: 14, s: 2 }, { r: 7, s: 3 }, { r: 2, s: 1 }, { r: 9, s: 0 }, { r: 5, s: 2 }],
    label: "THE RIVER",
  },
  {
    emoji: "🃏",
    title: "Showdown",
    body: "Cards flip. Best 5-card hand wins the pot. You combine your 2 hole cards + the 5 on the board to make your hand.",
    cards: [{ r: 14, s: 0 }, { r: 13, s: 1 }, { r: 14, s: 2 }, { r: 7, s: 3 }, { r: 2, s: 1 }],
    label: "SHOWDOWN — PAIR OF ACES",
  },
  {
    emoji: "🏆",
    title: "You're Ready",
    body: "That's Texas Hold'em — deal, flop, turn, river, showdown. Tap lessons to master every hand, then hit the Arena to drill, and The Table to play.",
  },
];

export default function HowToPlayScreen() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const scrollRef = useRef<ScrollView>(null);
  const [stepIdx, setStepIdx] = useState<number>(0);
  const [progress] = useState(new Animated.Value(0));

  const scrollToStep = useCallback((idx: number) => {
    setStepIdx(idx);
    scrollRef.current?.scrollTo({ x: idx * SCREEN_W, animated: true });
    Animated.timing(progress, {
      toValue: (idx + 1) / STEPS.length,
      duration: 300,
      useNativeDriver: false,
    }).start();
  }, [progress]);

  const next = useCallback(() => {
    if (stepIdx < STEPS.length - 1) {
      scrollToStep(stepIdx + 1);
    } else {
      finish();
    }
  }, [stepIdx, scrollToStep]);

  const finish = useCallback(async () => {
    await AsyncStorage.setItem(HOWTO_SEEN_KEY, "true");
    router.dismiss();
  }, [router]);

  const skip = useCallback(async () => {
    await AsyncStorage.setItem(HOWTO_SEEN_KEY, "true");
    router.dismiss();
  }, [router]);

  return (
    <View style={[styles.screen, { paddingTop: insets.top, paddingBottom: insets.bottom }]}>
      {/* Progress bar */}
      <View style={styles.progressTrack}>
        <Animated.View
          style={[styles.progressFill, { width: progress.interpolate({ inputRange: [0, 1], outputRange: ["0%", "100%"] }) }]}
        />
      </View>

      {/* Skip */}
      <Pressable style={styles.skipBtn} onPress={skip} hitSlop={12}>
        <Text style={styles.skipText}>Skip</Text>
      </Pressable>

      {/* Step pager */}
      <ScrollView
        ref={scrollRef}
        horizontal
        pagingEnabled
        scrollEnabled={false}
        showsHorizontalScrollIndicator={false}
        onScroll={(e) => {
          const idx = Math.round(e.nativeEvent.contentOffset.x / SCREEN_W);
          if (idx !== stepIdx) setStepIdx(idx);
        }}
        scrollEventThrottle={16}
        style={{ flex: 1 }}
      >
        {STEPS.map((step, i) => (
          <View key={i} style={styles.page}>
            <View style={styles.emojiWrap}>
              <Text style={styles.emoji}>{step.emoji}</Text>
            </View>

            <Text style={styles.stepNum}>STEP {i + 1} OF {STEPS.length}</Text>
            <Text style={styles.title}>{step.title}</Text>
            <Text style={styles.body}>{step.body}</Text>

            {step.cards && (
              <View style={styles.cardSection}>
                {step.label && <Text style={styles.cardLabel}>{step.label}</Text>}
                <View style={styles.cardRow}>
                  {step.cards.map((c, ci) => (
                    <View
                      key={ci}
                      style={[
                        styles.cardWrap,
                        ci > 0 && { marginLeft: -16 },
                      ]}
                    >
                      <PlayingCard card={c} size="big" />
                    </View>
                  ))}
                </View>
              </View>
            )}

            {i === STEPS.length - 1 && (
              <PressButton label="Let's play →" variant="gold" onPress={finish} style={styles.letPlay} />
            )}
          </View>
        ))}
      </ScrollView>

      {/* Nav */}
      <View style={styles.nav}>
        <View style={styles.dots}>
          {STEPS.map((_, i) => (
            <View key={i} style={[styles.dot, i === stepIdx && styles.dotActive]} />
          ))}
        </View>
        {stepIdx < STEPS.length - 1 ? (
          <PressButton label="Next" onPress={next} style={styles.nextBtn} small />
        ) : (
          <PressButton label="Start learning" variant="gold" onPress={finish} style={styles.nextBtn} small />
        )}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.bg },
  progressTrack: {
    height: 4,
    backgroundColor: colors.surface,
  },
  progressFill: {
    height: 4,
    backgroundColor: colors.mint,
  },
  skipBtn: {
    position: "absolute",
    top: 58,
    right: 18,
    zIndex: 10,
    paddingVertical: 6,
    paddingHorizontal: 12,
  },
  skipText: { color: colors.dim, fontSize: 14, fontFamily: "Outfit_700Bold" },
  page: {
    width: SCREEN_W,
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 28,
  },
  emojiWrap: {
    width: 90,
    height: 90,
    borderRadius: 28,
    backgroundColor: "rgba(198,238,199,0.08)",
    borderWidth: 1,
    borderColor: "rgba(198,238,199,0.2)",
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 24,
  },
  emoji: { fontSize: 42 },
  stepNum: {
    fontSize: 11,
    fontFamily: "Outfit_900Black",
    letterSpacing: 2,
    color: colors.mintDeep,
    marginBottom: 8,
  },
  title: {
    fontSize: 28,
    fontFamily: "Outfit_900Black",
    letterSpacing: -0.5,
    color: colors.cream,
    marginBottom: 12,
    textAlign: "center",
  },
  body: {
    fontSize: 15.5,
    fontFamily: "Outfit_600SemiBold",
    color: colors.muted,
    lineHeight: 22,
    textAlign: "center",
    marginBottom: 24,
    maxWidth: 320,
  },
  cardSection: {
    alignItems: "center",
    gap: 10,
  },
  cardLabel: {
    fontSize: 11,
    fontFamily: "Outfit_800ExtraBold",
    letterSpacing: 1.5,
    color: colors.dim,
  },
  cardRow: {
    flexDirection: "row",
    justifyContent: "center",
    alignItems: "center",
  },
  cardWrap: {
    shadowColor: "#000",
    shadowOpacity: 0.4,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 4 },
    elevation: 5,
  },
  letPlay: { marginTop: 20, width: 240 },
  nav: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 24,
    paddingBottom: 16,
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: colors.line,
    backgroundColor: colors.bg2,
  },
  dots: { flexDirection: "row", gap: 6 },
  dot: {
    width: 7,
    height: 7,
    borderRadius: 4,
    backgroundColor: colors.surface2,
  },
  dotActive: {
    backgroundColor: colors.mint,
    width: 22,
    borderRadius: 4,
  },
  nextBtn: { width: 130 },
});
