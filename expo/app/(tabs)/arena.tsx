import React, { useCallback, useEffect, useRef, useState } from "react";
import { Pressable, ScrollView, StyleSheet, Switch, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import ChipIcon from "@/components/ChipIcon";
import PlayingCard from "@/components/PlayingCard";
import PressButton from "@/components/PressButton";
import TopBar from "@/components/TopBar";
import colors from "@/constants/colors";
import { HAND_NAMES, OUTS_SCENARIOS, SWIPE_HANDS } from "@/lib/curriculum";
import { Card, compareEval, drawDeck, evaluate, myOdds } from "@/lib/poker";
import { ArenaHighs, useGame } from "@/providers/GameProvider";

type GameId = keyof ArenaHighs;
type Phase = "menu" | "how" | "playing" | "over";

interface WHWRound {
  board: Card[];
  hands: [Card[], Card[]];
  win: number;
  odds: [number, number];
}

interface BeatRound {
  board: Card[];
  hero: Card[];
  // 0 = ahead of a random opponent (win > 50%), 1 = behind
  win: 0 | 1;
  heroName: string;
  oddsPct: number;
}

interface NameRound {
  hand: Card[];
  correctName: string;
  opts: string[];
  answer: number;
}

interface MoveRound {
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

interface GameMeta {
  id: GameId;
  icon: string;
  title: string;
  sub: string;
  secs: number;
  hardSecs: number;
  chips: number;
  endMsg: string;
  how: string[];
}

const GAMES: GameMeta[] = [
  {
    id: "whw",
    icon: "⚡",
    title: "Which Hand Wins?",
    sub: "Two hands, one board — tap the winner.",
    secs: 30, hardSecs: 20, chips: 10,
    endMsg: "Reflexes: building.",
    how: [
      "You see a 5-card board and two hands (A & B).",
      "Tap the hand you think wins at showdown.",
      "Correct = +10 chips. Wrong = no chips, next round.",
      "You have 30 seconds. Beat your high score.",
    ],
  },
  {
    id: "outs",
    icon: "🎯",
    title: "Count the Outs",
    sub: "Pick the exact number of outs.",
    secs: 45, hardSecs: 30, chips: 15,
    endMsg: "Outs math: the skill that pays.",
    how: [
      "You see your hand + the flop.",
      "Pick the exact number of outs that improve you.",
      "Correct = +15 chips. Four options, one is right.",
      "45 seconds. Hard mode = closer options.",
    ],
  },
  {
    id: "swipe",
    icon: "🃏",
    title: "Preflop Swipe",
    sub: "Play it or fold it — Tinder for hands.",
    secs: 30, hardSecs: 22, chips: 10,
    endMsg: "Preflop instincts: sharpening.",
    how: [
      "You see a starting hand + your position.",
      "Tap Fold or Play — that's it.",
      "Correct = +10 chips. A quick why shows up.",
      "30 seconds. Build your preflop reflexes.",
    ],
  },
  {
    id: "beat",
    icon: "🥊",
    title: "Beat the Board",
    sub: "Your hand vs the board — ahead or behind?",
    secs: 35, hardSecs: 25, chips: 12,
    endMsg: "Equity reading: leveling up.",
    how: [
      "You see your hand + the full 5-card board.",
      "Tap Ahead or Behind — vs one random opponent.",
      "Correct = +12 chips. Real win % is shown after.",
      "35 seconds. Hard mode deals close matchups.",
    ],
  },
  {
    id: "name",
    icon: "🏷️",
    title: "Name That Hand",
    sub: "5 cards → what's the hand type?",
    secs: 30, hardSecs: 22, chips: 8,
    endMsg: "Hand rankings: instant.",
    how: [
      "You see 5 cards face up.",
      "Pick the correct hand type from 4 options.",
      "Correct = +8 chips. Covers the whole ladder.",
      "30 seconds. Great for beginners. Hard = tighter timer.",
    ],
  },
  {
    id: "move",
    icon: "🧠",
    title: "Bet or Fold",
    sub: "Your hand + pot + bet → what do you do?",
    secs: 40, hardSecs: 28, chips: 14,
    endMsg: "Real decisions: training.",
    how: [
      "You see your hand + the board + pot + opponent's bet.",
      "Tap Fold, Call, or Raise — based on your equity + the price.",
      "Correct = +14 chips. The 'why' shows after each round.",
      "40 seconds. The most realistic drill here.",
    ],
  },
];

function makeWHWRound(hard: boolean): WHWRound {
  let board: Card[] = [];
  let h1: Card[] = [];
  let h2: Card[] = [];
  let cmp = 0;
  do {
    const used = new Set<number>();
    board = drawDeck(5, used);
    h1 = drawDeck(2, used);
    h2 = drawDeck(2, used);
    cmp = compareEval(evaluate([...h1, ...board]), evaluate([...h2, ...board]));
    if (hard && cmp !== 0) {
      const o1 = myOdds(h1, board, 1, 400).winPct;
      if (Math.abs(o1 - 50) > 15) cmp = 0;
    }
  } while (cmp === 0);
  const o1 = myOdds(h1, board, 1, 600).winPct;
  const o2 = myOdds(h2, board, 1, 600).winPct;
  return { board, hands: [h1, h2], win: cmp > 0 ? 0 : 1, odds: [o1, o2] };
}

function makeBeatRound(hard: boolean): BeatRound {
  const used = new Set<number>();
  const board = drawDeck(5, used);
  const hero = drawDeck(2, used);
  const heroEv = evaluate([...hero, ...board]);
  const o = myOdds(hero, board, 1, 700);
  if (hard) {
    let attempts = 0;
    let cur = o.winPct;
    let b = board;
    let h = hero;
    let name = heroEv.name;
    while ((cur <= 40 || cur >= 60) && attempts < 8) {
      const u = new Set<number>();
      b = drawDeck(5, u);
      h = drawDeck(2, u);
      name = evaluate([...h, ...b]).name;
      cur = myOdds(h, b, 1, 500).winPct;
      attempts++;
    }
    const win: 0 | 1 = cur > 50 ? 0 : 1;
    return { board: b, hero: h, win, heroName: name, oddsPct: cur };
  }
  const win: 0 | 1 = o.winPct > 50 ? 0 : 1;
  return { board, hero, win, heroName: heroEv.name, oddsPct: o.winPct };
}

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

function makeNameRound(hard: boolean): NameRound {
  const used = new Set<number>();
  // In hard mode, more often draw 7 and take the best 5 (harder to read at a glance).
  const useSeven = hard ? Math.random() < 0.45 : Math.random() < 0.2;
  let hand: Card[];
  let ev;
  if (useSeven) {
    const seven = drawDeck(7, used);
    hand = seven.slice(0, 5);
    ev = evaluate(hand);
  } else {
    hand = drawDeck(5, used);
    ev = evaluate(hand);
  }
  const correctName = catToName(ev.cat, ev.kick[0]);
  // Build distractors: adjacent hand types are trickier.
  let pool = HAND_NAMES.filter((n) => n !== correctName);
  if (hard) {
    // Prefer distractors near the correct answer on the ladder.
    const correctIdx = HAND_NAMES.indexOf(correctName);
    const near = HAND_NAMES.filter((n, i) => n !== correctName && Math.abs(i - correctIdx) <= 2);
    pool = near.length >= 3 ? near : pool;
  }
  const distractors = [...pool].sort(() => Math.random() - 0.5).slice(0, 3);
  const opts = [...distractors, correctName].sort(() => Math.random() - 0.5);
  const answer = opts.indexOf(correctName);
  return { hand, correctName, opts, answer };
}

function makeMoveRound(hard: boolean): MoveRound {
  const used = new Set<number>();
  const boardLen = hard
    ? [3, 4][Math.floor(Math.random() * 2)]
    : [3, 4, 5][Math.floor(Math.random() * 3)];
  const board = drawDeck(boardLen, used);
  const hero = drawDeck(2, used);
  const heroEv = evaluate([...hero, ...board]);
  const o = myOdds(hero, board, 1, hard ? 700 : 400);
  const winPct = o.winPct;
  const pot = [100, 150, 200, 250, 300][Math.floor(Math.random() * 5)];
  const betSizes = hard ? [0.33, 0.5, 0.75, 1] : [0.33, 0.5, 0.75];
  const oppBet = Math.round(pot * betSizes[Math.floor(Math.random() * betSizes.length)]);
  let answer: 0 | 1 | 2;
  let why: string;
  if (winPct >= 60) {
    answer = 2;
    why = `~${winPct.toFixed(0)}% vs one opponent — you're ahead. Raise for value.`;
  } else if (winPct >= 33) {
    answer = 1;
    why = `~${winPct.toFixed(0)}% — the price is okay. Call, but don't fall in love.`;
  } else {
    answer = 0;
    why = `~${winPct.toFixed(0)}% — behind. Fold and save the chips.`;
  }
  return { hero, board, heroName: heroEv.name, winPct, pot, oppBet, answer, why };
}

export default function ArenaScreen() {
  const insets = useSafeAreaInsets();
  const { highs, recordHigh, payChips, hardMode, toggleHardMode } = useGame();

  const [phase, setPhase] = useState<Phase>("menu");
  const [game, setGame] = useState<GameId>("whw");
  const [score, setScore] = useState<number>(0);
  const [timeLeft, setTimeLeft] = useState<number>(0);
  const [wasBest, setWasBest] = useState<boolean>(false);
  const [locked, setLocked] = useState<boolean>(false);
  const [picked, setPicked] = useState<number | null>(null);
  const [streakCount, setStreakCount] = useState<number>(0);

  const [whwRound, setWhwRound] = useState<WHWRound | null>(null);
  const [beatRound, setBeatRound] = useState<BeatRound | null>(null);
  const [nameRound, setNameRound] = useState<NameRound | null>(null);
  const [moveRound, setMoveRound] = useState<MoveRound | null>(null);
  const [outsIdx, setOutsIdx] = useState<number>(0);
  const [outsOpts, setOutsOpts] = useState<number[]>([]);
  const [swipeIdx, setSwipeIdx] = useState<number>(0);
  const [swipeResult, setSwipeResult] = useState<"right" | "wrong" | null>(null);

  const scoreRef = useRef<number>(0);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const advanceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const stopTimers = useCallback(() => {
    if (timerRef.current) { clearInterval(timerRef.current); timerRef.current = null; }
    if (advanceRef.current) { clearTimeout(advanceRef.current); advanceRef.current = null; }
  }, []);

  useEffect(() => stopTimers, [stopTimers]);

  const endGame = useCallback(
    (g: GameId) => {
      stopTimers();
      const finalScore = scoreRef.current;
      const best = recordHigh(g, finalScore);
      const multiplier = hardMode ? 1.5 : 1;
      const payout = Math.round(finalScore * multiplier);
      payChips(payout, true);
      setWasBest(best && finalScore > 0);
      setPhase("over");
    },
    [stopTimers, recordHigh, payChips, hardMode],
  );

  const prepareOutsRound = useCallback((idx: number) => {
    const sc = OUTS_SCENARIOS[idx % OUTS_SCENARIOS.length];
    const opts = [...new Set([sc.outs, sc.outs + 2, Math.max(1, sc.outs - 2), sc.outs + 4])].sort(() => Math.random() - 0.5);
    setOutsIdx(idx);
    setOutsOpts(opts);
  }, []);

  const startGame = useCallback(
    (g: GameId) => {
      stopTimers();
      setGame(g);
      setScore(0);
      setStreakCount(0);
      scoreRef.current = 0;
      setLocked(false);
      setPicked(null);
      setSwipeResult(null);
      setWasBest(false);
      const meta = GAMES.find((m) => m.id === g);
      const secs = hardMode ? (meta?.hardSecs ?? 25) : (meta?.secs ?? 30);
      setTimeLeft(secs);
      if (g === "whw") setWhwRound(makeWHWRound(hardMode));
      if (g === "beat") setBeatRound(makeBeatRound(hardMode));
      if (g === "name") setNameRound(makeNameRound(hardMode));
      if (g === "move") setMoveRound(makeMoveRound(hardMode));
      if (g === "outs") prepareOutsRound(Math.floor(Math.random() * OUTS_SCENARIOS.length));
      if (g === "swipe") setSwipeIdx(Math.floor(Math.random() * SWIPE_HANDS.length));
      setPhase("playing");
      timerRef.current = setInterval(() => {
        setTimeLeft((t) => {
          if (t <= 1) {
            endGame(g);
            return 0;
          }
          return t - 1;
        });
      }, 1000);
    },
    [stopTimers, prepareOutsRound, endGame, hardMode],
  );

  const addScore = useCallback((n: number) => {
    scoreRef.current += n;
    setScore(scoreRef.current);
    setStreakCount((s) => s + 1);
  }, []);

  const backToMenu = useCallback(() => {
    stopTimers();
    setPhase("menu");
  }, [stopTimers]);

  /* --- round handlers --- */
  const pickWHW = useCallback(
    (i: number) => {
      if (locked || !whwRound) return;
      setLocked(true);
      setPicked(i);
      const good = i === whwRound.win;
      if (good) addScore(10);
      advanceRef.current = setTimeout(() => {
        setWhwRound(makeWHWRound(hardMode));
        setPicked(null);
        setLocked(false);
      }, good ? 420 : 900);
    },
    [locked, whwRound, addScore, hardMode],
  );

  const pickBeat = useCallback(
    (ahead: boolean) => {
      if (locked || !beatRound) return;
      const choice = ahead ? 0 : 1;
      setLocked(true);
      setPicked(choice);
      const good = choice === beatRound.win;
      if (good) addScore(12);
      advanceRef.current = setTimeout(() => {
        setBeatRound(makeBeatRound(hardMode));
        setPicked(null);
        setLocked(false);
      }, good ? 600 : 1100);
    },
    [locked, beatRound, addScore, hardMode],
  );

  const pickName = useCallback(
    (pos: number) => {
      if (locked || !nameRound) return;
      setLocked(true);
      setPicked(pos);
      const good = pos === nameRound.answer;
      if (good) addScore(8);
      advanceRef.current = setTimeout(() => {
        setNameRound(makeNameRound(hardMode));
        setPicked(null);
        setLocked(false);
      }, good ? 500 : 1100);
    },
    [locked, nameRound, addScore, hardMode],
  );

  const pickMove = useCallback(
    (choice: 0 | 1 | 2) => {
      if (locked || !moveRound) return;
      setLocked(true);
      setPicked(choice);
      const good = choice === moveRound.answer;
      if (good) addScore(14);
      advanceRef.current = setTimeout(() => {
        setMoveRound(makeMoveRound(hardMode));
        setPicked(null);
        setLocked(false);
      }, good ? 700 : 1400);
    },
    [locked, moveRound, addScore, hardMode],
  );

  const pickOuts = useCallback(
    (v: number) => {
      if (locked) return;
      const sc = OUTS_SCENARIOS[outsIdx % OUTS_SCENARIOS.length];
      setLocked(true);
      setPicked(v);
      const good = v === sc.outs;
      if (good) addScore(15);
      advanceRef.current = setTimeout(() => {
        prepareOutsRound(outsIdx + 1);
        setPicked(null);
        setLocked(false);
      }, good ? 1100 : 1900);
    },
    [locked, outsIdx, addScore, prepareOutsRound],
  );

  const pickSwipe = useCallback(
    (play: boolean) => {
      if (locked) return;
      const h = SWIPE_HANDS[swipeIdx % SWIPE_HANDS.length];
      setLocked(true);
      const good = play === h.play;
      setSwipeResult(good ? "right" : "wrong");
      if (good) addScore(10);
      advanceRef.current = setTimeout(() => {
        setSwipeIdx((s) => s + 1);
        setSwipeResult(null);
        setLocked(false);
      }, good ? 700 : 1500);
    },
    [locked, swipeIdx, addScore],
  );

  const meta = GAMES.find((m) => m.id === game);

  /* --- menu --- */
  if (phase === "menu") {
    return (
      <View style={[styles.screen, { paddingTop: insets.top }]}>
        <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: 32 }}>
          <TopBar title="Arena" />
          <View style={styles.hardRow}>
            <Text style={styles.hardLabel}>🔥 Hard Mode</Text>
            <Text style={styles.hardSub}>trickier · less time · 1.5× chips</Text>
            <Switch
              value={hardMode}
              onValueChange={toggleHardMode}
              trackColor={{ false: colors.surface2, true: colors.red }}
              thumbColor={hardMode ? colors.gold2 : colors.muted}
              testID="hard-mode-toggle"
            />
          </View>
          <Text style={styles.pageSub}>6 drills. Tap one, stack chips, beat your best.</Text>
          {GAMES.map((g, gi) => (
            <View key={g.id} style={styles.gameCardWrap}>
              <Pressable
                style={styles.gameCard}
                onPress={() => startGame(g.id)}
                testID={`game-${g.id}`}
              >
                <View style={[styles.gameIcon, { backgroundColor: ICON_TINTS[gi % ICON_TINTS.length] }]}>
                  <Text style={styles.gameIconText}>{g.icon}</Text>
                </View>
                <View style={styles.gameInfo}>
                  <Text style={styles.gameTitle}>{g.title}</Text>
                  <Text style={styles.gameSub}>{g.sub}</Text>
                </View>
                <View style={styles.hs}>
                  <Text style={styles.hsV}>{highs[g.id]}</Text>
                  <Text style={styles.hsK}>Best</Text>
                </View>
              </Pressable>
              <Pressable
                style={styles.howBtn}
                onPress={() => { setGame(g.id); setPhase("how"); }}
                hitSlop={8}
                testID={`how-${g.id}`}
              >
                <Text style={styles.howBtnText}>How to play?</Text>
              </Pressable>
            </View>
          ))}
        </ScrollView>
      </View>
    );
  }

  /* --- how to play --- */
  if (phase === "how") {
    const hm = GAMES.find((m) => m.id === game);
    return (
      <View style={[styles.screen, { paddingTop: insets.top }]}>
        <View style={styles.howTop}>
          <Pressable onPress={backToMenu} hitSlop={12}>
            <Text style={styles.exit}>←</Text>
          </Pressable>
          <Text style={styles.howTopTitle}>{hm?.icon}  {hm?.title}</Text>
          <View style={{ width: 24 }} />
        </View>
        <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ padding: 20, paddingBottom: 40 }}>
          <View style={styles.howCard}>
            <Text style={styles.howCardTitle}>How to play</Text>
            {hm?.how.map((line, li) => (
              <View key={li} style={styles.howLineRow}>
                <Text style={styles.howNum}>{li + 1}</Text>
                <Text style={styles.howLine}>{line}</Text>
              </View>
            ))}
            <View style={styles.howMetaRow}>
              <View style={styles.howMetaPill}>
                <Text style={styles.howMetaK}>TIME</Text>
                <Text style={styles.howMetaV}>{hardMode ? hm?.hardSecs : hm?.secs}s</Text>
              </View>
              <View style={styles.howMetaPill}>
                <Text style={styles.howMetaK}>CHIP / HIT</Text>
                <Text style={styles.howMetaV}>+{hm?.chips}</Text>
              </View>
              <View style={[styles.howMetaPill, { borderColor: colors.red }]}>
                <Text style={styles.howMetaK}>MODE</Text>
                <Text style={[styles.howMetaV, { color: colors.red }]}>{hardMode ? "HARD" : "NORMAL"}</Text>
              </View>
            </View>
          </View>
          <PressButton
            label={`Start · ${hm?.title}`}
            onPress={() => startGame(game)}
            style={{ marginTop: 16 }}
            testID={`start-from-how`}
          />
          <PressButton label="Back to Arena" variant="ghost" onPress={backToMenu} />
        </ScrollView>
      </View>
    );
  }

  /* --- over --- */
  if (phase === "over") {
    const multiplier = hardMode ? 1.5 : 1;
    const payout = Math.round(score * multiplier);
    return (
      <View style={[styles.screen, { paddingTop: insets.top }]}>
        <View style={styles.doneWrap}>
          <Text style={styles.doneIcon}>{wasBest ? "👑" : "⚡"}</Text>
          <Text style={styles.doneTitle}>{wasBest ? "New personal best!" : "Time!"}</Text>
          <Text style={styles.doneSub}>{meta?.endMsg}{hardMode ? " · Hard Mode" : ""}</Text>
          <View style={styles.rewardRow}>
            <View style={styles.reward}>
              <Text style={styles.rewardV}>{score}</Text>
              <Text style={styles.rewardK}>score</Text>
            </View>
            <View style={styles.reward}>
              <View style={styles.rewardChipRow}>
                <ChipIcon size={14} />
                <Text style={[styles.rewardV, { color: colors.chipText }]}>+{payout}</Text>
              </View>
              <Text style={styles.rewardK}>chips{hardMode ? " · 1.5×" : ""}</Text>
            </View>
            <View style={styles.reward}>
              <Text style={styles.rewardV}>🔥 {streakCount}</Text>
              <Text style={styles.rewardK}>streak</Text>
            </View>
          </View>
          <PressButton label="Run it back" onPress={() => startGame(game)} style={{ alignSelf: "stretch" }} />
          <PressButton label="Back to Arena" variant="ghost" onPress={backToMenu} />
        </View>
      </View>
    );
  }

  const swipeHand = SWIPE_HANDS[swipeIdx % SWIPE_HANDS.length];
  const outsSc = OUTS_SCENARIOS[outsIdx % OUTS_SCENARIOS.length];

  /* --- playing --- */
  return (
    <View style={[styles.screen, { paddingTop: insets.top }]}>
      <View style={styles.hud}>
        <View style={styles.hudLeft}>
          <ChipIcon size={20} />
          <Text style={styles.hudScore}>{score}</Text>
          {streakCount >= 3 && <Text style={styles.streakPill}>🔥 {streakCount}</Text>}
        </View>
        <View style={styles.hudRight}>
          {hardMode && <Text style={styles.hardPill}>🔥 HARD</Text>}
          <View style={[styles.timer, timeLeft <= 3 && styles.timerLow]}>
            <Text style={[styles.timerText, timeLeft <= 3 && { color: colors.red }]}>{timeLeft}s</Text>
          </View>
          <Pressable onPress={backToMenu} hitSlop={10} testID="exit-drill">
            <Text style={styles.exit}>✕</Text>
          </Pressable>
        </View>
      </View>

      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: 28, paddingHorizontal: 14 }}>
        {game === "whw" && whwRound && (
          <View style={styles.drillCard}>
            <View style={styles.boardStrip}>
              {whwRound.board.map((c, ci) => <PlayingCard key={ci} card={c} size="tiny" />)}
            </View>
            <Text style={styles.stripLabel}>THE BOARD</Text>
            <View style={styles.duelRow}>
              {[0, 1].map((hi) => {
                const isRight = picked != null && hi === whwRound.win;
                const isWrong = picked === hi && hi !== whwRound.win;
                return (
                  <React.Fragment key={hi}>
                    {hi === 1 && <Text style={styles.duelVs}>VS</Text>}
                    <Pressable
                      onPress={() => pickWHW(hi)}
                      style={[styles.handOpt, isRight && styles.handRight, isWrong && styles.handWrong]}
                      testID={`whw-${hi}`}
                    >
                      <Text style={styles.handWho}>Hand {hi === 0 ? "A" : "B"}</Text>
                      <View style={styles.handCards}>
                        {whwRound.hands[hi].map((c, ci) => <PlayingCard key={ci} card={c} size="tiny" />)}
                      </View>
                    </Pressable>
                  </React.Fragment>
                );
              })}
            </View>
            <Text style={styles.hint}>Tap the winner · +10 chips</Text>
            {picked != null && (
              <View style={styles.oddsStrip}>
                <Text style={styles.oddsStripLabel}>WIN % (HEADS-UP, THIS BOARD)</Text>
                <View style={styles.oddsStripRow}>
                  <View style={styles.oddsStripCol}>
                    <Text style={styles.oddsStripHand}>A</Text>
                    <Text style={[styles.oddsStripNum, whwRound.win === 0 && styles.oddsStripWinner]}>
                      {whwRound.odds[0].toFixed(0)}%
                    </Text>
                  </View>
                  <View style={styles.oddsStripCol}>
                    <Text style={styles.oddsStripHand}>B</Text>
                    <Text style={[styles.oddsStripNum, whwRound.win === 1 && styles.oddsStripWinner]}>
                      {whwRound.odds[1].toFixed(0)}%
                    </Text>
                  </View>
                </View>
              </View>
            )}
          </View>
        )}

        {game === "beat" && beatRound && (
          <View style={styles.drillCard}>
            <Text style={styles.beatPrompt}>You have {beatRound.heroName}.</Text>
            <Text style={styles.stripLabel}>YOUR HAND</Text>
            <View style={styles.boardStrip}>
              {beatRound.hero.map((c, ci) => <PlayingCard key={ci} card={c} size="small" />)}
            </View>
            <Text style={[styles.stripLabel, { marginTop: 8 }]}>THE BOARD</Text>
            <View style={styles.boardStrip}>
              {beatRound.board.map((c, ci) => <PlayingCard key={ci} card={c} size="small" />)}
            </View>
            <View style={styles.beatRow}>
              <Pressable
                onPress={() => pickBeat(true)}
                style={[styles.beatBtn, picked != null && beatRound.win === 0 && styles.beatRight, picked === 0 && beatRound.win !== 0 && styles.beatWrong]}
                testID="beat-ahead"
              >
                <Text style={styles.beatEmoji}>💪</Text>
                <Text style={[styles.beatBtnText, picked != null && beatRound.win === 0 && { color: colors.good }, picked === 0 && beatRound.win !== 0 && { color: colors.red }]}>
                  Ahead
                </Text>
              </Pressable>
              <Pressable
                onPress={() => pickBeat(false)}
                style={[styles.beatBtn, picked != null && beatRound.win === 1 && styles.beatRight, picked === 1 && beatRound.win !== 1 && styles.beatWrong]}
                testID="beat-behind"
              >
                <Text style={styles.beatEmoji}>🪨</Text>
                <Text style={[styles.beatBtnText, picked != null && beatRound.win === 1 && { color: colors.good }, picked === 1 && beatRound.win !== 1 && { color: colors.red }]}>
                  Behind
                </Text>
              </Pressable>
            </View>
            {picked != null && (
              <View style={styles.oddsStrip}>
                <Text style={styles.oddsStripLabel}>REAL WIN % VS ONE OPPONENT</Text>
                <Text style={[styles.oddsStripNum, { marginTop: 6 }]}>{beatRound.oddsPct.toFixed(0)}%</Text>
              </View>
            )}
          </View>
        )}

        {game === "name" && nameRound && (
          <View style={styles.drillCard}>
            <Text style={styles.stripLabel}>NAME THAT HAND</Text>
            <View style={styles.boardStrip}>
              {nameRound.hand.map((c, ci) => <PlayingCard key={ci} card={c} size="small" />)}
            </View>
            <Text style={styles.hint}>What do these 5 cards make? · +8 chips</Text>
            {nameRound.opts.map((opt, pos) => {
              const isRight = picked != null && pos === nameRound.answer;
              const isWrong = picked === pos && pos !== nameRound.answer;
              return (
                <Pressable
                  key={pos}
                  onPress={() => pickName(pos)}
                  style={[styles.opt, isRight && styles.optRight, isWrong && styles.optWrong]}
                  testID={`name-${pos}`}
                >
                  <Text style={[styles.optText, isRight && { color: colors.good }, isWrong && { color: colors.red }]}>
                    {opt}
                  </Text>
                </Pressable>
              );
            })}
          </View>
        )}

        {game === "move" && moveRound && (
          <View style={styles.drillCard}>
            <Text style={styles.stripLabel}>YOUR HAND · {moveRound.heroName}</Text>
            <View style={styles.boardStrip}>
              {moveRound.hero.map((c, ci) => <PlayingCard key={ci} card={c} size="small" />)}
            </View>
            {moveRound.board.length > 0 && (
              <>
                <Text style={[styles.stripLabel, { marginTop: 8 }]}>THE BOARD</Text>
                <View style={styles.boardStrip}>
                  {moveRound.board.map((c, ci) => <PlayingCard key={ci} card={c} size="small" />)}
                </View>
              </>
            )}
            <View style={styles.movePotRow}>
              <View style={styles.movePotPill}>
                <Text style={styles.movePotK}>POT</Text>
                <Text style={styles.movePotV}>{moveRound.pot}</Text>
              </View>
              <View style={[styles.movePotPill, { borderColor: "rgba(228,87,61,0.4)" }]}>
                <Text style={styles.movePotK}>HE BET</Text>
                <Text style={[styles.movePotV, { color: colors.red }]}>{moveRound.oppBet}</Text>
              </View>
              <View style={[styles.movePotPill, { borderColor: "rgba(233,196,100,0.4)" }]}>
                <Text style={styles.movePotK}>YOUR %</Text>
                <Text style={[styles.movePotV, { color: colors.gold2 }]}>{moveRound.winPct.toFixed(0)}</Text>
              </View>
            </View>
            <View style={styles.moveRow}>
              {(["Fold", "Call", "Raise"] as const).map((label, idx) => {
                const choice = idx as 0 | 1 | 2;
                const isRight = picked != null && choice === moveRound.answer;
                const isWrong = picked === choice && choice !== moveRound.answer;
                const emoji = ["🚪", "🤝", "🚀"][idx] ?? "";
                return (
                  <Pressable
                    key={idx}
                    onPress={() => pickMove(choice)}
                    style={[styles.moveBtn, isRight && styles.moveRight, isWrong && styles.moveWrong]}
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
            {picked != null && (
              <View style={styles.oddsStrip}>
                <Text style={styles.oddsStripLabel}>THE READ</Text>
                <Text style={styles.oddsStripNote}>{moveRound.why}</Text>
              </View>
            )}
          </View>
        )}

        {game === "outs" && (
          <View style={styles.drillCard}>
            <Text style={styles.stripLabel}>YOUR HAND</Text>
            <View style={styles.boardStrip}>
              {outsSc.hand.map((c, ci) => <PlayingCard key={ci} card={c} size="tiny" />)}
            </View>
            <Text style={[styles.stripLabel, { marginTop: 8 }]}>THE FLOP</Text>
            <View style={styles.boardStrip}>
              {outsSc.board.map((c, ci) => <PlayingCard key={ci} card={c} size="tiny" />)}
            </View>
            <Text style={styles.outsPrompt}>How many outs improve you?</Text>
            <View style={styles.outsRow}>
              {outsOpts.map((o) => {
                const isRight = picked != null && o === outsSc.outs;
                const isWrong = picked === o && o !== outsSc.outs;
                return (
                  <Pressable
                    key={o}
                    onPress={() => pickOuts(o)}
                    style={[styles.outsBtn, isRight && styles.outsRight, isWrong && styles.outsWrong]}
                    testID={`arena-outs-${o}`}
                  >
                    <Text style={[styles.outsBtnText, isRight && { color: colors.good }, isWrong && { color: colors.red }]}>
                      {o}
                    </Text>
                  </Pressable>
                );
              })}
            </View>
            {picked != null && (
              <View style={styles.oddsStrip}>
                <Text style={styles.oddsStripLabel}>HIT % FOR {outsSc.outs} OUTS</Text>
                <View style={styles.oddsStripRow}>
                  <View style={styles.oddsStripCol}>
                    <Text style={styles.oddsStripHand}>Flop→River</Text>
                    <Text style={styles.oddsStripNum}>{Math.min(96, outsSc.outs * 4 - (outsSc.outs > 8 ? outsSc.outs - 8 : 0))}%</Text>
                  </View>
                  <View style={styles.oddsStripCol}>
                    <Text style={styles.oddsStripHand}>Turn→River</Text>
                    <Text style={styles.oddsStripNum}>{Math.min(96, outsSc.outs * 2)}%</Text>
                  </View>
                </View>
                <Text style={styles.oddsStripNote}>{outsSc.why}</Text>
              </View>
            )}
          </View>
        )}

        {game === "swipe" && (
          <View style={styles.drillCard}>
            <View
              style={[
                styles.swipeCard,
                swipeResult === "right" && { borderColor: colors.good },
                swipeResult === "wrong" && { borderColor: colors.red },
              ]}
            >
              <Text style={styles.swipePos}>{swipeHand.pos}</Text>
              <View style={styles.swipeCards}>
                {swipeHand.c.map((c, ci) => <PlayingCard key={ci} card={c} size="big" />)}
              </View>
              {swipeResult != null && <Text style={styles.swipeWhy}>{swipeHand.why}</Text>}
            </View>
            <View style={styles.swipeBtns}>
              <PressButton label="Fold" variant="fold" onPress={() => pickSwipe(false)} style={{ flex: 1 }} testID="swipe-fold" />
              <PressButton label="Play" onPress={() => pickSwipe(true)} style={{ flex: 1 }} testID="swipe-play" />
            </View>
          </View>
        )}
      </ScrollView>
    </View>
  );
}

const ICON_TINTS = [
  "rgba(198,238,199,0.08)",
  "rgba(233,196,100,0.08)",
  "rgba(90,176,242,0.08)",
  "rgba(228,87,61,0.08)",
  "rgba(180,150,255,0.08)",
  "rgba(255,156,65,0.08)",
];

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.bg },
  hardRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    marginHorizontal: 16,
    marginTop: 4,
    marginBottom: 2,
    padding: 12,
    paddingHorizontal: 14,
    borderRadius: 14,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.line,
  },
  hardLabel: { fontFamily: "Outfit_900Black", fontSize: 13.5, color: colors.cream },
  hardSub: { flex: 1, fontSize: 11, color: colors.muted, fontFamily: "Outfit_600SemiBold" },
  hardPill: {
    fontSize: 10,
    fontFamily: "Outfit_900Black",
    color: colors.gold2,
    letterSpacing: 1,
    backgroundColor: "rgba(228,87,61,0.15)",
    borderWidth: 1,
    borderColor: "rgba(228,87,61,0.4)",
    borderRadius: 999,
    paddingVertical: 4,
    paddingHorizontal: 8,
  },
  pageSub: {
    paddingHorizontal: 18,
    paddingBottom: 6,
    fontSize: 13,
    color: colors.muted,
    fontFamily: "Outfit_600SemiBold",
  },
  /* compact menu cards */
  gameCardWrap: {
    marginHorizontal: 16,
    marginVertical: 5,
    borderRadius: 16,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.line,
    overflow: "hidden",
  },
  gameCard: {
    flexDirection: "row",
    gap: 12,
    alignItems: "center",
    padding: 12,
  },
  gameIcon: {
    width: 44,
    height: 44,
    borderRadius: 13,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
    borderColor: colors.line,
  },
  gameIconText: { fontSize: 20 },
  gameInfo: { flex: 1 },
  gameTitle: { fontSize: 14.5, fontFamily: "Outfit_800ExtraBold", letterSpacing: -0.2, color: colors.cream },
  gameSub: { fontSize: 11.5, color: colors.muted, fontFamily: "Outfit_600SemiBold", lineHeight: 15, marginTop: 2 },
  hs: { alignItems: "flex-end", paddingRight: 2 },
  hsV: { fontFamily: "Outfit_900Black", color: colors.gold2, fontSize: 15 },
  hsK: { fontSize: 9, color: colors.dim, fontFamily: "Outfit_800ExtraBold", letterSpacing: 1, textTransform: "uppercase" },
  howBtn: {
    paddingVertical: 8,
    paddingHorizontal: 12,
    backgroundColor: colors.surface2,
    borderTopWidth: 1,
    borderTopColor: colors.line,
  },
  howBtnText: { fontSize: 11.5, fontFamily: "Outfit_700Bold", color: colors.mint, letterSpacing: 0.3 },

  /* how screen */
  howTop: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 18,
    paddingTop: 14,
    paddingBottom: 6,
  },
  howTopTitle: { fontSize: 17, fontFamily: "Outfit_900Black", color: colors.cream },
  howCard: {
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.line,
    borderRadius: 18,
    padding: 18,
  },
  howCardTitle: { fontSize: 16, fontFamily: "Outfit_900Black", color: colors.mint, marginBottom: 14 },
  howLineRow: { flexDirection: "row", gap: 10, marginBottom: 12 },
  howNum: {
    width: 22, height: 22, borderRadius: 11,
    backgroundColor: colors.mintInk,
    color: colors.mint,
    fontSize: 11.5,
    fontFamily: "Outfit_900Black",
    textAlign: "center",
    textAlignVertical: "center",
    overflow: "hidden",
    lineHeight: 22,
  },
  howLine: { flex: 1, fontSize: 14, fontFamily: "Outfit_600SemiBold", color: colors.cream, lineHeight: 19 },
  howMetaRow: { flexDirection: "row", gap: 8, marginTop: 16 },
  howMetaPill: {
    flex: 1,
    alignItems: "center",
    backgroundColor: colors.surface2,
    borderWidth: 1,
    borderColor: colors.line,
    borderRadius: 12,
    paddingVertical: 8,
  },
  howMetaK: { fontSize: 9, fontFamily: "Outfit_800ExtraBold", letterSpacing: 1.2, color: colors.dim, textTransform: "uppercase" },
  howMetaV: { fontSize: 15, fontFamily: "Outfit_900Black", color: colors.cream, marginTop: 3 },

  /* hud */
  hud: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingHorizontal: 16,
    paddingTop: 12,
    paddingBottom: 4,
  },
  hudLeft: { flexDirection: "row", alignItems: "center", gap: 7 },
  hudScore: { fontSize: 22, fontFamily: "Outfit_900Black", color: colors.gold2 },
  streakPill: {
    fontSize: 10.5,
    fontFamily: "Outfit_900Black",
    color: colors.gold2,
    backgroundColor: "rgba(233,196,100,0.14)",
    borderWidth: 1,
    borderColor: "rgba(233,196,100,0.4)",
    borderRadius: 999,
    paddingVertical: 3,
    paddingHorizontal: 7,
  },
  hudRight: { flexDirection: "row", alignItems: "center", gap: 12 },
  timer: {
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.line,
    borderRadius: 999,
    paddingVertical: 5,
    paddingHorizontal: 14,
    minWidth: 66,
    alignItems: "center",
  },
  timerLow: { borderColor: "rgba(228,87,61,0.4)" },
  timerText: { fontSize: 17, fontFamily: "Outfit_900Black", color: colors.mint },
  exit: { color: colors.dim, fontSize: 20, fontFamily: "Outfit_700Bold" },

  /* compact drill card wraps the whole round */
  drillCard: {
    marginHorizontal: 4,
    marginVertical: 8,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.line,
    borderRadius: 18,
    padding: 14,
  },
  beatPrompt: {
    textAlign: "center",
    fontSize: 16,
    fontFamily: "Outfit_900Black",
    color: colors.cream,
    marginBottom: 4,
  },
  boardStrip: { flexDirection: "row", gap: 6, justifyContent: "center", marginTop: 8 },
  stripLabel: {
    textAlign: "center",
    fontSize: 11,
    color: colors.dim,
    fontFamily: "Outfit_700Bold",
    marginTop: 4,
    letterSpacing: 1,
  },
  beatRow: { flexDirection: "row", gap: 12, marginTop: 14 },
  beatBtn: {
    flex: 1,
    alignItems: "center",
    backgroundColor: colors.surface2,
    borderWidth: 2,
    borderColor: colors.line,
    borderRadius: 18,
    paddingVertical: 16,
    gap: 6,
  },
  beatRight: { borderColor: colors.good, backgroundColor: "rgba(67,209,124,0.12)" },
  beatWrong: { borderColor: colors.red, backgroundColor: "rgba(228,87,61,0.12)" },
  beatEmoji: { fontSize: 26 },
  beatBtnText: { fontFamily: "Outfit_900Black", fontSize: 15, color: colors.cream },
  duelRow: { flexDirection: "row", gap: 10, marginTop: 10, alignItems: "center" },
  handOpt: {
    flex: 1,
    backgroundColor: colors.surface2,
    borderWidth: 2,
    borderColor: colors.line,
    borderRadius: 16,
    paddingVertical: 12,
    paddingHorizontal: 6,
    alignItems: "center",
    gap: 8,
  },
  handRight: { borderColor: colors.good, backgroundColor: "rgba(67,209,124,0.1)" },
  handWrong: { borderColor: colors.red, backgroundColor: "rgba(228,87,61,0.1)" },
  handWho: {
    fontSize: 11,
    fontFamily: "Outfit_800ExtraBold",
    color: colors.muted,
    letterSpacing: 1,
    textTransform: "uppercase",
  },
  handCards: { flexDirection: "row", gap: 5 },
  duelVs: { fontFamily: "Outfit_900Black", color: colors.dim, fontSize: 13 },
  hint: {
    textAlign: "center",
    fontSize: 12,
    color: colors.muted,
    fontFamily: "Outfit_700Bold",
    marginTop: 12,
  },
  outsPrompt: {
    textAlign: "center",
    fontFamily: "Outfit_800ExtraBold",
    fontSize: 14.5,
    marginTop: 12,
    marginHorizontal: 16,
    color: colors.cream,
  },
  outsRow: { flexDirection: "row", gap: 8, justifyContent: "center", flexWrap: "wrap", marginTop: 12, marginHorizontal: 8 },
  outsBtn: {
    width: 48,
    height: 48,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: colors.line,
    backgroundColor: colors.surface2,
    alignItems: "center",
    justifyContent: "center",
  },
  outsRight: { backgroundColor: "rgba(67,209,124,0.15)", borderColor: colors.good },
  outsWrong: { backgroundColor: "rgba(228,87,61,0.15)", borderColor: colors.red },
  outsBtnText: { color: colors.cream, fontFamily: "Outfit_900Black", fontSize: 17 },
  opt: {
    padding: 14,
    marginBottom: 9,
    marginTop: 4,
    borderRadius: 14,
    backgroundColor: colors.surface2,
    borderWidth: 2,
    borderColor: colors.line,
  },
  optRight: { borderColor: colors.good, backgroundColor: "rgba(67,209,124,0.12)" },
  optWrong: { borderColor: colors.red, backgroundColor: "rgba(228,87,61,0.12)" },
  optText: { color: colors.cream, fontSize: 14.5, fontFamily: "Outfit_600SemiBold" },

  /* move drill */
  movePotRow: { flexDirection: "row", gap: 8, justifyContent: "center", marginVertical: 10 },
  movePotPill: {
    alignItems: "center",
    backgroundColor: colors.surface2,
    borderWidth: 1,
    borderColor: colors.line,
    borderRadius: 12,
    paddingVertical: 7,
    paddingHorizontal: 12,
    minWidth: 78,
  },
  movePotK: { fontSize: 9, fontFamily: "Outfit_800ExtraBold", letterSpacing: 1.2, color: colors.dim, textTransform: "uppercase" },
  movePotV: { fontSize: 16, fontFamily: "Outfit_900Black", color: colors.cream, marginTop: 2 },
  moveRow: { flexDirection: "row", gap: 10, marginTop: 4 },
  moveBtn: {
    flex: 1,
    alignItems: "center",
    backgroundColor: colors.surface2,
    borderWidth: 2,
    borderColor: colors.line,
    borderRadius: 16,
    paddingVertical: 14,
    gap: 5,
  },
  moveRight: { borderColor: colors.good, backgroundColor: "rgba(67,209,124,0.12)" },
  moveWrong: { borderColor: colors.red, backgroundColor: "rgba(228,87,61,0.12)" },
  moveEmoji: { fontSize: 20 },
  moveBtnText: { fontFamily: "Outfit_900Black", fontSize: 14, color: colors.cream, letterSpacing: 0.3 },

  oddsStrip: {
    marginTop: 12,
    padding: 12,
    borderRadius: 14,
    backgroundColor: colors.surface2,
    borderWidth: 1,
    borderColor: colors.lineStrong,
    alignItems: "center",
  },
  oddsStripLabel: {
    fontSize: 10,
    fontFamily: "Outfit_900Black",
    color: colors.dim,
    letterSpacing: 1.3,
  },
  oddsStripRow: { flexDirection: "row", gap: 24, marginVertical: 8 },
  oddsStripCol: { alignItems: "center" },
  oddsStripHand: { fontSize: 10.5, fontFamily: "Outfit_700Bold", color: colors.muted, letterSpacing: 0.5 },
  oddsStripNum: { fontSize: 19, fontFamily: "Outfit_900Black", color: colors.mint2, marginTop: 2 },
  oddsStripWinner: { color: colors.gold2 },
  oddsStripNote: {
    fontSize: 11,
    color: colors.muted,
    fontFamily: "Outfit_600SemiBold",
    textAlign: "center",
    marginTop: 6,
    marginHorizontal: 6,
    lineHeight: 16,
  },

  swipeCard: {
    marginTop: 6,
    alignSelf: "center",
    width: 230,
    backgroundColor: colors.surface2,
    borderWidth: 1,
    borderColor: colors.lineStrong,
    borderRadius: 22,
    paddingVertical: 20,
    paddingHorizontal: 14,
    alignItems: "center",
  },
  swipePos: {
    fontSize: 11,
    fontFamily: "Outfit_900Black",
    letterSpacing: 1.3,
    color: colors.gold,
    textTransform: "uppercase",
    marginBottom: 10,
  },
  swipeCards: { flexDirection: "row", gap: 8, marginBottom: 4 },
  swipeWhy: {
    fontSize: 12,
    color: colors.muted,
    fontFamily: "Outfit_600SemiBold",
    marginTop: 8,
    textAlign: "center",
    lineHeight: 16,
  },
  swipeBtns: { flexDirection: "row", gap: 10, marginTop: 14 },

  doneWrap: { flex: 1, alignItems: "center", justifyContent: "center", padding: 28 },
  doneIcon: { fontSize: 64 },
  doneTitle: {
    fontSize: 23,
    fontFamily: "Outfit_900Black",
    marginTop: 12,
    marginBottom: 4,
    letterSpacing: -0.5,
    color: colors.cream,
  },
  doneSub: { color: colors.muted, fontSize: 14, marginBottom: 24, fontFamily: "Outfit_500Medium", textAlign: "center" },
  rewardRow: { flexDirection: "row", gap: 10, justifyContent: "center", marginBottom: 24 },
  reward: {
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.line,
    borderRadius: 16,
    paddingVertical: 12,
    paddingHorizontal: 16,
    minWidth: 92,
    alignItems: "center",
  },
  rewardChipRow: { flexDirection: "row", alignItems: "center", gap: 6 },
  rewardV: { fontSize: 21, fontFamily: "Outfit_900Black", color: colors.cream },
  rewardK: {
    fontSize: 10,
    fontFamily: "Outfit_700Bold",
    letterSpacing: 1,
    color: colors.muted,
    textTransform: "uppercase",
    marginTop: 2,
  },
});
