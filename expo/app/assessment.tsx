import * as Haptics from "expo-haptics";
import { useRouter } from "expo-router";
import React, { useCallback, useMemo, useState } from "react";
import { Animated, Platform, Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import PlayingCard from "@/components/PlayingCard";
import PressButton from "@/components/PressButton";
import colors from "@/constants/colors";
import {
  AssessmentQuestion,
  PlacementResult,
  SKILL_TIERS,
  buildAssessment,
  computePlacement,
} from "@/lib/skillAssessment";
import { useGame } from "@/providers/GameProvider";

type Phase = "intro" | "quiz" | "result";

/** Animated width for the progress bar. */
function Progress({ pct }: { pct: number }) {
  const width = useMemo(() => new Animated.Value(pct), []); // eslint-disable-line react-hooks/exhaustive-deps
  React.useEffect(() => {
    Animated.timing(width, { toValue: pct, useNativeDriver: false }).start();
  }, [pct, width]);
  const barWidth = width.interpolate({ inputRange: [0, 100], outputRange: ["2%", "100%"] });
  return (
    <View style={styles.progressTrack}>
      <Animated.View style={[styles.progressFill, { width: barWidth }]} />
    </View>
  );
}

/** Row of example hands rendered as mini cards with labels. */
function ExampleRow({ ex }: { ex: NonNullable<AssessmentQuestion["ex"]> }) {
  return (
    <View style={styles.exRow}>
      {ex.map((e, i) => (
        <View key={i} style={styles.exGroup}>
          {e.label ? <Text style={styles.exLabel}>{e.label.toUpperCase()}</Text> : null}
          <View style={styles.exCards}>
            {e.cards.map((c, j) => (
              <PlayingCard key={j} card={c} size="mini" />
            ))}
          </View>
          {e.caption ? <Text style={styles.exCaption}>{e.caption}</Text> : null}
        </View>
      ))}
    </View>
  );
}

export default function AssessmentScreen() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { skillLevel, setSkillLevel } = useGame();

  const [phase, setPhase] = useState<Phase>("intro");
  const [questions, setQuestions] = useState<AssessmentQuestion[]>([]);
  const [idx, setIdx] = useState<number>(0);
  const [picked, setPicked] = useState<number | null>(null);
  const [answers, setAnswers] = useState<boolean[]>([]);
  const [result, setResult] = useState<PlacementResult | null>(null);

  const start = useCallback(() => {
    setQuestions(buildAssessment());
    setIdx(0);
    setPicked(null);
    setAnswers([]);
    setResult(null);
    setPhase("quiz");
  }, []);

  const q = questions[idx];
  const isLast = idx === questions.length - 1;

  const pick = useCallback(
    (opt: number) => {
      if (picked !== null || !q) return;
      const right = opt === q.a;
      if (Platform.OS !== "web") {
        Haptics.impactAsync(right ? Haptics.ImpactFeedbackStyle.Medium : Haptics.ImpactFeedbackStyle.Light);
      }
      setPicked(opt);
      setAnswers((prev) => [...prev, right]);
    },
    [picked, q],
  );

  const next = useCallback(() => {
    if (picked === null) return;
    if (isLast) {
      const res = computePlacement([...answers]);
      setResult(res);
      setSkillLevel(res.tier);
      setPhase("result");
      return;
    }
    setIdx((i) => i + 1);
    setPicked(null);
  }, [picked, isLast, answers, setSkillLevel]);

  const tier = result ? SKILL_TIERS[result.tier] : null;
  const currentTier = q ? SKILL_TIERS[q.tier] : null;

  // ---------- Intro ----------
  if (phase === "intro") {
    return (
      <View style={[styles.screen, { paddingTop: insets.top + 12 }]}>
        <ScrollView contentContainerStyle={styles.introBody} showsVerticalScrollIndicator={false}>
          <Text style={styles.kicker}>SKILL CHECK</Text>
          <Text style={styles.introTitle}>Where do you{"\n"}actually stand?</Text>
          <Text style={styles.introSub}>
            15 questions, about 3 minutes. We ask everything from "what's a blind" to
            solver frequencies, and place you on the ladder — Fish to Pro. No judgment.
            The pro tier is genuinely brutal.
          </Text>

          <View style={styles.ladder}>
            {SKILL_TIERS.map((t) => (
              <View
                key={t.id}
                style={[
                 styles.ladderRow,
                  skillLevel === t.id && styles.ladderRowCurrent,
                ]}
              >
                <Text style={styles.ladderEmoji}>{t.emoji}</Text>
                <View style={styles.ladderTextWrap}>
                  <Text style={[styles.ladderName, skillLevel === t.id && { color: colors.mint }]}>
                    {t.name}
                    {skillLevel === t.id ? "  · you" : ""}
                  </Text>
                  <Text style={styles.ladderBlurb}>{t.blurb}</Text>
                </View>
              </View>
            ))}
          </View>

          <PressButton label="Deal me in" variant="primary" onPress={start} testID="assessment-start" />
          <View style={{ height: 8 }} />
          <PressButton label="Later" variant="ghost" onPress={() => router.dismiss()} />
        </ScrollView>
      </View>
    );
  }

  // ---------- Quiz ----------
  if (phase === "quiz" && q) {
    const answered = picked !== null;
    const wasRight = picked === q.a;
    return (
      <View style={[styles.screen, { paddingTop: insets.top + 12 }]}>
        <Progress pct={((idx + (answered ? 1 : 0)) / questions.length) * 100} />
        <View style={styles.quizMeta}>
          <Text style={styles.quizCount}>
            Q{idx + 1} / {questions.length}
          </Text>
          {currentTier ? (
            <View style={[styles.tierChip, answered && (wasRight ? styles.tierChipGood : styles.tierChipMiss)]}>
              <Text style={styles.tierChipText}>
                {currentTier.emoji} {currentTier.name.toUpperCase()} TIER
              </Text>
            </View>
          ) : null}
        </View>

        <ScrollView contentContainerStyle={styles.quizBody} showsVerticalScrollIndicator={false}>
          <Text style={styles.question}>{q.q}</Text>
          {q.ex ? <ExampleRow ex={q.ex} /> : null}

          {q.opts.map((opt, i) => {
            const isAnswer = i === q.a;
            const isPicked = picked === i;
            const state = !answered ? "idle" : isAnswer ? "right" : isPicked ? "wrong" : "dim";
            return (
              <Pressable
                key={i}
                onPress={() => pick(i)}
                disabled={answered}
                style={[
                  styles.opt,
                  state === "right" && styles.optRight,
                  state === "wrong" && styles.optWrong,
                  state === "dim" && styles.optDim,
                ]}
                testID={`assessment-opt-${i}`}
              >
                <Text
                  style={[
                    styles.optText,
                    state === "right" && { color: colors.good },
                    state === "wrong" && { color: colors.red },
                  ]}
                >
                  {opt}
                </Text>
              </Pressable>
            );
          })}

          {answered ? (
            <View style={[styles.fbBox, wasRight ? styles.fbGood : styles.fbBad]}>
              <Text style={[styles.fbTitle, { color: wasRight ? colors.good : colors.red }]}>
                {wasRight ? "Correct ✅" : "Not quite ❌"}
              </Text>
              <Text style={styles.fbText}>{wasRight ? q.fb.right : q.fb.wrong}</Text>
            </View>
          ) : null}
        </ScrollView>

        {answered ? (
          <View style={styles.nextWrap}>
            <PressButton
              label={isLast ? "Show my level" : "Next question"}
              variant="primary"
              onPress={next}
              testID="assessment-next"
            />
          </View>
        ) : null}
      </View>
    );
  }

  // ---------- Result ----------
  if (phase === "result" && result && tier) {
    return (
      <View style={[styles.screen, { paddingTop: insets.top + 24 }]}>
        <ScrollView contentContainerStyle={styles.resultBody} showsVerticalScrollIndicator={false}>
          <Text style={styles.resultEmoji}>{tier.emoji}</Text>
          <Text style={styles.kicker}>YOUR LEVEL</Text>
          <Text style={styles.resultTitle}>{tier.name}</Text>
          <Text style={styles.resultBlurb}>{tier.blurb}</Text>
          <Text style={styles.resultDetail}>{tier.detail}</Text>

          <View style={styles.scoreCard}>
            {SKILL_TIERS.map((t, tIdx) => (
              <View key={t.id} style={styles.scoreRow}>
                <Text style={styles.scoreTier}>
                  {t.emoji} {t.name}
                </Text>
                <View style={styles.scoreDots}>
                  {Array.from({ length: result.correctByTier[tIdx] ?? 0 }, (_, d) => (
                    <View key={d} style={[styles.dot, styles.dotHit]} />
                  ))}
                  {Array.from({ length: Math.max(0, 3 - (result.correctByTier[tIdx] ?? 0)) }, (_, d) => (
                    <View key={`m${d}`} style={[styles.dot, styles.dotMiss]} />
                  ))}
                </View>
                {t.id === result.tier ? <Text style={styles.scoreYou}>YOU</Text> : null}
              </View>
            ))}
            <Text style={styles.scoreTotal}>
              {result.totalCorrect} / {result.total} overall
            </Text>
          </View>

          <View style={styles.recoBox}>
            <Text style={styles.recoLabel}>START HERE</Text>
            <Text style={styles.recoUnit}>{tier.unitLabel}</Text>
            <Text style={styles.recoText}>
              Lessons below your level still pay chips — rip through them and climb.
            </Text>
          </View>

          <PressButton
            label="Start learning"
            variant="primary"
            onPress={() => router.dismiss()}
            testID="assessment-done"
          />
          <View style={{ height: 8 }} />
          <PressButton label="Retake the check" variant="ghost" onPress={start} />
        </ScrollView>
      </View>
    );
  }

  return null;
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: colors.bg,
  },
  // Intro
  introBody: {
    padding: 20,
    paddingBottom: 48,
  },
  kicker: {
    color: colors.mint,
    fontSize: 12,
    fontFamily: "Outfit_800ExtraBold",
    letterSpacing: 2,
    marginBottom: 6,
  },
  introTitle: {
    color: colors.cream,
    fontSize: 32,
    lineHeight: 36,
    fontFamily: "Outfit_900Black",
    marginBottom: 10,
  },
  introSub: {
    color: colors.muted,
    fontSize: 14.5,
    lineHeight: 21,
    fontFamily: "Outfit_500Medium",
    marginBottom: 20,
  },
  ladder: {
    backgroundColor: colors.surface,
    borderRadius: 18,
    borderWidth: 1,
    borderColor: colors.line,
    padding: 8,
    marginBottom: 20,
  },
  ladderRow: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 10,
    paddingHorizontal: 10,
    borderRadius: 12,
  },
  ladderRowCurrent: {
    backgroundColor: colors.surface2,
  },
  ladderEmoji: {
    fontSize: 22,
    marginRight: 12,
  },
  ladderTextWrap: {
    flex: 1,
  },
  ladderName: {
    color: colors.cream,
    fontSize: 15,
    fontFamily: "Outfit_800ExtraBold",
  },
  ladderBlurb: {
    color: colors.muted,
    fontSize: 12.5,
    fontFamily: "Outfit_500Medium",
  },
  // Quiz
  progressTrack: {
    height: 8,
    borderRadius: 4,
    backgroundColor: colors.surface,
    marginHorizontal: 20,
    overflow: "hidden",
  },
  progressFill: {
    height: "100%",
    borderRadius: 4,
    backgroundColor: colors.good,
  },
  quizMeta: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 20,
    paddingVertical: 12,
  },
  quizCount: {
    color: colors.muted,
    fontSize: 13,
    fontFamily: "Outfit_700Bold",
  },
  tierChip: {
    backgroundColor: colors.surface2,
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderWidth: 1,
    borderColor: colors.line,
  },
  tierChipGood: {
    borderColor: "rgba(67,211,124,0.4)",
  },
  tierChipMiss: {
    borderColor: "rgba(228,87,61,0.4)",
  },
  tierChipText: {
    color: colors.mint,
    fontSize: 11,
    fontFamily: "Outfit_800ExtraBold",
    letterSpacing: 1,
  },
  quizBody: {
    padding: 20,
    paddingBottom: 40,
  },
  question: {
    color: colors.cream,
    fontSize: 21,
    lineHeight: 28,
    fontFamily: "Outfit_800ExtraBold",
    marginBottom: 16,
  },
  exRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 14,
    marginBottom: 16,
    backgroundColor: colors.surface,
    borderRadius: 16,
    padding: 14,
    borderWidth: 1,
    borderColor: colors.line,
  },
  exGroup: {
    alignItems: "flex-start",
  },
  exLabel: {
    color: colors.muted,
    fontSize: 10,
    fontFamily: "Outfit_800ExtraBold",
    letterSpacing: 1.2,
    marginBottom: 6,
  },
  exCards: {
    flexDirection: "row",
    gap: 5,
  },
  exCaption: {
    color: colors.dim,
    fontSize: 11,
    fontFamily: "Outfit_500Medium",
    marginTop: 6,
  },
  opt: {
    backgroundColor: colors.surface,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: colors.line,
    paddingVertical: 15,
    paddingHorizontal: 16,
    marginBottom: 10,
  },
  optRight: {
    borderColor: colors.good,
    backgroundColor: "rgba(67,211,124,0.08)",
  },
  optWrong: {
    borderColor: colors.red,
    backgroundColor: "rgba(228,87,61,0.08)",
  },
  optDim: {
    opacity: 0.45,
  },
  optText: {
    color: colors.cream,
    fontSize: 15,
    lineHeight: 21,
    fontFamily: "Outfit_600SemiBold",
  },
  fbBox: {
    borderRadius: 16,
    padding: 16,
    marginTop: 6,
  },
  fbGood: {
    backgroundColor: "rgba(67,211,124,0.1)",
    borderWidth: 1,
    borderColor: "rgba(67,211,124,0.35)",
  },
  fbBad: {
    backgroundColor: "rgba(228,87,61,0.1)",
    borderWidth: 1,
    borderColor: "rgba(228,87,61,0.35)",
  },
  fbTitle: {
    fontSize: 15,
    fontFamily: "Outfit_800ExtraBold",
    marginBottom: 4,
  },
  fbText: {
    color: colors.cream,
    fontSize: 14,
    lineHeight: 20,
    fontFamily: "Outfit_500Medium",
  },
  nextWrap: {
    paddingHorizontal: 20,
    paddingBottom: 24,
  },
  // Result
  resultBody: {
    padding: 24,
    paddingBottom: 48,
    alignItems: "center",
  },
  resultEmoji: {
    fontSize: 64,
    marginBottom: 8,
  },
  resultTitle: {
    color: colors.cream,
    fontSize: 34,
    fontFamily: "Outfit_900Black",
    marginBottom: 4,
    textAlign: "center",
  },
  resultBlurb: {
    color: colors.mint,
    fontSize: 15,
    fontFamily: "Outfit_700Bold",
    marginBottom: 12,
    textAlign: "center",
  },
  resultDetail: {
    color: colors.muted,
    fontSize: 14,
    lineHeight: 21,
    fontFamily: "Outfit_500Medium",
    textAlign: "center",
    marginBottom: 20,
  },
  scoreCard: {
    width: "100%",
    backgroundColor: colors.surface,
    borderRadius: 18,
    borderWidth: 1,
    borderColor: colors.line,
    padding: 14,
    marginBottom: 14,
  },
  scoreRow: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 6,
  },
  scoreTier: {
    color: colors.cream,
    fontSize: 13.5,
    fontFamily: "Outfit_700Bold",
    width: 96,
  },
  scoreDots: {
    flexDirection: "row",
    gap: 4,
    flex: 1,
  },
  dot: {
    width: 9,
    height: 9,
    borderRadius: 5,
  },
  dotHit: {
    backgroundColor: colors.good,
  },
  dotMiss: {
    backgroundColor: colors.surface2,
    borderWidth: 1,
    borderColor: colors.line,
  },
  scoreYou: {
    color: colors.gold,
    fontSize: 11,
    fontFamily: "Outfit_900Black",
    letterSpacing: 1,
  },
  scoreTotal: {
    color: colors.muted,
    fontSize: 12.5,
    fontFamily: "Outfit_700Bold",
    textAlign: "center",
    marginTop: 6,
  },
  recoBox: {
    width: "100%",
    backgroundColor: "rgba(67,211,124,0.08)",
    borderRadius: 18,
    borderWidth: 1,
    borderColor: "rgba(67,211,124,0.35)",
    padding: 16,
    marginBottom: 20,
  },
  recoLabel: {
    color: colors.good,
    fontSize: 11,
    fontFamily: "Outfit_900Black",
    letterSpacing: 1.5,
    marginBottom: 4,
  },
  recoUnit: {
    color: colors.cream,
    fontSize: 17,
    fontFamily: "Outfit_800ExtraBold",
    marginBottom: 4,
  },
  recoText: {
    color: colors.muted,
    fontSize: 13,
    lineHeight: 19,
    fontFamily: "Outfit_500Medium",
  },
});
