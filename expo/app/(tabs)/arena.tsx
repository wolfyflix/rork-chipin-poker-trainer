import React, { useCallback, useEffect, useRef, useState } from "react";
import { Pressable, ScrollView, StyleSheet, Switch, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import ChipIcon from "@/components/ChipIcon";
import PlayingCard from "@/components/PlayingCard";
import PressButton from "@/components/PressButton";
import TopBar from "@/components/TopBar";
import colors from "@/constants/colors";
import { OUTS_SCENARIOS, SWIPE_HANDS } from "@/lib/curriculum";
import { Card, compareEval, drawDeck, evaluate, myOdds } from "@/lib/poker";
import { ArenaHighs, useGame } from "@/providers/GameProvider";

type GameId = keyof ArenaHighs;
type Phase = "menu" | "playing" | "over";

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

interface GameMeta {
  id: GameId;
  icon: string;
  title: string;
  sub: string;
  secs: number;
  hardSecs: number;
  endMsg: string;
}

const GAMES: GameMeta[] = [
  { id: "whw", icon: "⚡", title: "Which Hand Wins?", sub: "Two hands, one board, 30s. +10 chips per read.", secs: 30, hardSecs: 20, endMsg: "Tap-the-winner reflexes: building." },
  { id: "outs", icon: "🎯", title: "Count the Outs", sub: "Exact number or nothing. +15 chips a pop.", secs: 45, hardSecs: 30, endMsg: "Outs math: the skill that pays for itself." },
  { id: "swipe", icon: "🃏", title: "Preflop Swipe", sub: "Play it or fold it — Tinder for starting hands.", secs: 30, hardSecs: 22, endMsg: "Preflop instincts: sharpening." },
  { id: "beat", icon: "🥊", title: "Beat the Board", sub: "Your hand + the board — ahead or behind? +12 chips.", secs: 35, hardSecs: 25, endMsg: "Equity reading: leveling up." },
];

function makeWHWRound(hard: boolean): WHWRound {
  let board: Card[] = [];
  let h1: Card[] = [];
  let h2: Card[] = [];
  let cmp = 0;
  // In hard mode, re-roll until the matchup is close (one hand only slightly ahead)
  do {
    const used = new Set<number>();
    board = drawDeck(5, used);
    h1 = drawDeck(2, used);
    h2 = drawDeck(2, used);
    cmp = compareEval(evaluate([...h1, ...board]), evaluate([...h2, ...board]));
    if (hard && cmp !== 0) {
      const o1 = myOdds(h1, board, 1, 400).winPct;
      // close matchup — both hands within 15% of 50/50
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
  // In hard mode, re-roll until it's a close call (40-60%) — genuinely tricky
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

  const [whwRound, setWhwRound] = useState<WHWRound | null>(null);
  const [beatRound, setBeatRound] = useState<BeatRound | null>(null);
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

  /* --- render --- */
  if (phase === "menu") {
    return (
      <View style={[styles.screen, { paddingTop: insets.top }]}>
        <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: 32 }}>
          <TopBar title="Arena" />
          <View style={styles.hardRow}>
            <Text style={styles.hardLabel}>🔥 Hard Mode</Text>
            <Text style={styles.hardSub}>trickier hands · less time · 1.5× chips</Text>
            <Switch
              value={hardMode}
              onValueChange={toggleHardMode}
              trackColor={{ false: colors.surface2, true: colors.red }}
              thumbColor={hardMode ? colors.gold2 : colors.muted}
              testID="hard-mode-toggle"
            />
          </View>
          <Text style={styles.pageSub}>Rapid-fire drills that pay chips. Build instincts, stack currency.</Text>
          {GAMES.map((g, gi) => (
            <Pressable key={g.id} style={styles.gameCard} onPress={() => startGame(g.id)} testID={`game-${g.id}`}>
              <View style={[styles.gameIcon, { backgroundColor: ["rgba(198,238,199,0.08)", "rgba(233,196,100,0.08)", "rgba(90,176,242,0.08)", "rgba(228,87,61,0.08)"][gi] }]}>
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
          ))}
        </ScrollView>
      </View>
    );
  }

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
          </View>
          <PressButton label="Run it back" onPress={() => startGame(game)} style={{ alignSelf: "stretch" }} />
          <PressButton label="Back to Arena" variant="ghost" onPress={backToMenu} />
        </View>
      </View>
    );
  }

  const swipeHand = SWIPE_HANDS[swipeIdx % SWIPE_HANDS.length];
  const outsSc = OUTS_SCENARIOS[outsIdx % OUTS_SCENARIOS.length];

  return (
    <View style={[styles.screen, { paddingTop: insets.top }]}>
      <View style={styles.hud}>
        <View style={styles.hudScoreRow}>
          <ChipIcon size={22} />
          <Text style={styles.hudScore}>{score}</Text>
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

      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: 32 }}>
        {game === "whw" && whwRound && (
          <>
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
            <Text style={styles.hint}>Which hand wins? Tap it. +10 chips.</Text>
            {picked != null && (
              <View style={styles.oddsStrip}>
                <Text style={styles.oddsStripLabel}>LIVE WIN % (HEADS-UP, THIS BOARD)</Text>
                <View style={styles.oddsStripRow}>
                  <View style={styles.oddsStripCol}>
                    <Text style={styles.oddsStripHand}>Hand A</Text>
                    <Text style={[styles.oddsStripNum, whwRound.win === 0 && styles.oddsStripWinner]}>
                      {whwRound.odds[0].toFixed(0)}%
                    </Text>
                  </View>
                  <View style={styles.oddsStripCol}>
                    <Text style={styles.oddsStripHand}>Hand B</Text>
                    <Text style={[styles.oddsStripNum, whwRound.win === 1 && styles.oddsStripWinner]}>
                      {whwRound.odds[1].toFixed(0)}%
                    </Text>
                  </View>
                </View>
                <Text style={styles.oddsStripNote}>Reminder: in a real hand the board isn't fully out yet — these are showdown-time odds.</Text>
              </View>
            )}
          </>
        )}

        {game === "beat" && beatRound && (
          <>
            <Text style={styles.beatPrompt}>You have {beatRound.heroName}.</Text>
            <Text style={styles.stripLabel}>YOUR HAND</Text>
            <View style={styles.boardStrip}>
              {beatRound.hero.map((c, ci) => <PlayingCard key={ci} card={c} size="small" />)}
            </View>
            <Text style={[styles.stripLabel, { marginTop: 10 }]}>THE BOARD</Text>
            <View style={styles.boardStrip}>
              {beatRound.board.map((c, ci) => <PlayingCard key={ci} card={c} size="small" />)}
            </View>
            <Text style={styles.hint}>Ahead or behind one random opponent? +12 chips.</Text>
            <View style={styles.beatRow}>
              <Pressable
                onPress={() => pickBeat(true)}
                style={[
                  styles.beatBtn,
                  picked != null && beatRound.win === 0 && styles.beatRight,
                  picked === 0 && beatRound.win !== 0 && styles.beatWrong,
                ]}
                testID="beat-ahead"
              >
                <Text style={styles.beatEmoji}>💪</Text>
                <Text style={[styles.beatBtnText, picked != null && beatRound.win === 0 && { color: colors.good }, picked === 0 && beatRound.win !== 0 && { color: colors.red }]}>
                  Ahead
                </Text>
              </Pressable>
              <Pressable
                onPress={() => pickBeat(false)}
                style={[
                  styles.beatBtn,
                  picked != null && beatRound.win === 1 && styles.beatRight,
                  picked === 1 && beatRound.win !== 1 && styles.beatWrong,
                ]}
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
                <Text style={[styles.oddsStripNum, { marginTop: 8 }]}>
                  {beatRound.oddsPct.toFixed(0)}%
                </Text>
                <Text style={styles.oddsStripNote}>
                  {beatRound.win === 0
                    ? "You're actually ahead here — bet for value."
                    : "You're actually behind here — pot odds decide."}
                </Text>
              </View>
            )}
          </>
        )}

        {game === "outs" && (
          <>
            <Text style={styles.stripLabel}>YOUR HAND</Text>
            <View style={styles.boardStrip}>
              {outsSc.hand.map((c, ci) => <PlayingCard key={ci} card={c} size="tiny" />)}
            </View>
            <Text style={[styles.stripLabel, { marginTop: 8 }]}>THE FLOP</Text>
            <View style={styles.boardStrip}>
              {outsSc.board.map((c, ci) => <PlayingCard key={ci} card={c} size="tiny" />)}
            </View>
            <Text style={styles.outsPrompt}>How many outs improve you? +15 chips.</Text>
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
                <Text style={styles.oddsStripLabel}>HIT CHANCES FOR {outsSc.outs} OUTS</Text>
                <View style={styles.oddsStripRow}>
                  <View style={styles.oddsStripCol}>
                    <Text style={styles.oddsStripHand}>Flop → River</Text>
                    <Text style={styles.oddsStripNum}>
                      {Math.min(96, outsSc.outs * 4 - (outsSc.outs > 8 ? outsSc.outs - 8 : 0))}%
                    </Text>
                  </View>
                  <View style={styles.oddsStripCol}>
                    <Text style={styles.oddsStripHand}>Turn → River</Text>
                    <Text style={styles.oddsStripNum}>{Math.min(96, outsSc.outs * 2)}%</Text>
                  </View>
                </View>
                <Text style={styles.why}>{outsSc.why}</Text>
              </View>
            )}
            {picked == null && <Text style={styles.why}>{outsSc.why}</Text>}
          </>
        )}

        {game === "swipe" && (
          <>
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
              <PressButton label="👈 Fold" variant="fold" onPress={() => pickSwipe(false)} style={{ flex: 1 }} testID="swipe-fold" />
              <PressButton label="Play 👉" onPress={() => pickSwipe(true)} style={{ flex: 1 }} testID="swipe-play" />
            </View>
          </>
        )}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.bg },
  hardRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    marginHorizontal: 16,
    marginTop: 4,
    marginBottom: 4,
    padding: 12,
    paddingHorizontal: 16,
    borderRadius: 16,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.line,
  },
  hardLabel: { fontFamily: "Outfit_900Black", fontSize: 14, color: colors.cream },
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
    paddingHorizontal: 20,
    paddingBottom: 8,
    fontSize: 13.5,
    color: colors.muted,
    fontFamily: "Outfit_600SemiBold",
  },
  gameCard: {
    marginHorizontal: 16,
    marginVertical: 6,
    padding: 18,
    borderRadius: 24,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.line,
    flexDirection: "row",
    gap: 14,
    alignItems: "center",
  },
  gameIcon: {
    width: 56,
    height: 56,
    borderRadius: 18,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
    borderColor: colors.line,
  },
  gameIconText: { fontSize: 26 },
  gameInfo: { flex: 1 },
  gameTitle: { fontSize: 16.5, fontFamily: "Outfit_800ExtraBold", letterSpacing: -0.2, color: colors.cream },
  gameSub: { fontSize: 12.5, color: colors.muted, fontFamily: "Outfit_600SemiBold", lineHeight: 17, marginTop: 2 },
  hs: { alignItems: "flex-end" },
  hsV: { fontFamily: "Outfit_900Black", color: colors.gold2, fontSize: 17 },
  hsK: { fontSize: 9.5, color: colors.dim, fontFamily: "Outfit_800ExtraBold", letterSpacing: 1, textTransform: "uppercase" },
  hud: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingHorizontal: 20,
    paddingTop: 14,
    paddingBottom: 4,
  },
  hudScoreRow: { flexDirection: "row", alignItems: "center", gap: 8 },
  hudScore: { fontSize: 26, fontFamily: "Outfit_900Black", color: colors.gold2 },
  hudRight: { flexDirection: "row", alignItems: "center", gap: 14 },
  timer: {
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.line,
    borderRadius: 999,
    paddingVertical: 6,
    paddingHorizontal: 16,
    minWidth: 74,
    alignItems: "center",
  },
  timerLow: { borderColor: "rgba(228,87,61,0.4)" },
  timerText: { fontSize: 19, fontFamily: "Outfit_900Black", color: colors.mint },
  exit: { color: colors.dim, fontSize: 20, fontFamily: "Outfit_700Bold" },
  beatPrompt: {
    textAlign: "center",
    fontSize: 17,
    fontFamily: "Outfit_900Black",
    color: colors.cream,
    marginTop: 12,
    marginBottom: 4,
  },
  boardStrip: { flexDirection: "row", gap: 7, justifyContent: "center", marginTop: 12 },
  stripLabel: {
    textAlign: "center",
    fontSize: 12,
    color: colors.dim,
    fontFamily: "Outfit_700Bold",
    marginTop: 6,
    letterSpacing: 1,
  },
  beatRow: { flexDirection: "row", gap: 14, marginHorizontal: 24, marginTop: 18 },
  beatBtn: {
    flex: 1,
    alignItems: "center",
    backgroundColor: colors.surface,
    borderWidth: 2,
    borderColor: colors.line,
    borderRadius: 22,
    paddingVertical: 22,
    gap: 8,
  },
  beatRight: { borderColor: colors.good, backgroundColor: "rgba(67,209,124,0.12)" },
  beatWrong: { borderColor: colors.red, backgroundColor: "rgba(228,87,61,0.12)" },
  beatEmoji: { fontSize: 30 },
  beatBtnText: { fontFamily: "Outfit_900Black", fontSize: 17, color: colors.cream },
  duelRow: { flexDirection: "row", gap: 10, marginHorizontal: 16, marginTop: 12, alignItems: "center" },
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
  hint: {
    textAlign: "center",
    fontSize: 13,
    color: colors.muted,
    fontFamily: "Outfit_700Bold",
    marginTop: 14,
  },
  outsPrompt: {
    textAlign: "center",
    fontFamily: "Outfit_800ExtraBold",
    fontSize: 16,
    marginTop: 14,
    marginHorizontal: 20,
    color: colors.cream,
  },
  outsRow: { flexDirection: "row", gap: 8, justifyContent: "center", flexWrap: "wrap", marginTop: 14, marginHorizontal: 16 },
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
  why: {
    textAlign: "center",
    fontSize: 12.5,
    color: colors.muted,
    fontFamily: "Outfit_600SemiBold",
    marginTop: 10,
    marginHorizontal: 24,
    lineHeight: 18,
  },
  oddsStrip: {
    marginHorizontal: 16,
    marginTop: 14,
    padding: 14,
    borderRadius: 16,
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
  oddsStripRow: { flexDirection: "row", gap: 28, marginVertical: 10 },
  oddsStripCol: { alignItems: "center" },
  oddsStripHand: { fontSize: 11, fontFamily: "Outfit_700Bold", color: colors.muted, letterSpacing: 0.5 },
  oddsStripNum: { fontSize: 22, fontFamily: "Outfit_900Black", color: colors.mint2, marginTop: 2 },
  oddsStripWinner: { color: colors.gold2 },
  oddsStripNote: {
    fontSize: 10.5,
    color: colors.dim,
    fontFamily: "Outfit_500Medium",
    textAlign: "center",
    marginTop: 6,
    marginHorizontal: 8,
    lineHeight: 15,
  },
  swipeCard: {
    marginTop: 14,
    alignSelf: "center",
    width: 250,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.lineStrong,
    borderRadius: 26,
    paddingVertical: 24,
    paddingHorizontal: 18,
    alignItems: "center",
  },
  swipePos: {
    fontSize: 11.5,
    fontFamily: "Outfit_900Black",
    letterSpacing: 1.5,
    color: colors.gold,
    textTransform: "uppercase",
    marginBottom: 12,
  },
  swipeCards: { flexDirection: "row", gap: 10, marginBottom: 6 },
  swipeWhy: {
    fontSize: 12.5,
    color: colors.muted,
    fontFamily: "Outfit_600SemiBold",
    marginTop: 8,
    textAlign: "center",
    lineHeight: 17,
  },
  swipeBtns: { flexDirection: "row", gap: 12, marginHorizontal: 16, marginTop: 16 },
  doneWrap: { flex: 1, alignItems: "center", justifyContent: "center", padding: 28 },
  doneIcon: { fontSize: 72 },
  doneTitle: {
    fontSize: 25,
    fontFamily: "Outfit_900Black",
    marginTop: 14,
    marginBottom: 6,
    letterSpacing: -0.5,
    color: colors.cream,
  },
  doneSub: { color: colors.muted, fontSize: 15, marginBottom: 26, fontFamily: "Outfit_500Medium", textAlign: "center" },
  rewardRow: { flexDirection: "row", gap: 12, justifyContent: "center", marginBottom: 28 },
  reward: {
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.line,
    borderRadius: 18,
    paddingVertical: 14,
    paddingHorizontal: 20,
    minWidth: 104,
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
