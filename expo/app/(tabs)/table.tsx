import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Animated, Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useRouter } from "expo-router";

import ChipIcon from "@/components/ChipIcon";
import PlayingCard from "@/components/PlayingCard";
import PressButton from "@/components/PressButton";
import colors from "@/constants/colors";
import {
  Card,
  cardKey,
  compareEval,
  drawDeck,
  evaluate,
  myOdds,
  OddsResult,
  whoWon,
} from "@/lib/poker";
import { useGame } from "@/providers/GameProvider";

/**
 * The Table — 3-handed Texas Hold'em vs 2 AI opponents.
 * Buy-in 200 chips from bankroll. Blinds 5/10. Full streets.
 * Showdown judged by the real evaluator; split pots handled.
 * Hero sees a live win % (Monte Carlo) on every street.
 * Drama: felt table, chip fly-in animations, showdown reveal, suspenseful AI.
 */

const BUY_IN = 200;
const SB = 5;
const BB = 10;
const START_STACK = 1000;

type Street = "preflop" | "flop" | "turn" | "river" | "showdown" | "done";

interface Opponent {
  name: string;
  emoji: string;
  hole: Card[];
  stack: number;
  folded: boolean;
  bet: number;
  totalCommitted: number;
  isHero: boolean;
  hasActed: boolean;
  allIn: boolean;
  revealed: boolean;
}

interface LogEntry {
  text: string;
  tone: "neutral" | "good" | "bad" | "dim";
}

interface ChipFly {
  id: number;
  from: "hero" | "opp1" | "opp2";
  toPot: boolean;
}

const SUITS = ["♠", "♥", "♦", "♣"];

function rankStr(r: number): string {
  if (r === 14) return "A";
  if (r === 13) return "K";
  if (r === 12) return "Q";
  if (r === 11) return "J";
  return String(r);
}

function cardStr(c: Card): string {
  return `${rankStr(c.r)}${SUITS[c.s]}`;
}

function shortHand(cards: Card[]): string {
  return cards.map(cardStr).join(" ");
}

/** Build a fresh shuffled deck minus the dealt cards. */
function freshDeck(used: Set<number>): Card[] {
  const deck: Card[] = [];
  for (let r = 2; r <= 14; r++) for (let s = 0; s < 4; s++) {
    const k = r * 4 + s;
    if (!used.has(k)) deck.push({ r, s });
  }
  for (let i = deck.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [deck[i], deck[j]] = [deck[j], deck[i]];
  }
  return deck;
}

/** AI equity estimate — Monte Carlo over remaining unknown cards. */
function aiEquity(hole: Card[], board: Card[], opponents: number, iters = 200): number {
  const o: OddsResult = myOdds(hole, board, opponents, iters);
  return (o.winPct + o.tiePct * 0.5) / 100;
}

interface AiDecision {
  action: "fold" | "check" | "call" | "raise";
  amount?: number;
}

function aiDecide(
  hole: Card[],
  board: Card[],
  toCall: number,
  pot: number,
  stack: number,
  aggressiveness: number,
): AiDecision {
  const eq = aiEquity(hole, board, 1, 180);
  const potOdds = toCall / (pot + toCall + 0.0001);
  const bluffRoll = Math.random();
  if (eq < 0.25 && toCall > 0 && bluffRoll > 0.92 && stack > toCall * 3) {
    return { action: "raise", amount: Math.min(stack, Math.max(toCall + BB, Math.round(pot * 0.6))) };
  }
  if (toCall === 0) {
    if (eq > 0.6) return { action: "raise", amount: Math.min(stack, Math.round(pot * (0.5 + aggressiveness * 0.3))) };
    if (eq > 0.4 && Math.random() < 0.3) return { action: "raise", amount: Math.min(stack, Math.round(pot * 0.4)) };
    return { action: "check" };
  }
  if (eq < potOdds * 0.7) return { action: "fold" };
  if (eq > 0.7 && stack > toCall * 2 && Math.random() < 0.4 + aggressiveness * 0.3) {
    return { action: "raise", amount: Math.min(stack, toCall + Math.round(pot * (0.5 + aggressiveness * 0.4))) };
  }
  if (eq >= potOdds) return { action: "call", amount: toCall };
  return { action: "fold" };
}

/** Animated thinking dots for the AI. */
function ThinkingDots() {
  const [dot, setDot] = useState<number>(0);
  useEffect(() => {
    const t = setInterval(() => setDot((d) => (d + 1) % 4), 380);
    return () => clearInterval(t);
  }, []);
  const text = "thinking" + ".".repeat(dot);
  return <Text style={styles.thinkingText}>{text}</Text>;
}

export default function TableScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { chips, payChips, recordBiggestPot } = useGame();

  const [phase, setPhase] = useState<"buyin" | "playing" | "felted" | "cashedout">("buyin");
  const [players, setPlayers] = useState<Opponent[]>([]);
  const [board, setBoard] = useState<Card[]>([]);
  const [street, setStreet] = useState<Street>("preflop");
  const [pot, setPot] = useState<number>(0);
  const [toCall, setToCall] = useState<number>(0);
  const [heroTurn, setHeroTurn] = useState<boolean>(false);
  const [log, setLog] = useState<LogEntry[]>([]);
  const [showdown, setShowdown] = useState<{ winners: string[]; hand: string; evals: { name: string; hand: string }[] } | null>(null);
  const [handsPlayed, setHandsPlayed] = useState<number>(0);
  const [biggestPot, setBiggestPot] = useState<number>(0);
  const [odds, setOdds] = useState<OddsResult | null>(null);
  const [dealerIdx, setDealerIdx] = useState<number>(0);
  const [actionIdx, setActionIdx] = useState<number>(0);
  const [betSize, setBetSize] = useState<number>(BB * 2);
  const [chipFlies, setChipFlies] = useState<ChipFly[]>([]);
  const [stackFlash, setStackFlash] = useState<"win" | "loss" | null>(null);
  const [aiThinking, setAiThinking] = useState<boolean>(false);

  const deckRef = useRef<Card[]>([]);
  const usedRef = useRef<Set<number>>(new Set());
  const aiTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const chipIdRef = useRef<number>(0);

  const hero = players.find((p) => p.isHero);
  const heroIdx = players.findIndex((p) => p.isHero);

  const addLog = useCallback((text: string, tone: LogEntry["tone"] = "neutral") => {
    setLog((prev) => [...prev.slice(-30), { text, tone }]);
  }, []);

  const flyChips = useCallback((from: "hero" | "opp1" | "opp2") => {
    chipIdRef.current += 1;
    const id = chipIdRef.current;
    setChipFlies((prev) => [...prev, { id, from, toPot: true }]);
    setTimeout(() => setChipFlies((prev) => prev.filter((c) => c.id !== id)), 650);
  }, []);

  /** Charge the buy-in and start the session. */
  const sitDown = useCallback(() => {
    if (chips < BUY_IN) return;
    payChips(-BUY_IN, true);
    setPlayers([
      { name: "Dev", emoji: "🧢", hole: [], stack: START_STACK, folded: false, bet: 0, totalCommitted: 0, isHero: false, hasActed: false, allIn: false, revealed: false },
      { name: "You", emoji: "🦈", hole: [], stack: START_STACK, folded: false, bet: 0, totalCommitted: 0, isHero: true, hasActed: false, allIn: false, revealed: false },
      { name: "Tori", emoji: "🌺", hole: [], stack: START_STACK, folded: false, bet: 0, totalCommitted: 0, isHero: false, hasActed: false, allIn: false, revealed: false },
    ]);
    setPhase("playing");
    setHandsPlayed(0);
    setBiggestPot(0);
    setDealerIdx(0);
    addLog(`Sat down for ${BUY_IN} chips. Blinds ${SB}/${BB}.`, "neutral");
  }, [chips, payChips, addLog]);

  const newHand = useCallback(() => {
    if (players.length === 0) return;
    const heroPlayer = players.find((p) => p.isHero);
    if (!heroPlayer || heroPlayer.stack <= 0) {
      setPhase("felted");
      return;
    }
    const livePlayers = players.filter((p) => p.stack > 0 || p.isHero);
    if (livePlayers.filter((p) => p.stack > 0).length < 2) {
      setPhase("cashedout");
      return;
    }

    usedRef.current = new Set<number>();
    const deck = freshDeck(usedRef.current);
    deckRef.current = deck;

    const reset: Opponent[] = livePlayers.map((p) => ({
      ...p,
      hole: [deck.pop()!, deck.pop()!],
      folded: false,
      bet: 0,
      totalCommitted: 0,
      hasActed: false,
      allIn: p.stack <= 0,
      revealed: false,
    }));
    while (reset.length < 3) {
      const nameOpts = ["Mike", "Brandon", "Sam", "Riley"];
      reset.push({
        name: nameOpts[reset.length % nameOpts.length],
        emoji: "🎧",
        hole: [deck.pop()!, deck.pop()!],
        stack: START_STACK,
        folded: false,
        bet: 0,
        totalCommitted: 0,
        isHero: false,
        hasActed: false,
        allIn: false,
        revealed: false,
      });
    }
    setPlayers(reset);

    const dIdx = dealerIdx % reset.length;
    const sbIdx = (dIdx + 1) % reset.length;
    const bbIdx = (dIdx + 2) % reset.length;

    const postBlind = (arr: Opponent[], i: number, amt: number) => {
      const a = Math.min(amt, arr[i].stack);
      arr[i].stack -= a;
      arr[i].bet = a;
      arr[i].totalCommitted = a;
      if (arr[i].stack === 0) arr[i].allIn = true;
    };
    postBlind(reset, sbIdx, SB);
    postBlind(reset, bbIdx, BB);

    setPlayers([...reset]);
    setBoard([]);
    setStreet("preflop");
    setShowdown(null);
    setPot(SB + BB);
    setToCall(BB);
    setBetSize(BB * 2);
    setDealerIdx(dIdx);
    setActionIdx(sbIdx);
    setLog([]);
    addLog(`New hand. ${reset[dIdx].name} has the button. Blinds ${SB}/${BB}.`, "neutral");
  }, [players, dealerIdx, addLog]);

  // Start first hand once we've sat down
  useEffect(() => {
    if (phase === "playing" && handsPlayed === 0 && players.length > 0 && street === "preflop" && board.length === 0 && pot === 0) {
      newHand();
      setHandsPlayed(1);
    }
  }, [phase, handsPlayed, players, street, board.length, pot, newHand]);

  useEffect(() => {
    if (!hero || hero.folded || hero.hole.length < 2) { setOdds(null); return; }
    const liveOpps = players.filter((p) => !p.isHero && !p.folded).length;
    if (liveOpps === 0) { setOdds(null); return; }
    const o = myOdds(hero.hole, board, liveOpps, 1200);
    setOdds(o);
  }, [hero, board, players]);

  const nextAction = useCallback(
    (curPlayers: Opponent[], fromIdx: number): number => {
      const n = curPlayers.length;
      for (let k = 1; k <= n; k++) {
        const i = (fromIdx + k) % n;
        const p = curPlayers[i];
        if (!p.folded && !p.allIn) return i;
      }
      return -1;
    },
    [],
  );

  const roundComplete = useCallback(
    (curPlayers: Opponent[]): boolean => {
      const live = curPlayers.filter((p) => !p.folded);
      if (live.length <= 1) return true;
      const acting = live.filter((p) => !p.allIn);
      if (acting.length === 0) return true;
      const maxBet = Math.max(...live.map((p) => p.bet));
      return acting.every((p) => p.hasActed && p.bet === maxBet);
    },
    [],
  );

  const advanceStreet = useCallback(
    (curPlayers: Opponent[], curBoard: Card[], _curPot: number) => {
      const reset = curPlayers.map((p) => ({ ...p, bet: 0, hasActed: false }));
      setPlayers(reset);

      const deal = (count: number) => {
        const d = deckRef.current;
        const out: Card[] = [];
        for (let i = 0; i < count; i++) out.push(d.pop()!);
        return out;
      };

      if (curBoard.length === 0) {
        const flop = deal(3);
        const nb = [...curBoard, ...flop];
        setBoard(nb);
        setStreet("flop");
        addLog(`Flop: ${flop.map(cardStr).join(" ")}`, "neutral");
        return { board: nb, street: "flop" as Street };
      }
      if (curBoard.length === 3) {
        const turn = deal(1);
        const nb = [...curBoard, ...turn];
        setBoard(nb);
        setStreet("turn");
        addLog(`Turn: ${cardStr(turn[0])}`, "neutral");
        return { board: nb, street: "turn" as Street };
      }
      if (curBoard.length === 4) {
        const river = deal(1);
        const nb = [...curBoard, ...river];
        setBoard(nb);
        setStreet("river");
        addLog(`River: ${cardStr(river[0])}`, "neutral");
        return { board: nb, street: "river" as Street };
      }
      setStreet("showdown");
      return { board: curBoard, street: "showdown" as Street };
    },
    [addLog],
  );

  const settleHand = useCallback(
    (curPlayers: Opponent[], curBoard: Card[], curPot: number) => {
      const live = curPlayers.filter((p) => !p.folded);
      if (live.length === 1) {
        const winner = live[0];
        winner.stack += curPot;
        setPlayers((prev) => prev.map((p) => (p.name === winner.name && p.isHero === winner.isHero ? { ...p, stack: p.stack + curPot } : p)));
        addLog(`${winner.name} wins ${curPot} chips uncontested.`, winner.isHero ? "good" : "neutral");
        setPot(0);
        setStreet("done");
        if (winner.isHero) {
          setBiggestPot((b) => Math.max(b, curPot));
          recordBiggestPot(curPot);
          setStackFlash("win");
        } else if (!winner.isHero) {
          setStackFlash("loss");
        }
        setTimeout(() => setStackFlash(null), 900);
        return;
      }
      // Showdown — reveal opponents, use the real evaluator
      setPlayers((prev) => prev.map((p) => (!p.isHero && !p.folded ? { ...p, revealed: true } : p)));
      const result = whoWon(
        live.map((p) => ({ name: p.name, hole: p.hole })),
        curBoard,
      );
      const share = Math.floor(curPot / result.winners.length);
      const remainder = curPot - share * result.winners.length;
      setPlayers((prev) =>
        prev.map((p) => {
          if (!result.winners.includes(p.name)) return p;
          const extra = result.winners.indexOf(p.name) === 0 ? remainder : 0;
          return { ...p, stack: p.stack + share + extra };
        }),
      );
      setShowdown(result);
      addLog(
        result.winners.length > 1
          ? `Chop! ${result.winners.join(" + ")} split ${curPot} (${result.hand}).`
          : `${result.winners[0]} wins ${curPot} with ${result.hand}.`,
        result.winners.includes("You") ? "good" : "bad",
      );
      if (result.winners.includes("You")) {
        setBiggestPot((b) => Math.max(b, curPot));
        recordBiggestPot(curPot);
        setStackFlash("win");
      } else {
        setStackFlash("loss");
      }
      setTimeout(() => setStackFlash(null), 1400);
      setPot(0);
      setStreet("done");
    },
    [addLog, recordBiggestPot],
  );

  const progress = useCallback(
    (curPlayers: Opponent[], curBoard: Card[], curPot: number, curStreet: Street) => {
      const live = curPlayers.filter((p) => !p.folded);
      if (live.length === 1) {
        settleHand(curPlayers, curBoard, curPot);
        return;
      }
      if (roundComplete(curPlayers)) {
        if (curBoard.length === 5) {
          settleHand(curPlayers, curBoard, curPot);
        } else {
          advanceStreet(curPlayers, curBoard, curPot);
        }
      } else {
        const next = nextAction(curPlayers, actionIdx);
        if (next === -1) {
          settleHand(curPlayers, curBoard, curPot);
        } else {
          setActionIdx(next);
        }
      }
    },
    [actionIdx, nextAction, roundComplete, advanceStreet, settleHand],
  );

  const heroAct = useCallback(
    (action: "fold" | "check" | "call" | "raise", raiseTotal?: number) => {
      if (!hero || hero.folded || street === "showdown" || street === "done") return;
      const curPlayers = players.map((p) => ({ ...p }));
      const me = curPlayers[heroIdx];
      if (!me) return;
      const maxBet = Math.max(...curPlayers.filter((p) => !p.folded).map((p) => p.bet));
      const owe = maxBet - me.bet;

      if (action === "fold") {
        me.folded = true;
        me.hasActed = true;
        addLog("You fold.", "bad");
        setPlayers(curPlayers);
        progress(curPlayers, board, pot, street);
        return;
      }
      if (action === "check") {
        if (owe > 0) return;
        me.hasActed = true;
        addLog("You check.", "neutral");
        setPlayers(curPlayers);
        progress(curPlayers, board, pot, street);
        return;
      }
      if (action === "call") {
        const pay = Math.min(owe, me.stack);
        me.stack -= pay;
        me.bet += pay;
        me.totalCommitted += pay;
        if (me.stack === 0) me.allIn = true;
        me.hasActed = true;
        addLog(`You call ${pay}.`, "neutral");
        setPlayers(curPlayers);
        setPot(pot + pay);
        flyChips("hero");
        progress(curPlayers, board, pot + pay, street);
        return;
      }
      if (action === "raise") {
        const total = raiseTotal ?? betSize;
        const pay = Math.min(total, me.stack);
        me.stack -= pay;
        me.bet += pay;
        me.totalCommitted += pay;
        if (me.stack === 0) me.allIn = true;
        me.hasActed = true;
        curPlayers.forEach((p) => { if (!p.isHero && !p.folded && !p.allIn) p.hasActed = false; });
        addLog(`You raise to ${me.bet}.`, "good");
        setPlayers(curPlayers);
        setPot(pot + pay);
        setBetSize(pay * 2);
        flyChips("hero");
        progress(curPlayers, board, pot + pay, street);
        return;
      }
    },
    [hero, heroIdx, players, street, board, pot, betSize, addLog, progress, flyChips],
  );

  const aiAct = useCallback(() => {
    if (street === "showdown" || street === "done") return;
    const curPlayers = players.map((p) => ({ ...p }));
    const ai = curPlayers[actionIdx];
    const aiSeat = actionIdx === 0 ? "opp1" : "opp2";
    if (!ai || ai.isHero || ai.folded || ai.allIn) {
      const next = nextAction(curPlayers, actionIdx);
      if (next === -1) { settleHand(curPlayers, board, pot); return; }
      setActionIdx(next);
      return;
    }
    const maxBet = Math.max(...curPlayers.filter((p) => !p.folded).map((p) => p.bet));
    const owe = maxBet - ai.bet;
    const dec = aiDecide(ai.hole, board, owe, pot, ai.stack, ai.name === "Dev" ? 0.5 : 0.3);

    if (dec.action === "fold") {
      ai.folded = true;
      ai.hasActed = true;
      addLog(`${ai.name} folds.`, "dim");
    } else if (dec.action === "check") {
      ai.hasActed = true;
      addLog(`${ai.name} checks.`, "dim");
    } else if (dec.action === "call") {
      const pay = Math.min(owe, ai.stack);
      ai.stack -= pay;
      ai.bet += pay;
      ai.totalCommitted += pay;
      if (ai.stack === 0) ai.allIn = true;
      ai.hasActed = true;
      addLog(`${ai.name} calls ${pay}.`, "neutral");
      setPot((p) => p + pay);
      flyChips(aiSeat);
    } else if (dec.action === "raise") {
      const target = Math.max(maxBet + BB, dec.amount ?? maxBet * 2);
      const pay = Math.min(target - ai.bet, ai.stack);
      ai.stack -= pay;
      ai.bet += pay;
      ai.totalCommitted += pay;
      if (ai.stack === 0) ai.allIn = true;
      ai.hasActed = true;
      curPlayers.forEach((p) => { if (!p.isHero && p !== ai && !p.folded && !p.allIn) p.hasActed = false; });
      curPlayers.forEach((p) => { if (p.isHero && !p.folded && !p.allIn) p.hasActed = false; });
      addLog(`${ai.name} raises to ${ai.bet}.`, "bad");
      setPot((p) => p + pay);
      setBetSize(Math.max(BB * 2, (ai.bet) * 2));
      flyChips(aiSeat);
    }
    setPlayers(curPlayers);
    setAiThinking(false);
    progress(curPlayers, board, pot, street);
  }, [players, actionIdx, board, pot, street, addLog, nextAction, settleHand, progress, flyChips]);

  // Drive AI turns — suspenseful ~1.5-2s with thinking indicator
  useEffect(() => {
    if (phase !== "playing") return;
    if (street === "showdown" || street === "done") return;
    const actingPlayer = players[actionIdx];
    if (!actingPlayer || actingPlayer.isHero || actingPlayer.folded || actingPlayer.allIn) {
      setHeroTurn(!!actingPlayer && actingPlayer.isHero && !actingPlayer.folded && !actingPlayer.allIn);
      setAiThinking(false);
      return;
    }
    setHeroTurn(false);
    setAiThinking(true);
    const delay = 1500 + Math.random() * 500;
    aiTimer.current = setTimeout(() => { aiAct(); }, delay);
    return () => { if (aiTimer.current) clearTimeout(aiTimer.current); };
  }, [phase, street, players, actionIdx, aiAct]);

  // After a hand is done, either auto-start next or end session
  useEffect(() => {
    if (street !== "done") return;
    const t = setTimeout(() => {
      const heroPlayer = players.find((p) => p.isHero);
      if (!heroPlayer || heroPlayer.stack <= 0) {
        setPhase("felted");
        return;
      }
      setDealerIdx((d) => d + 1);
      newHand();
      setHandsPlayed((h) => h + 1);
    }, 2600);
    return () => clearTimeout(t);
  }, [street, players, newHand]);

  const leaveTable = useCallback(() => {
    const heroStack = hero?.stack ?? 0;
    const cashout = heroStack - BUY_IN;
    if (heroStack > 0) payChips(heroStack, true);
    addLog(`Left the table. ${heroStack > 0 ? `Cashed out ${heroStack} (${cashout >= 0 ? "+" : ""}${cashout}).` : "Felted."}`, heroStack > BUY_IN ? "good" : "bad");
    router.back();
  }, [hero, payChips, addLog, router]);

  const liveOppCount = players.filter((p) => !p.isHero && !p.folded).length;
  const heroEval = useMemo(() => (hero && hero.hole.length === 2 && board.length >= 3 ? evaluate([...hero.hole, ...board]) : null), [hero, board]);

  // ---------- BUY-IN SCREEN ----------
  if (phase === "buyin") {
    return (
      <View style={[styles.screen, { paddingTop: insets.top }]}>
        <View style={styles.buyinWrap}>
          <View style={styles.felt}>
            <Text style={styles.feltEmoji}>♠️♥️♦️♣️</Text>
            <Text style={styles.feltTitle}>The Table</Text>
            <Text style={styles.feltSub}>3-handed No-Limit Hold&apos;em · vs Dev &amp; Tori</Text>
            <View style={styles.feltRules}>
              <Text style={styles.feltRule}>Buy-in {BUY_IN} chips · Blinds {SB}/{BB}</Text>
              <Text style={styles.feltRule}>Full streets: preflop → flop → turn → river</Text>
              <Text style={styles.feltRule}>Real evaluator judges showdown · split pots handled</Text>
              <Text style={styles.feltRule}>Live win % on every street (Monte Carlo)</Text>
            </View>
          </View>
          <View style={styles.buyinRow}>
            <ChipIcon size={22} />
            <Text style={styles.buyinNum}>{BUY_IN}</Text>
            <Text style={styles.buyinLabel}>buy-in</Text>
          </View>
          <Text style={styles.bankroll}>Your bankroll: <Text style={styles.bankrollNum}>{chips.toLocaleString()}</Text> chips</Text>
          <PressButton label="Sit down" onPress={sitDown} disabled={chips < BUY_IN} style={styles.cta} testID="sit-down" />
          <PressButton label="Not yet" variant="ghost" onPress={() => router.back()} />
          {chips < BUY_IN && <Text style={styles.warn}>Need {BUY_IN} chips to sit down. Hit the Arena to earn some.</Text>}
        </View>
      </View>
    );
  }

  // ---------- FELTED / CASHED OUT ----------
  if (phase === "felted" || phase === "cashedout") {
    const stack = hero?.stack ?? 0;
    const profit = stack - BUY_IN;
    return (
      <View style={[styles.screen, { paddingTop: insets.top }]}>
        <View style={styles.buyinWrap}>
          <Text style={styles.feltEmoji}>{phase === "felted" ? "💀" : "🏁"}</Text>
          <Text style={styles.feltTitle}>{phase === "felted" ? "Felted." : "Cashed out."}</Text>
          <Text style={styles.feltSub}>
            {phase === "felted"
              ? "You lost your stack. The fix? More lessons, more Arena. Run it back when you're ready."
              : `You walked away with ${stack} chips (${profit >= 0 ? "+" : ""}${profit}).`}
          </Text>
          <View style={styles.rewardRow}>
            <View style={styles.reward}>
              <Text style={styles.rewardV}>{handsPlayed}</Text>
              <Text style={styles.rewardK}>hands</Text>
            </View>
            <View style={styles.reward}>
              <Text style={[styles.rewardV, { color: colors.gold2 }]}>{biggestPot}</Text>
              <Text style={styles.rewardK}>biggest pot</Text>
            </View>
            <View style={styles.reward}>
              <Text style={[styles.rewardV, { color: profit >= 0 ? colors.good : colors.red }]}>
                {profit >= 0 ? "+" : ""}{profit}
              </Text>
              <Text style={styles.rewardK}>net</Text>
            </View>
          </View>
          {phase === "felted" ? (
            <PressButton label="Back to the books" onPress={() => router.push("/")} testID="felted-lessons" />
          ) : (
            <PressButton label="Leave the table" onPress={() => router.back()} testID="leave-table" />
          )}
        </View>
      </View>
    );
  }

  // ---------- PLAYING ----------
  const heroOwe = (() => {
    if (!hero || hero.folded) return 0;
    const maxBet = Math.max(...players.filter((p) => !p.folded).map((p) => p.bet));
    return Math.max(0, maxBet - hero.bet);
  })();
  const heroStack = hero?.stack ?? 0;
  const potBet = Math.max(BB, pot);
  const halfPot = Math.max(BB, Math.round(pot / 2));
  const threeQuarterPot = Math.max(BB, Math.round(pot * 0.75));
  const minRaise = Math.max(BB, (players.filter((p) => !p.folded).reduce((m, p) => Math.max(m, p.bet), 0)) + BB);

  return (
    <View style={[styles.screen, { paddingTop: insets.top }]}>
      <View style={styles.tableHeader}>
        <Pressable onPress={leaveTable} hitSlop={10} testID="leave-table-btn">
          <Text style={styles.leaveBtn}>‹ Leave</Text>
        </Pressable>
        <View style={styles.streetPill}>
          <Text style={styles.streetText}>{street === "showdown" ? "SHOWDOWN" : street.toUpperCase()}</Text>
        </View>
      </View>

      {/* Felt table — opponents + pot + board */}
      <View style={styles.feltTable}>
        {/* Opponents (non-hero) */}
        <View style={styles.opponentsRow}>
          {players.filter((p) => !p.isHero).map((p, i) => {
            const seat = i === 0 ? "opp1" : "opp2";
            const isActive = actionIdx === players.indexOf(p) && !p.folded;
            return (
              <View
                key={p.name + i}
                style={[
                  styles.oppCard,
                  isActive && styles.oppCardActive,
                  p.folded && styles.oppCardFolded,
                ]}
              >
                <View style={styles.oppHead}>
                  <Text style={styles.oppEmoji}>{p.emoji}</Text>
                  <Text style={styles.oppName}>{p.name}</Text>
                </View>
                <View style={styles.oppHole}>
                  {(street === "showdown" || p.allIn || p.revealed) && p.hole.length === 2
                    ? p.hole.map((c, ci) => <PlayingCard key={ci} card={c} size="tiny" />)
                    : <><Text style={styles.cardBack}>🂠</Text><Text style={styles.cardBack}>🂠</Text></>}
                </View>
                <View style={styles.oppStack}>
                  <ChipIcon size={9} />
                  <Text style={styles.oppStackNum}>{p.stack}</Text>
                </View>
                {p.bet > 0 && (
                  <View style={styles.oppBetPill}>
                    <ChipIcon size={8} />
                    <Text style={styles.oppBetText}>{p.bet}</Text>
                  </View>
                )}
                {p.folded && <Text style={styles.foldedTag}>FOLDED</Text>}
                {p.allIn && !p.folded && <Text style={styles.allinTag}>ALL-IN</Text>}
                {isActive && aiThinking && <ThinkingDots />}
                {chipFlies.some((c) => c.from === seat) && <View style={styles.flyChip} />}
              </View>
            );
          })}
        </View>

        {/* Pot + Board in the middle of the felt */}
        <View style={styles.centerArea}>
          <View style={styles.potPill}>
            <Text style={styles.potLabel}>POT</Text>
            <ChipIcon size={12} />
            <Text style={styles.potNum}>{pot}</Text>
          </View>
          <View style={styles.boardRow}>
            {Array.from({ length: 5 }, (_, i) => {
              const c = board[i];
              if (c) return <PlayingCard key={i} card={c} size="small" />;
              return <View key={i} style={styles.boardSlot} />;
            })}
          </View>
          {heroEval && <Text style={styles.heroHandName}>Your hand: {heroEval.name}</Text>}
          {odds && liveOppCount > 0 && (
            <View style={styles.oddsPill}>
              <Text style={styles.oddsLabel}>LIVE WIN %</Text>
              <Text style={[styles.oddsNum, odds.winPct >= 50 ? styles.oddsGood : odds.winPct >= 30 ? styles.oddsMid : styles.oddsBad]}>
                {odds.winPct.toFixed(0)}%
              </Text>
              <Text style={styles.oddsDetail}>vs {liveOppCount} · {odds.iters.toLocaleString()} sims</Text>
            </View>
          )}
          {chipFlies.some((c) => c.from === "hero") && <View style={[styles.flyChip, styles.flyChipHero]} />}
        </View>
      </View>

      {/* Hero */}
      <View style={styles.heroArea}>
        <View
          style={[
            styles.heroCard,
            heroTurn && styles.heroCardActive,
            hero?.folded && styles.heroCardFolded,
            stackFlash === "win" && styles.heroCardWin,
            stackFlash === "loss" && styles.heroCardLoss,
          ]}
        >
          <View style={styles.heroHead}>
            <Text style={styles.heroEmoji}>{hero?.emoji}</Text>
            <Text style={styles.heroName}>You</Text>
            <View style={styles.heroStackRow}>
              <ChipIcon size={11} />
              <Text style={styles.heroStack}>{heroStack}</Text>
            </View>
          </View>
          <View style={styles.heroHole}>
            {hero && hero.hole.length === 2
              ? hero.hole.map((c, ci) => <PlayingCard key={ci} card={c} size="big" />)
              : <><View style={styles.holeSlot} /><View style={styles.holeSlot} /></>}
          </View>
          {hero && hero.bet > 0 && (
            <View style={styles.heroBetPill}>
              <ChipIcon size={9} />
              <Text style={styles.heroBetText}>{hero.bet}</Text>
            </View>
          )}
        </View>
      </View>

      {/* Action bar — bigger, with bet slider + presets */}
      {heroTurn && !hero?.folded && street !== "showdown" && street !== "done" ? (
        <View style={styles.actionWrap}>
          {/* Bet sizing row */}
          <View style={styles.betSizeRow}>
            <Pressable style={styles.presetBtn} onPress={() => setBetSize(Math.max(minRaise, halfPot))}>
              <Text style={styles.presetText}>½ pot</Text>
            </Pressable>
            <Pressable style={styles.presetBtn} onPress={() => setBetSize(Math.max(minRaise, threeQuarterPot))}>
              <Text style={styles.presetText}>¾ pot</Text>
            </Pressable>
            <Pressable style={styles.presetBtn} onPress={() => setBetSize(Math.max(minRaise, potBet))}>
              <Text style={styles.presetText}>pot</Text>
            </Pressable>
            <Pressable style={styles.allinBtn} onPress={() => setBetSize(heroStack)}>
              <Text style={styles.allinBtnText}>ALL-IN</Text>
            </Pressable>
          </View>
          {/* Bet slider (stepper) */}
          <View style={styles.raiseRow}>
            <Pressable style={styles.raiseAdj} onPress={() => setBetSize((b) => Math.max(minRaise, b - BB))}>
              <Text style={styles.raiseAdjText}>−</Text>
            </Pressable>
            <Text style={styles.raiseSize}>{betSize}</Text>
            <Pressable style={styles.raiseAdj} onPress={() => setBetSize((b) => Math.min(heroStack, b + BB))}>
              <Text style={styles.raiseAdjText}>+</Text>
            </Pressable>
          </View>
          {/* Action buttons */}
          <View style={styles.actionBar}>
            <Pressable style={styles.actBtnFold} onPress={() => heroAct("fold")} testID="hero-fold">
              <Text style={styles.actBtnFoldText}>Fold</Text>
            </Pressable>
            {heroOwe === 0 ? (
              <Pressable style={styles.actBtn} onPress={() => heroAct("check")} testID="hero-check">
                <Text style={styles.actBtnText}>Check</Text>
              </Pressable>
            ) : (
              <Pressable style={styles.actBtn} onPress={() => heroAct("call")} testID="hero-call">
                <Text style={styles.actBtnText}>Call {Math.min(heroOwe, heroStack)}</Text>
              </Pressable>
            )}
            <Pressable style={styles.actBtnRaise} onPress={() => heroAct("raise", betSize)} testID="hero-raise">
              <Text style={styles.actBtnRaiseText}>Raise {betSize}</Text>
            </Pressable>
          </View>
        </View>
      ) : (
        <View style={styles.actionBarWaiting}>
          {aiThinking && <ThinkingDots />}
          {!aiThinking && (
            <Text style={styles.waitingText}>
              {street === "showdown" ? "Showdown…" : street === "done" ? "Hand over…" : `${players[actionIdx]?.name ?? ""} is thinking…`}
            </Text>
          )}
        </View>
      )}

      {/* Showdown summary */}
      {street === "showdown" && showdown && (
        <View style={styles.showdownSheet}>
          <Text style={styles.showdownTitle}>{showdown.winners.length > 1 ? "Chop pot!" : "Winner!"}</Text>
          <Text style={styles.showdownWinner}>{showdown.winners.join(" + ")}</Text>
          <Text style={styles.showdownHand}>{showdown.hand}</Text>
          <View style={styles.showdownEvals}>
            {showdown.evals.map((e) => (
              <View key={e.name} style={styles.showdownRow}>
                <Text style={styles.showdownName}>{e.name}</Text>
                <Text style={styles.showdownEvalHand}>{e.hand}</Text>
              </View>
            ))}
          </View>
        </View>
      )}

      {/* Log (scrollable) */}
      <ScrollView style={styles.logScroll} contentContainerStyle={{ paddingVertical: 8 }}>
        {log.map((l, i) => (
          <Text key={i} style={[styles.logLine, l.tone === "good" && styles.logGood, l.tone === "bad" && styles.logBad, l.tone === "dim" && styles.logDim]}>
            {l.text}
          </Text>
        ))}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.bg },
  buyinWrap: { flex: 1, alignItems: "center", justifyContent: "center", padding: 28 },
  felt: {
    backgroundColor: colors.table2,
    borderRadius: 28,
    borderWidth: 2,
    borderColor: colors.table,
    padding: 24,
    alignItems: "center",
    marginBottom: 24,
    width: "100%",
  },
  feltEmoji: { fontSize: 32, marginBottom: 6 },
  feltTitle: { fontSize: 28, fontFamily: "Outfit_900Black", color: colors.cream, letterSpacing: -0.5 },
  feltSub: { fontSize: 14, color: colors.mint2, fontFamily: "Outfit_600SemiBold", marginTop: 4, textAlign: "center" },
  feltRules: { marginTop: 14, alignSelf: "stretch" },
  feltRule: {
    fontSize: 12.5,
    color: "rgba(226,248,225,0.8)",
    fontFamily: "Outfit_500Medium",
    textAlign: "center",
    marginVertical: 3,
    lineHeight: 18,
  },
  buyinRow: { flexDirection: "row", alignItems: "center", gap: 8, marginBottom: 8 },
  buyinNum: { fontSize: 36, fontFamily: "Outfit_900Black", color: colors.chipText, letterSpacing: -1 },
  buyinLabel: { fontSize: 14, color: colors.dim, fontFamily: "Outfit_800ExtraBold", letterSpacing: 1, textTransform: "uppercase" },
  bankroll: { fontSize: 13, color: colors.muted, fontFamily: "Outfit_600SemiBold", marginBottom: 18, textAlign: "center" },
  bankrollNum: { color: colors.cream, fontFamily: "Outfit_900Black" },
  cta: { alignSelf: "stretch", marginBottom: 8 },
  warn: { color: colors.red, fontSize: 12.5, fontFamily: "Outfit_700Bold", marginTop: 12, textAlign: "center" },
  rewardRow: { flexDirection: "row", gap: 12, marginBottom: 28 },
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
  rewardV: { fontSize: 23, fontFamily: "Outfit_900Black", color: colors.cream },
  rewardK: { fontSize: 10.5, fontFamily: "Outfit_700Bold", letterSpacing: 1, color: colors.muted, textTransform: "uppercase", marginTop: 2 },

  tableHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 16,
    paddingTop: 10,
    paddingBottom: 6,
  },
  leaveBtn: { color: colors.mint, fontSize: 14, fontFamily: "Outfit_800ExtraBold" },
  streetPill: {
    backgroundColor: colors.table,
    borderRadius: 999,
    paddingVertical: 6,
    paddingHorizontal: 14,
  },
  streetText: { fontSize: 11, fontFamily: "Outfit_900Black", color: colors.mint2, letterSpacing: 1.4 },

  feltTable: {
    marginHorizontal: 12,
    marginTop: 4,
    backgroundColor: colors.table2,
    borderRadius: 28,
    borderWidth: 2,
    borderColor: colors.table,
    paddingVertical: 14,
    paddingHorizontal: 10,
    position: "relative",
  },
  opponentsRow: { flexDirection: "row", justifyContent: "center", gap: 16 },
  oppCard: {
    alignItems: "center",
    backgroundColor: "rgba(10,15,12,0.45)",
    borderWidth: 1.5,
    borderColor: "rgba(198,238,199,0.18)",
    borderRadius: 16,
    paddingVertical: 10,
    paddingHorizontal: 14,
    minWidth: 108,
    position: "relative",
  },
  oppCardActive: { borderColor: colors.mint, backgroundColor: "rgba(198,238,199,0.1)" },
  oppCardFolded: { opacity: 0.45 },
  oppHead: { flexDirection: "row", alignItems: "center", gap: 6 },
  oppEmoji: { fontSize: 18 },
  oppName: { fontSize: 13, fontFamily: "Outfit_800ExtraBold", color: colors.cream },
  oppHole: { flexDirection: "row", gap: 4, marginVertical: 8 },
  cardBack: { fontSize: 24 },
  oppStack: { flexDirection: "row", alignItems: "center", gap: 4 },
  oppStackNum: { fontSize: 12, fontFamily: "Outfit_800ExtraBold", color: colors.chipText },
  oppBetPill: {
    marginTop: 6,
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    backgroundColor: "rgba(216,73,58,0.18)",
    borderWidth: 1,
    borderColor: "rgba(216,73,58,0.4)",
    borderRadius: 999,
    paddingVertical: 3,
    paddingHorizontal: 8,
  },
  oppBetText: { fontSize: 10, fontFamily: "Outfit_800ExtraBold", color: colors.chipText },
  foldedTag: { fontSize: 9, fontFamily: "Outfit_900Black", color: colors.red, letterSpacing: 1, marginTop: 4 },
  allinTag: { fontSize: 9, fontFamily: "Outfit_900Black", color: colors.gold, letterSpacing: 1, marginTop: 4 },
  thinkingText: { fontSize: 10, color: colors.mint, fontFamily: "Outfit_700Bold", marginTop: 4, fontStyle: "italic" },
  flyChip: {
    position: "absolute",
    top: -8,
    width: 14,
    height: 14,
    borderRadius: 7,
    backgroundColor: colors.chipRed,
    borderWidth: 2,
    borderColor: colors.chipBorder,
    borderStyle: "dashed",
  },

  centerArea: { alignItems: "center", marginTop: 14 },
  potPill: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    backgroundColor: "rgba(10,15,12,0.55)",
    borderWidth: 1.5,
    borderColor: colors.gold,
    borderRadius: 999,
    paddingVertical: 6,
    paddingHorizontal: 16,
  },
  potLabel: { fontSize: 10, fontFamily: "Outfit_900Black", color: colors.gold2, letterSpacing: 1.4 },
  potNum: { fontSize: 17, fontFamily: "Outfit_900Black", color: colors.gold2 },
  boardRow: { flexDirection: "row", gap: 6, justifyContent: "center", marginTop: 10 },
  boardSlot: {
    width: 50,
    height: 70,
    borderRadius: 8,
    borderWidth: 1.5,
    borderStyle: "dashed",
    borderColor: "rgba(198,238,199,0.18)",
    backgroundColor: "rgba(198,238,199,0.03)",
  },
  heroHandName: { marginTop: 8, fontSize: 12.5, color: colors.mint, fontFamily: "Outfit_800ExtraBold" },
  oddsPill: {
    marginTop: 8,
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    backgroundColor: "rgba(10,15,12,0.55)",
    borderWidth: 1,
    borderColor: colors.lineStrong,
    borderRadius: 999,
    paddingVertical: 6,
    paddingHorizontal: 14,
  },
  oddsLabel: { fontSize: 9.5, fontFamily: "Outfit_900Black", color: colors.dim, letterSpacing: 1.2 },
  oddsNum: { fontSize: 18, fontFamily: "Outfit_900Black" },
  oddsGood: { color: colors.good },
  oddsMid: { color: colors.gold2 },
  oddsBad: { color: colors.red },
  oddsDetail: { fontSize: 10, color: colors.muted, fontFamily: "Outfit_600SemiBold" },
  flyChipHero: { top: 40 },

  heroArea: { alignItems: "center", marginTop: 14 },
  heroCard: {
    alignItems: "center",
    backgroundColor: colors.surface2,
    borderWidth: 2,
    borderColor: colors.line,
    borderRadius: 20,
    paddingVertical: 14,
    paddingHorizontal: 22,
    minWidth: 220,
  },
  heroCardActive: { borderColor: colors.mint, backgroundColor: "rgba(198,238,199,0.08)" },
  heroCardFolded: { opacity: 0.5 },
  heroCardWin: { borderColor: colors.good, backgroundColor: "rgba(67,209,124,0.12)" },
  heroCardLoss: { borderColor: colors.red, backgroundColor: "rgba(228,87,61,0.12)" },
  heroHead: { flexDirection: "row", alignItems: "center", gap: 8 },
  heroEmoji: { fontSize: 22 },
  heroName: { fontSize: 15, fontFamily: "Outfit_900Black", color: colors.cream },
  heroStackRow: { flexDirection: "row", alignItems: "center", gap: 5, marginLeft: 4 },
  heroStack: { fontSize: 14, fontFamily: "Outfit_900Black", color: colors.chipText },
  heroHole: { flexDirection: "row", gap: 8, marginVertical: 10 },
  holeSlot: {
    width: 64,
    height: 90,
    borderRadius: 10,
    borderWidth: 2,
    borderStyle: "dashed",
    borderColor: "rgba(198,238,199,0.25)",
  },
  heroBetPill: {
    marginTop: 4,
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
    backgroundColor: "rgba(216,73,58,0.18)",
    borderWidth: 1,
    borderColor: "rgba(216,73,58,0.4)",
    borderRadius: 999,
    paddingVertical: 4,
    paddingHorizontal: 10,
  },
  heroBetText: { fontSize: 11, fontFamily: "Outfit_800ExtraBold", color: colors.chipText },

  actionWrap: { paddingHorizontal: 14, marginTop: 12 },
  betSizeRow: { flexDirection: "row", gap: 6, justifyContent: "center" },
  presetBtn: {
    flex: 1,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.lineStrong,
    borderRadius: 10,
    paddingVertical: 8,
    alignItems: "center",
  },
  presetText: { color: colors.mint, fontFamily: "Outfit_800ExtraBold", fontSize: 12 },
  allinBtn: {
    flex: 1.2,
    backgroundColor: "rgba(228,87,61,0.15)",
    borderWidth: 1,
    borderColor: "rgba(228,87,61,0.45)",
    borderRadius: 10,
    paddingVertical: 8,
    alignItems: "center",
  },
  allinBtnText: { color: colors.red, fontFamily: "Outfit_900Black", fontSize: 12, letterSpacing: 0.5 },
  raiseRow: { flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 14, marginTop: 10 },
  raiseAdj: {
    width: 38,
    height: 38,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: colors.line,
    backgroundColor: colors.surface,
    alignItems: "center",
    justifyContent: "center",
  },
  raiseAdjText: { color: colors.mint, fontFamily: "Outfit_900Black", fontSize: 18 },
  raiseSize: { fontSize: 20, fontFamily: "Outfit_900Black", color: colors.cream, minWidth: 70, textAlign: "center" },
  actionBar: {
    flexDirection: "row",
    gap: 8,
    marginTop: 10,
  },
  actBtn: {
    flex: 1,
    backgroundColor: colors.surface,
    borderWidth: 1.5,
    borderColor: colors.lineStrong,
    borderRadius: 14,
    paddingVertical: 14,
    alignItems: "center",
  },
  actBtnText: { color: colors.mint, fontFamily: "Outfit_900Black", fontSize: 15 },
  actBtnFold: {
    flex: 1,
    backgroundColor: "rgba(228,87,61,0.12)",
    borderWidth: 1.5,
    borderColor: "rgba(228,87,61,0.4)",
    borderRadius: 14,
    paddingVertical: 14,
    alignItems: "center",
  },
  actBtnFoldText: { color: colors.red, fontFamily: "Outfit_900Black", fontSize: 15 },
  actBtnRaise: {
    flex: 1.4,
    backgroundColor: colors.mint,
    borderRadius: 14,
    paddingVertical: 14,
    alignItems: "center",
    shadowColor: colors.mintDeep,
    shadowOpacity: 1,
    shadowRadius: 0,
    shadowOffset: { width: 0, height: 4 },
    elevation: 4,
  },
  actBtnRaiseText: { color: colors.mintInk, fontFamily: "Outfit_900Black", fontSize: 15 },
  actionBarWaiting: {
    paddingHorizontal: 16,
    marginTop: 14,
    alignItems: "center",
    paddingVertical: 14,
  },
  waitingText: { color: colors.dim, fontFamily: "Outfit_700Bold", fontSize: 13 },

  showdownSheet: {
    marginHorizontal: 16,
    marginTop: 12,
    padding: 18,
    borderRadius: 20,
    backgroundColor: colors.surface2,
    borderWidth: 1.5,
    borderColor: colors.gold,
    alignItems: "center",
  },
  showdownTitle: { fontSize: 12, fontFamily: "Outfit_900Black", color: colors.gold, letterSpacing: 1.5 },
  showdownWinner: { fontSize: 22, fontFamily: "Outfit_900Black", color: colors.mint2, marginTop: 4 },
  showdownHand: { fontSize: 13, fontFamily: "Outfit_700Bold", color: colors.muted, marginTop: 4 },
  showdownEvals: { alignSelf: "stretch", marginTop: 12 },
  showdownRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    paddingVertical: 6,
    borderBottomWidth: 1,
    borderStyle: "dashed",
    borderBottomColor: colors.line,
  },
  showdownName: { color: colors.cream, fontFamily: "Outfit_700Bold", fontSize: 13 },
  showdownEvalHand: { color: colors.muted, fontFamily: "Outfit_600SemiBold", fontSize: 13 },

  logScroll: { flex: 1, paddingHorizontal: 16, marginTop: 8 },
  logLine: { fontSize: 12, fontFamily: "Outfit_500Medium", color: colors.muted, paddingVertical: 1.5 },
  logGood: { color: colors.good },
  logBad: { color: colors.red },
  logDim: { color: colors.dim },
});
