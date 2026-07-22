import { useLocalSearchParams, useRouter } from "expo-router";
import React, { useCallback, useEffect, useMemo, useState } from "react";
import { Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import ChipIcon from "@/components/ChipIcon";
import PlayingCard from "@/components/PlayingCard";
import PressButton from "@/components/PressButton";
import colors from "@/constants/colors";
import { CURRICULUM, MCQuestion, OUTS_SCENARIOS, OutsScenario } from "@/lib/curriculum";
import { Card, compareEval, drawDeck, evaluate, myOdds } from "@/lib/poker";
import { useGame } from "@/providers/GameProvider";

interface DuelData {
  board: Card[];
  hands: [Card[], Card[]];
  names: [string, string];
  win: number;
}

interface BoardData {
  board: Card[];
  hero: Card[];
  // 0 = ahead of a random opponent (win > 50%), 1 = behind (win <= 50%)
  win: 0 | 1;
  heroName: string;
  oddsPct: number;
}

interface PreparedQuestion {
  kind: "mc" | "duel" | "outs" | "board";
  mc?: MCQuestion;
  order?: number[];
  duel?: DuelData;
  outs?: OutsScenario;
  outsOpts?: number[];
  board?: BoardData;
}

interface Feedback {
  good: boolean;
  title: string;
  text: string;
}

const RIGHT_TITLES = ["Sheeesh. ✅", "Easy money. ✅", "You knew that. ✅"];

function makeDuel(): DuelData {
  let board: Card[] = [];
  let h1: Card[] = [];
  let h2: Card[] = [];
  let cmp = 0;
  let names: [string, string] = ["", ""];
  do {
    const used = new Set<number>();
    board = drawDeck(5, used);
    h1 = drawDeck(2, used);
    h2 = drawDeck(2, used);
    const e1 = evaluate([...h1, ...board]);
    const e2 = evaluate([...h2, ...board]);
    cmp = compareEval(e1, e2);
    names = [e1.name, e2.name];
  } while (cmp === 0);
  return { board, hands: [h1, h2], names, win: cmp > 0 ? 0 : 1 };
}

/** Generate a "beat the board" challenge: hero hole + board, are you ahead of a random opponent? */
function makeBoard(): BoardData {
  const used = new Set<number>();
  const board = drawDeck(5, used);
  const hero = drawDeck(2, used);
  const heroEv = evaluate([...hero, ...board]);
  // Monte Carlo vs 1 opponent on the full board (showdown-time odds).
  const o = myOdds(hero, board, 1, 700);
  const win: 0 | 1 = o.winPct > 50 ? 0 : 1;
  return { board, hero, win, heroName: heroEv.name, oddsPct: o.winPct };
}

export default function LessonScreen() {
  const params = useLocalSearchParams<{ unitId: string; lessonId: string; reward: string }>();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { completed, completeLesson, payChips, streak, loseLife } = useGame();

  const unit = useMemo(() => CURRICULUM.find((u) => u.id === params.unitId), [params.unitId]);
  const lesson = useMemo(() => unit?.lessons.find((l) => l.id === params.lessonId), [unit, params.lessonId]);
  const reward = Number(params.reward ?? 0);
  const wasCompletedBefore = useMemo(() => completed.has(params.lessonId ?? ""), [completed, params.lessonId]);

  const [i, setI] = useState<number>(0);
  const [correct, setCorrect] = useState<number>(0);
  const [prepared, setPrepared] = useState<PreparedQuestion | null>(null);
  const [picked, setPicked] = useState<number | null>(null);
  const [feedback, setFeedback] = useState<Feedback | null>(null);
  const [done, setDone] = useState<boolean>(false);
  const [payout, setPayout] = useState<number>(0);

  const total = lesson?.questions.length ?? 0;

  useEffect(() => {
    if (!lesson || i >= lesson.questions.length) return;
    const q = lesson.questions[i];
    if (q.t === "duel") {
      setPrepared({ kind: "duel", duel: makeDuel() });
    } else if (q.t === "outs") {
      const sc = OUTS_SCENARIOS[q.idx];
      const opts = [...new Set([sc.outs, sc.outs + 2, Math.max(1, sc.outs - 2), sc.outs + 4])].sort(() => Math.random() - 0.5);
      setPrepared({ kind: "outs", outs: sc, outsOpts: opts });
    } else if (q.t === "board") {
      setPrepared({ kind: "board", board: makeBoard() });
    } else {
      const order = q.opts.map((_, oi) => oi).sort(() => Math.random() - 0.5);
      setPrepared({ kind: "mc", mc: q, order });
    }
    setPicked(null);
    setFeedback(null);
  }, [lesson, i]);

  const showFB = useCallback((good: boolean, rightTxt: string, wrongTxt: string) => {
    if (good) setCorrect((c) => c + 1);
    else loseLife(); // wrong answer costs a life
    setFeedback({
      good,
      title: good ? RIGHT_TITLES[Math.floor(Math.random() * RIGHT_TITLES.length)] : "Not quite — −1 life 💀",
      text: good ? rightTxt : wrongTxt,
    });
  }, [loseLife]);

  const answerMC = useCallback(
    (pos: number) => {
      if (picked != null || !prepared?.mc || !prepared.order) return;
      setPicked(pos);
      const good = prepared.order[pos] === prepared.mc.a;
      showFB(good, prepared.mc.fb.right, prepared.mc.fb.wrong);
    },
    [picked, prepared, showFB],
  );

  const answerDuel = useCallback(
    (idx: number) => {
      if (picked != null || !prepared?.duel) return;
      setPicked(idx);
      const d = prepared.duel;
      const good = idx === d.win;
      showFB(
        good,
        `${d.names[d.win]} beats ${d.names[1 - d.win]}. Your eyes are getting fast.`,
        `Hand ${d.win === 0 ? "A" : "B"} takes it: ${d.names[d.win]} beats ${d.names[1 - d.win]}. Rankings sheet is one tap away if you need it.`,
      );
    },
    [picked, prepared, showFB],
  );

  const answerOuts = useCallback(
    (v: number) => {
      if (picked != null || !prepared?.outs) return;
      setPicked(v);
      const sc = prepared.outs;
      showFB(v === sc.outs, sc.why, sc.why);
    },
    [picked, prepared, showFB],
  );

  const answerBoard = useCallback(
    (ahead: boolean) => {
      if (picked != null || !prepared?.board) return;
      // ahead === true maps to choice 0 ("ahead"), false maps to choice 1 ("behind")
      const choice = ahead ? 0 : 1;
      setPicked(choice);
      const b = prepared.board;
      const good = choice === b.win;
      const pct = b.oddsPct.toFixed(0);
      showFB(
        good,
        `Right — you have ${b.heroName} and ~${pct}% vs one opponent. ${b.win === 0 ? "You're ahead — bet for value." : "You're behind — careful."}`,
        `You have ${b.heroName} and ~${pct}% vs one opponent. ${b.win === 0 ? "You're actually AHEAD here — bet for value." : "You're actually BEHIND here — pot odds decide."}`,
      );
    },
    [picked, prepared, showFB],
  );

  const nextQuestion = useCallback(() => {
    setFeedback(null);
    const next = i + 1;
    if (next < total) {
      setI(next);
      return;
    }
    // lesson complete — pay out chips earned from performance (free entry)
    const finalCorrect = correct;
    const frac = total > 0 ? finalCorrect / total : 0;
    const base = lesson?.boss ? reward * 2 : reward;
    let p = Math.round((base * (0.4 + 1.6 * frac)) / 5) * 5;
    if (wasCompletedBefore) p = Math.round(p / 2 / 5) * 5; // replay pays half
    setPayout(p);
    if (lesson) completeLesson(lesson.id);
    if (p > 0) payChips(p, true);
    setDone(true);
  }, [i, total, correct, reward, wasCompletedBefore, lesson, completeLesson, payChips]);

  const quit = useCallback(() => {
    router.back();
  }, [router]);

  if (!unit || !lesson) {
    return (
      <View style={[styles.screen, styles.center]}>
        <Text style={styles.qText}>Lesson not found.</Text>
        <PressButton label="Back" variant="ghost" onPress={quit} />
      </View>
    );
  }

  if (done) {
    const frac = total > 0 ? correct / total : 0;
    const net = payout;
    return (
      <View style={[styles.screen, { paddingTop: insets.top }]}>
        <View style={styles.doneWrap}>
          <Text style={styles.doneIcon}>{frac === 1 ? "🏆" : frac >= 0.5 ? "🎉" : "😬"}</Text>
          <Text style={styles.doneTitle}>
            {frac === 1 ? "Perfect — max cash-out!" : frac >= 0.5 ? "Cashed out!" : "Rough table…"}
          </Text>
          <Text style={styles.doneSub}>
            {correct}/{total} right{wasCompletedBefore ? " · replay pays half" : ""}{payout === 0 ? " · no chips this time" : ""}
          </Text>
          <View style={styles.rewardRow}>
            <View style={styles.reward}>
              <View style={styles.rewardChipRow}>
                <ChipIcon size={14} />
                <Text style={[styles.rewardV, { color: colors.chipText }]}>{payout}</Text>
              </View>
              <Text style={styles.rewardK}>cash-out</Text>
            </View>
            <View style={styles.reward}>
              <Text style={[styles.rewardV, { color: payout > 0 ? colors.good : colors.dim }]}>
                {payout > 0 ? "+" : ""}
                {payout}
              </Text>
              <Text style={styles.rewardK}>earned</Text>
            </View>
            <View style={styles.reward}>
              <Text style={styles.rewardV}>🔥 {streak}</Text>
              <Text style={styles.rewardK}>streak</Text>
            </View>
          </View>
          <PressButton label="Keep it going" onPress={quit} style={{ alignSelf: "stretch" }} testID="finish-lesson" />
        </View>
      </View>
    );
  }

  const progress = total > 0 ? Math.max(5, (i / total) * 100) : 5;

  return (
    <View style={[styles.screen, { paddingTop: insets.top }]}>
      <View style={styles.quizTop}>
        <Pressable onPress={quit} hitSlop={12} testID="quit-lesson">
          <Text style={styles.quizX}>✕</Text>
        </Pressable>
        <View style={styles.qbar}>
          <View style={[styles.qbarFill, { width: `${progress}%` }]} />
        </View>
        <View style={styles.potPill}>
          <ChipIcon size={13} />
          <Text style={styles.potText}>+{reward}</Text>
        </View>
      </View>

      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.qwrap}>
        <Text style={styles.qTag}>
          {lesson.title} · {i + 1}/{total}
        </Text>

        {prepared?.kind === "mc" && prepared.mc && prepared.order && (
          <>
            <Text style={styles.qText}>{prepared.mc.q}</Text>
            {prepared.order.map((oi, pos) => {
              const isRight = picked != null && oi === prepared.mc?.a;
              const isWrong = picked === pos && oi !== prepared.mc?.a;
              return (
                <Pressable
                  key={pos}
                  onPress={() => answerMC(pos)}
                  style={[styles.opt, isRight && styles.optRight, isWrong && styles.optWrong]}
                  testID={`opt-${pos}`}
                >
                  <Text style={[styles.optText, isRight && { color: colors.good }, isWrong && { color: colors.red }]}>
                    {prepared.mc?.opts[oi]}
                  </Text>
                </Pressable>
              );
            })}
          </>
        )}

        {prepared?.kind === "duel" && prepared.duel && (
          <>
            <Text style={styles.qText}>Board&apos;s out. Which hand wins?</Text>
            <View style={styles.boardStrip}>
              {prepared.duel.board.map((c, ci) => (
                <PlayingCard key={ci} card={c} size="tiny" />
              ))}
            </View>
            <View style={styles.duelRow}>
              {[0, 1].map((hi) => {
                const isRight = picked != null && hi === prepared.duel?.win;
                const isWrong = picked === hi && hi !== prepared.duel?.win;
                return (
                  <React.Fragment key={hi}>
                    {hi === 1 && <Text style={styles.duelVs}>VS</Text>}
                    <Pressable
                      onPress={() => answerDuel(hi)}
                      style={[styles.handOpt, isRight && styles.handRight, isWrong && styles.handWrong]}
                      testID={`duel-${hi}`}
                    >
                      <Text style={styles.handWho}>Hand {hi === 0 ? "A" : "B"}</Text>
                      <View style={styles.handCards}>
                        {prepared.duel?.hands[hi].map((c, ci) => <PlayingCard key={ci} card={c} size="tiny" />)}
                      </View>
                    </Pressable>
                  </React.Fragment>
                );
              })}
            </View>
          </>
        )}

        {prepared?.kind === "outs" && prepared.outs && prepared.outsOpts && (
          <>
            <Text style={styles.qText}>Count the outs — how many cards improve you?</Text>
            <Text style={styles.sectionLabel}>Your hand</Text>
            <View style={styles.boardStrip}>
              {prepared.outs.hand.map((c, ci) => <PlayingCard key={ci} card={c} size="tiny" />)}
            </View>
            <Text style={[styles.sectionLabel, { marginTop: 10 }]}>The flop</Text>
            <View style={styles.boardStrip}>
              {prepared.outs.board.map((c, ci) => <PlayingCard key={ci} card={c} size="tiny" />)}
            </View>
            <View style={styles.outsRow}>
              {prepared.outsOpts.map((o) => {
                const isRight = picked != null && o === prepared.outs?.outs;
                const isWrong = picked === o && o !== prepared.outs?.outs;
                return (
                  <Pressable
                    key={o}
                    onPress={() => answerOuts(o)}
                    style={[styles.outsBtn, isRight && styles.outsRight, isWrong && styles.outsWrong]}
                    testID={`outs-${o}`}
                  >
                    <Text style={[styles.outsBtnText, isRight && { color: colors.good }, isWrong && { color: colors.red }]}>
                      {o}
                    </Text>
                  </Pressable>
                );
              })}
            </View>
          </>
        )}

        {prepared?.kind === "board" && prepared.board && (
          <>
            <Text style={styles.qText}>Beat the board — are you ahead or behind a random opponent?</Text>
            <Text style={styles.sectionLabel}>Your hand</Text>
            <View style={styles.boardStrip}>
              {prepared.board.hero.map((c, ci) => <PlayingCard key={ci} card={c} size="small" />)}
            </View>
            <Text style={[styles.sectionLabel, { marginTop: 10 }]}>The board</Text>
            <View style={styles.boardStrip}>
              {prepared.board.board.map((c, ci) => <PlayingCard key={ci} card={c} size="small" />)}
            </View>
            <Text style={styles.boardHint}>You have {prepared.board.heroName}. Are you ahead of one random opponent?</Text>
            <View style={styles.duelRow}>
              <Pressable
                onPress={() => answerBoard(true)}
                style={[
                  styles.handOpt,
                  picked != null && prepared.board.win === 0 && styles.handRight,
                  picked === 0 && prepared.board.win !== 0 && styles.handWrong,
                ]}
                testID="board-ahead"
              >
                <Text style={styles.handWho}>Ahead 💪</Text>
                <Text style={styles.boardOptSub}>Bet for value</Text>
              </Pressable>
              <Pressable
                onPress={() => answerBoard(false)}
                style={[
                  styles.handOpt,
                  picked != null && prepared.board.win === 1 && styles.handRight,
                  picked === 1 && prepared.board.win !== 1 && styles.handWrong,
                ]}
                testID="board-behind"
              >
                <Text style={styles.handWho}>Behind 🪨</Text>
                <Text style={styles.boardOptSub}>Pot odds decide</Text>
              </Pressable>
            </View>
          </>
        )}
      </ScrollView>

      {feedback && (
        <View style={[styles.feedback, feedback.good ? styles.fbGood : styles.fbBad, { paddingBottom: insets.bottom + 20 }]}>
          <Text style={[styles.fbTitle, { color: feedback.good ? colors.good : colors.red }]}>{feedback.title}</Text>
          <Text style={styles.fbText}>{feedback.text}</Text>
          <PressButton label="Continue" onPress={nextQuestion} testID="continue-button" />
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.bg },
  center: { alignItems: "center", justifyContent: "center", padding: 24 },
  quizTop: {
    flexDirection: "row",
    alignItems: "center",
    gap: 14,
    paddingHorizontal: 20,
    paddingTop: 18,
    paddingBottom: 6,
  },
  quizX: { color: colors.dim, fontSize: 22, fontFamily: "Outfit_700Bold" },
  qbar: {
    flex: 1,
    height: 14,
    backgroundColor: colors.surface,
    borderRadius: 99,
    borderWidth: 1,
    borderColor: colors.line,
    overflow: "hidden",
  },
  qbarFill: { height: "100%", backgroundColor: colors.mint, borderRadius: 99 },
  potPill: {
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
  potText: { fontFamily: "Outfit_800ExtraBold", fontSize: 13, color: colors.chipText },
  qwrap: { padding: 20, paddingBottom: 220 },
  qTag: {
    color: colors.mint,
    fontFamily: "Outfit_800ExtraBold",
    fontSize: 12.5,
    letterSpacing: 1.2,
    textTransform: "uppercase",
    marginBottom: 10,
  },
  qText: {
    fontSize: 20,
    fontFamily: "Outfit_800ExtraBold",
    lineHeight: 27,
    letterSpacing: -0.3,
    marginBottom: 22,
    color: colors.cream,
  },
  opt: {
    padding: 16,
    marginBottom: 12,
    borderRadius: 16,
    backgroundColor: colors.surface,
    borderWidth: 2,
    borderColor: colors.line,
  },
  optRight: { borderColor: colors.good, backgroundColor: "rgba(67,209,124,0.12)" },
  optWrong: { borderColor: colors.red, backgroundColor: "rgba(228,87,61,0.12)" },
  optText: { color: colors.cream, fontSize: 15.5, fontFamily: "Outfit_600SemiBold" },
  boardStrip: { flexDirection: "row", gap: 7, justifyContent: "center", marginVertical: 6 },
  duelRow: { flexDirection: "row", gap: 10, marginTop: 16, alignItems: "center" },
  handOpt: {
    flex: 1,
    backgroundColor: colors.surface,
    borderWidth: 2,
    borderColor: colors.line,
    borderRadius: 20,
    paddingVertical: 14,
    paddingHorizontal: 8,
    alignItems: "center",
    gap: 10,
  },
  handRight: { borderColor: colors.good, backgroundColor: "rgba(67,209,124,0.1)" },
  handWrong: { borderColor: colors.red, backgroundColor: "rgba(228,87,61,0.1)" },
  handWho: {
    fontSize: 12,
    fontFamily: "Outfit_800ExtraBold",
    color: colors.muted,
    letterSpacing: 1,
    textTransform: "uppercase",
  },
  handCards: { flexDirection: "row", gap: 6 },
  duelVs: { fontFamily: "Outfit_900Black", color: colors.dim, fontSize: 14 },
  sectionLabel: {
    fontSize: 11.5,
    fontFamily: "Outfit_800ExtraBold",
    letterSpacing: 1.6,
    color: colors.dim,
    textTransform: "uppercase",
    textAlign: "center",
    marginBottom: 6,
  },
  outsRow: { flexDirection: "row", gap: 8, justifyContent: "center", flexWrap: "wrap", marginTop: 18 },
  outsBtn: {
    width: 52,
    height: 52,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: colors.line,
    backgroundColor: colors.surface,
    alignItems: "center",
    justifyContent: "center",
  },
  outsRight: { backgroundColor: "rgba(67,209,124,0.15)", borderColor: colors.good },
  outsWrong: { backgroundColor: "rgba(228,87,61,0.15)", borderColor: colors.red },
  outsBtnText: { color: colors.cream, fontFamily: "Outfit_900Black", fontSize: 18 },
  boardHint: {
    fontSize: 13,
    color: colors.mint2,
    fontFamily: "Outfit_600SemiBold",
    textAlign: "center",
    marginVertical: 14,
    lineHeight: 18,
  },
  boardOptSub: { fontSize: 11, color: colors.muted, fontFamily: "Outfit_600SemiBold", marginTop: 4 },
  feedback: {
    position: "absolute",
    bottom: 0,
    left: 0,
    right: 0,
    padding: 20,
    borderTopLeftRadius: 26,
    borderTopRightRadius: 26,
    borderTopWidth: 2,
  },
  fbGood: { backgroundColor: "#0D2B1B", borderTopColor: colors.good },
  fbBad: { backgroundColor: "#2E120D", borderTopColor: colors.red },
  fbTitle: { fontSize: 18, fontFamily: "Outfit_900Black", marginBottom: 6 },
  fbText: {
    fontSize: 14.5,
    lineHeight: 21,
    color: colors.cream,
    opacity: 0.92,
    marginBottom: 16,
    fontFamily: "Outfit_500Medium",
  },
  doneWrap: { flex: 1, alignItems: "center", justifyContent: "center", padding: 28 },
  doneIcon: { fontSize: 72 },
  doneTitle: {
    fontSize: 25,
    fontFamily: "Outfit_900Black",
    marginTop: 14,
    marginBottom: 6,
    letterSpacing: -0.5,
    color: colors.cream,
    textAlign: "center",
  },
  doneSub: { color: colors.muted, fontSize: 15, marginBottom: 26, fontFamily: "Outfit_500Medium" },
  rewardRow: { flexDirection: "row", gap: 12, justifyContent: "center", marginBottom: 28 },
  reward: {
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.line,
    borderRadius: 18,
    paddingVertical: 14,
    paddingHorizontal: 20,
    minWidth: 100,
    alignItems: "center",
  },
  rewardChipRow: { flexDirection: "row", alignItems: "center", gap: 6 },
  rewardV: { fontSize: 23, fontFamily: "Outfit_900Black", color: colors.cream },
  rewardK: {
    fontSize: 10.5,
    fontFamily: "Outfit_700Bold",
    letterSpacing: 1,
    color: colors.muted,
    textTransform: "uppercase",
    marginTop: 2,
  },
});
