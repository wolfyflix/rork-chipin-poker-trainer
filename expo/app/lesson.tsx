import { useLocalSearchParams, useRouter } from "expo-router";
import React, { useCallback, useEffect, useMemo, useState } from "react";
import { Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import ChipIcon from "@/components/ChipIcon";
import PlayingCard from "@/components/PlayingCard";
import PressButton from "@/components/PressButton";
import colors from "@/constants/colors";
import { CURRICULUM, ExampleHand, HAND_NAMES, MCQuestion, OUTS_SCENARIOS, OutsScenario, PrimerBlock } from "@/lib/curriculum";
import { Card, compareEval, drawDeck, evaluate, myOdds, oddsVerdict } from "@/lib/poker";
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

interface NameData {
  cards: Card[]; // 7 cards (2 hero + 5 board) — but we show 5 as the "hand"
  hand: Card[]; // the 5 cards to display
  correctName: string;
  opts: string[]; // 4 options, correct at index `answer`
  answer: number;
}

interface MoveData {
  hero: Card[];
  board: Card[];
  heroName: string;
  winPct: number;
  pot: number;
  oppBet: number;
  // 0 = fold, 1 = call, 2 = raise
  answer: 0 | 1 | 2;
  why: string;
}

interface PreparedQuestion {
  kind: "mc" | "duel" | "outs" | "board" | "name" | "move";
  mc?: MCQuestion;
  order?: number[];
  duel?: DuelData;
  outs?: OutsScenario;
  outsOpts?: number[];
  board?: BoardData;
  name?: NameData;
  move?: MoveData;
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

/** Map an eval category to a hand-name label (matching HAND_NAMES order). */
function catToName(cat: number, kick0: number): string {
  if (cat === 8) return kick0 === 14 ? "Royal Flush" : "Straight Flush";
  if (cat === 7) return "Four of a Kind";
  if (cat === 6) return "Full House";
  if (cat === 5) return "Flush";
  if (cat === 4) return "Straight";
  if (cat === 3) return "Three of a Kind";
  if (cat === 2) return "Two Pair";
  if (cat === 1) return "Pair";
  return "High Card";
}

/** Generate a Name That Hand challenge — show 5 cards, pick the correct hand name. */
function makeName(): NameData {
  // Draw 5 cards that form a recognizable 5-card hand.
  const used = new Set<number>();
  // ~70% chance: draw a random 5-card hand (often high card / pair).
  // ~30% chance: force a stronger hand by drawing 7 and taking the best 5.
  let hand: Card[];
  let ev;
  if (Math.random() < 0.3) {
    const seven = drawDeck(7, used);
    ev = evaluate(seven);
    // We can't easily extract the best 5, so just show all 7... no.
    // Instead, show 5 and evaluate those 5 directly.
    hand = seven.slice(0, 5);
    ev = evaluate(hand);
  } else {
    hand = drawDeck(5, used);
    ev = evaluate(hand);
  }
  const correctName = catToName(ev.cat, ev.kick[0]);
  // Build 4 options: correct + 3 random distractors from HAND_NAMES.
  const distractors = HAND_NAMES.filter((n) => n !== correctName)
    .sort(() => Math.random() - 0.5)
    .slice(0, 3);
  const opts = [...distractors, correctName].sort(() => Math.random() - 0.5);
  const answer = opts.indexOf(correctName);
  return { cards: hand, hand, correctName, opts, answer };
}

/** Generate a Bet or Fold challenge — hero + board + pot + opp bet → fold/call/raise. */
function makeMove(): MoveData {
  const used = new Set<number>();
  const boardLen = [3, 4, 5][Math.floor(Math.random() * 3)];
  const board = drawDeck(boardLen, used);
  const hero = drawDeck(2, used);
  const heroEv = evaluate([...hero, ...board]);
  const o = myOdds(hero, board, 1, 500);
  const winPct = o.winPct;
  const pot = [100, 150, 200, 250, 300][Math.floor(Math.random() * 5)];
  const oppBet = Math.round(pot * [0.33, 0.5, 0.75, 1][Math.floor(Math.random() * 4)]);
  let answer: 0 | 1 | 2;
  let why: string;
  if (winPct >= 60) {
    answer = 2;
    why = `~${winPct.toFixed(0)}% vs one opponent — you're ahead. Raise for value and build the pot.`;
  } else if (winPct >= 33) {
    answer = 1;
    why = `~${winPct.toFixed(0)}% — close to your fair share. The price is okay to call, but don't get married to it.`;
  } else {
    answer = 0;
    why = `~${winPct.toFixed(0)}% — behind. You're not getting the right price. Fold and save chips.`;
  }
  return { hero, board, heroName: heroEv.name, winPct, pot, oppBet, answer, why };
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
  const { completed, completeLesson, payChips, streak, loseLife, awardXp } = useGame();

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
  const [phase, setPhase] = useState<"primer" | "quiz">("primer");

  const total = lesson?.questions.length ?? 0;

  const startQuiz = useCallback(() => setPhase("quiz"), []);

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
    } else if (q.t === "name") {
      setPrepared({ kind: "name", name: makeName() });
    } else if (q.t === "move") {
      setPrepared({ kind: "move", move: makeMove() });
    } else {
      const order = q.opts.map((_, oi) => oi).sort(() => Math.random() - 0.5);
      setPrepared({ kind: "mc", mc: q, order });
    }
    setPicked(null);
    setFeedback(null);
  }, [lesson, i]);

  const showFB = useCallback((good: boolean, rightTxt: string, wrongTxt: string) => {
    if (good) {
      setCorrect((c) => c + 1);
      awardXp();
    } else {
      loseLife(); // wrong answer costs a life
    }
    setFeedback({
      good,
      title: good ? RIGHT_TITLES[Math.floor(Math.random() * RIGHT_TITLES.length)] : "Not quite — −1 life 💀",
      text: good ? rightTxt : wrongTxt,
    });
  }, [loseLife, awardXp]);

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

  const answerName = useCallback(
    (pos: number) => {
      if (picked != null || !prepared?.name) return;
      setPicked(pos);
      const n = prepared.name;
      const good = pos === n.answer;
      showFB(
        good,
        `Correct — that's a ${n.correctName}. Hand-reading getting fast.`,
        `That hand is a ${n.correctName}. Rankings ladder: high card → pair → two pair → trips → straight → flush → full house → quads → straight flush.`,
      );
    },
    [picked, prepared, showFB],
  );

  const answerMove = useCallback(
    (choice: 0 | 1 | 2) => {
      if (picked != null || !prepared?.move) return;
      setPicked(choice);
      const m = prepared.move;
      const good = choice === m.answer;
      const labels = ["Fold", "Call", "Raise"];
      showFB(
        good,
        `${labels[choice]} was right. ${m.why}`,
        `Best move: ${labels[m.answer]}. ${m.why}`,
      );
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

  if (phase === "primer" && lesson.primer) {
    return <PrimerScreen primer={lesson.primer} onStart={startQuiz} onSkip={quit} insets={insets} title={lesson.title} />;
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
            {prepared.mc.ex && prepared.mc.ex.length > 0 && (
              <View style={styles.exWrap}>
                {prepared.mc.ex.map((eh, ei) => (
                  <ExampleHandView key={ei} hand={eh} />
                ))}
              </View>
            )}
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

        {prepared?.kind === "name" && prepared.name && (
          <>
            <Text style={styles.qText}>Name that hand — what do these 5 cards make?</Text>
            <View style={styles.boardStrip}>
              {prepared.name.hand.map((c, ci) => <PlayingCard key={ci} card={c} size="small" />)}
            </View>
            <Text style={styles.boardHint}>Tap the hand type that matches the 5 cards above.</Text>
            {prepared.name.opts.map((opt, pos) => {
              const isRight = picked != null && pos === prepared.name?.answer;
              const isWrong = picked === pos && pos !== prepared.name?.answer;
              return (
                <Pressable
                  key={pos}
                  onPress={() => answerName(pos)}
                  style={[styles.opt, isRight && styles.optRight, isWrong && styles.optWrong]}
                  testID={`name-${pos}`}
                >
                  <Text style={[styles.optText, isRight && { color: colors.good }, isWrong && { color: colors.red }]}>
                    {opt}
                  </Text>
                </Pressable>
              );
            })}
          </>
        )}

        {prepared?.kind === "move" && prepared.move && (
          <>
            <Text style={styles.qText}>Bet or fold — what do you do?</Text>
            <Text style={styles.sectionLabel}>Your hand · {prepared.move.heroName}</Text>
            <View style={styles.boardStrip}>
              {prepared.move.hero.map((c, ci) => <PlayingCard key={ci} card={c} size="small" />)}
            </View>
            {prepared.move.board.length > 0 && (
              <>
                <Text style={[styles.sectionLabel, { marginTop: 10 }]}>The board</Text>
                <View style={styles.boardStrip}>
                  {prepared.move.board.map((c, ci) => <PlayingCard key={ci} card={c} size="small" />)}
                </View>
              </>
            )}
            <View style={styles.movePotRow}>
              <View style={styles.movePotPill}>
                <Text style={styles.movePotK}>POT</Text>
                <Text style={styles.movePotV}>{prepared.move.pot}</Text>
              </View>
              <View style={[styles.movePotPill, { borderColor: colors.red }]}>
                <Text style={styles.movePotK}>HE BET</Text>
                <Text style={[styles.movePotV, { color: colors.red }]}>{prepared.move.oppBet}</Text>
              </View>
              <View style={[styles.movePotPill, { borderColor: colors.gold }]}>
                <Text style={styles.movePotK}>YOUR %</Text>
                <Text style={[styles.movePotV, { color: colors.gold2 }]}>{prepared.move.winPct.toFixed(0)}</Text>
              </View>
            </View>
            <View style={styles.moveRow}>
              {(["Fold", "Call", "Raise"] as const).map((label, idx) => {
                const choice = idx as 0 | 1 | 2;
                const isRight = picked != null && choice === prepared.move?.answer;
                const isWrong = picked === choice && choice !== prepared.move?.answer;
                const emoji = ["🚪", "🤝", "🚀"][idx] ?? "";
                return (
                  <Pressable
                    key={idx}
                    onPress={() => answerMove(choice)}
                    style={[
                      styles.moveBtn,
                      isRight && styles.moveRight,
                      isWrong && styles.moveWrong,
                    ]}
                    testID={`move-${label.toLowerCase()}`}
                  >
                    <Text style={styles.moveEmoji}>{emoji}</Text>
                    <Text style={[styles.moveBtnText, isRight && { color: colors.good }, isWrong && { color: colors.red }]}>
                      {label}
                    </Text>
                  </Pressable>
                );
              })}
            </View>
            <Text style={styles.boardHint}>Think: are you getting the right price? Should you build the pot?</Text>
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
  movePotRow: { flexDirection: "row", gap: 10, justifyContent: "center", marginVertical: 14 },
  movePotPill: {
    alignItems: "center",
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.line,
    borderRadius: 14,
    paddingVertical: 8,
    paddingHorizontal: 14,
    minWidth: 86,
  },
  movePotK: { fontSize: 9, fontFamily: "Outfit_800ExtraBold", letterSpacing: 1.3, color: colors.dim, textTransform: "uppercase" },
  movePotV: { fontSize: 18, fontFamily: "Outfit_900Black", color: colors.cream, marginTop: 2 },
  moveRow: { flexDirection: "row", gap: 12, marginTop: 6 },
  moveBtn: {
    flex: 1,
    alignItems: "center",
    backgroundColor: colors.surface,
    borderWidth: 2,
    borderColor: colors.line,
    borderRadius: 18,
    paddingVertical: 16,
    gap: 6,
  },
  moveRight: { borderColor: colors.good, backgroundColor: "rgba(67,209,124,0.12)" },
  moveWrong: { borderColor: colors.red, backgroundColor: "rgba(228,87,61,0.12)" },
  moveEmoji: { fontSize: 22 },
  moveBtnText: { fontFamily: "Outfit_900Black", fontSize: 15, color: colors.cream, letterSpacing: 0.3 },
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
  exWrap: { gap: 12, marginBottom: 22 },
  exCard: {
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.line,
    borderRadius: 18,
    paddingVertical: 14,
    paddingHorizontal: 16,
  },
  exLabelRow: { flexDirection: "row", alignItems: "center", gap: 8, marginBottom: 8 },
  exLabelTag: {
    fontSize: 10,
    fontFamily: "Outfit_800ExtraBold",
    letterSpacing: 1.3,
    color: colors.mint,
    textTransform: "uppercase",
  },
  exCards: { flexDirection: "row", gap: 6, justifyContent: "center", flexWrap: "wrap" },
  exCaption: {
    fontSize: 12.5,
    color: colors.muted,
    fontFamily: "Outfit_500Medium",
    textAlign: "center",
    marginTop: 8,
    lineHeight: 17,
  },
  exNoCards: {
    fontSize: 13,
    color: colors.mint2,
    fontFamily: "Outfit_700Bold",
    textAlign: "center",
    paddingVertical: 4,
  },
  primerScreen: { flex: 1, backgroundColor: colors.bg },
  primerHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 20,
    paddingTop: 18,
    paddingBottom: 8,
  },
  primerBadge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.mint,
    borderRadius: 999,
    paddingVertical: 6,
    paddingHorizontal: 12,
  },
  primerBadgeText: {
    fontSize: 11,
    fontFamily: "Outfit_800ExtraBold",
    letterSpacing: 1.4,
    color: colors.mint,
    textTransform: "uppercase",
  },
  primerScroll: { padding: 20, paddingBottom: 120 },
  primerTitle: {
    fontSize: 27,
    fontFamily: "Outfit_900Black",
    letterSpacing: -0.5,
    color: colors.cream,
    marginTop: 8,
    marginBottom: 8,
  },
  primerTagline: {
    fontSize: 15,
    color: colors.mint2,
    fontFamily: "Outfit_600SemiBold",
    marginBottom: 24,
    lineHeight: 21,
  },
  primerBlock: {
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.line,
    borderRadius: 22,
    padding: 18,
    marginBottom: 14,
  },
  primerBlockH: {
    fontSize: 17,
    fontFamily: "Outfit_800ExtraBold",
    color: colors.cream,
    marginBottom: 8,
    letterSpacing: -0.2,
  },
  primerBlockP: {
    fontSize: 14.5,
    lineHeight: 22,
    color: colors.cream,
    opacity: 0.88,
    fontFamily: "Outfit_500Medium",
    marginBottom: 8,
  },
  primerExBox: {
    marginTop: 12,
    backgroundColor: colors.bg,
    borderWidth: 1,
    borderColor: colors.line,
    borderRadius: 16,
    paddingVertical: 14,
    paddingHorizontal: 12,
  },
  primerExLabel: {
    fontSize: 10.5,
    fontFamily: "Outfit_800ExtraBold",
    letterSpacing: 1.3,
    color: colors.mint,
    textTransform: "uppercase",
    textAlign: "center",
    marginBottom: 8,
  },
  primerExCards: { flexDirection: "row", gap: 6, justifyContent: "center", flexWrap: "wrap" },
  primerExCaption: {
    fontSize: 12.5,
    color: colors.muted,
    fontFamily: "Outfit_500Medium",
    textAlign: "center",
    marginTop: 8,
    lineHeight: 17,
  },
  primerExTextOnly: {
    fontSize: 13.5,
    color: colors.mint2,
    fontFamily: "Outfit_700Bold",
    textAlign: "center",
    paddingVertical: 6,
  },
  primerCta: {
    position: "absolute",
    bottom: 0,
    left: 0,
    right: 0,
    padding: 20,
    paddingBottom: 28,
    backgroundColor: colors.bg,
    borderTopWidth: 1,
    borderTopColor: colors.line,
  },
  primerSkip: {
    fontSize: 13,
    color: colors.dim,
    fontFamily: "Outfit_600SemiBold",
    textAlign: "center",
    marginTop: 12,
  },
});

/** Render a single example hand inside an MC question. */
function ExampleHandView({ hand }: { hand: ExampleHand }) {
  return (
    <View style={styles.exCard}>
      {hand.label && (
        <View style={styles.exLabelRow}>
          <View style={{ width: 6, height: 6, borderRadius: 3, backgroundColor: colors.mint }} />
          <Text style={styles.exLabelTag}>{hand.label}</Text>
        </View>
      )}
      {hand.cards.length > 0 ? (
        <View style={styles.exCards}>
          {hand.cards.map((c, ci) => (
            <PlayingCard key={ci} card={c} size="small" />
          ))}
        </View>
      ) : (
        <Text style={styles.exNoCards}>— no cards —</Text>
      )}
      <Text style={styles.exCaption}>{hand.caption}</Text>
    </View>
  );
}

/** Visual tutorial shown before a lesson's questions. */
function PrimerScreen({
  primer,
  onStart,
  onSkip,
  insets,
  title,
}: {
  primer: { tagline: string; blocks: PrimerBlock[] };
  onStart: () => void;
  onSkip: () => void;
  insets: { top: number; bottom: number };
  title: string;
}) {
  return (
    <View style={[styles.primerScreen, { paddingTop: insets.top }]}>
      <View style={styles.primerHeader}>
        <View style={styles.primerBadge}>
          <Text style={{ fontSize: 13 }}>📖</Text>
          <Text style={styles.primerBadgeText}>Before we start</Text>
        </View>
        <Pressable onPress={onSkip} hitSlop={12} testID="primer-skip">
          <Text style={styles.quizX}>✕</Text>
        </Pressable>
      </View>

      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.primerScroll}>
        <Text style={styles.primerTitle}>{title}</Text>
        <Text style={styles.primerTagline}>{primer.tagline}</Text>

        {primer.blocks.map((b, bi) => (
          <View key={bi} style={styles.primerBlock}>
            <Text style={styles.primerBlockH}>{b.h}</Text>
            <Text style={styles.primerBlockP}>{b.p}</Text>
            {b.ex && b.ex.length > 0 && (
              <View style={{ gap: 12 }}>
                {b.ex.map((eh, ei) => (
                  <View key={ei} style={styles.primerExBox}>
                    {eh.label && <Text style={styles.primerExLabel}>{eh.label}</Text>}
                    {eh.cards.length > 0 ? (
                      <View style={styles.primerExCards}>
                        {eh.cards.map((c, ci) => (
                          <PlayingCard key={ci} card={c} size="small" />
                        ))}
                      </View>
                    ) : (
                      <Text style={styles.primerExTextOnly}>{eh.caption}</Text>
                    )}
                    {eh.cards.length > 0 && <Text style={styles.primerExCaption}>{eh.caption}</Text>}
                  </View>
                ))}
              </View>
            )}
          </View>
        ))}
      </ScrollView>

      <View style={[styles.primerCta, { paddingBottom: insets.bottom + 20 }]}>
        <PressButton label="Start the lesson" onPress={onStart} testID="primer-start" />
        <Pressable onPress={onSkip} style={{ alignSelf: "center", marginTop: 10 }} hitSlop={8}>
          <Text style={styles.primerSkip}>Skip tutorial</Text>
        </Pressable>
      </View>
    </View>
  );
}
