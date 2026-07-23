import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  Animated,
  Dimensions,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useRouter } from "expo-router";
import { Users2, UserPlus, Crown, Wifi } from "lucide-react-native";

import ChipIcon from "@/components/ChipIcon";
import PlayingCard from "@/components/PlayingCard";
import PressButton from "@/components/PressButton";
import colors from "@/constants/colors";
import {
  Card,
  cardKey,
  compareEval,
  evaluate,
  myOdds,
  OddsResult,
  whoWon,
} from "@/lib/poker";
import { Friend, TableConfig, useGame } from "@/providers/GameProvider";

/**
 * The Table — Texas Hold'em poker room.
 * Real poker app feel: oval felt, positioned seats, deal animation,
 * game lobby with player count + friend invites, full streets.
 */

const SCREEN_W = Dimensions.get("window").width;
const SCREEN_H = Dimensions.get("window").height;

const BUY_IN_OPTIONS = [100, 200, 500, 1000];
const BLINDS: Record<number, [number, number]> = {
  100: [2, 5],
  200: [5, 10],
  500: [10, 25],
  1000: [25, 50],
};
const START_STACK_MULT = 5; // buy-in * 5 = starting stack
const MAX_SEATS = 9;

type Street = "preflop" | "flop" | "turn" | "river" | "showdown" | "done";

interface Player {
  id: string;
  name: string;
  emoji: string;
  isHero: boolean;
  isFriend: boolean;
  isAI: boolean;
  hole: Card[];
  stack: number;
  folded: boolean;
  bet: number;
  totalCommitted: number;
  hasActed: boolean;
  allIn: boolean;
  revealed: boolean;
  sittingOut: boolean;
}

interface LogEntry {
  text: string;
  tone: "neutral" | "good" | "bad" | "dim";
}

interface ChipFly {
  id: number;
  fromSeat: number;
  toPot: boolean;
}

const SUITS = ["\u2660", "\u2665", "\u2666", "\u2663"];

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

/** Build a fresh shuffled deck minus the dealt cards. */
function freshDeck(used: Set<number>): Card[] {
  const deck: Card[] = [];
  for (let r = 2; r <= 14; r++) {
    for (let s = 0; s < 4; s++) {
      const k = r * 4 + s;
      if (!used.has(k)) deck.push({ r, s });
    }
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
  bb: number,
): AiDecision {
  const eq = aiEquity(hole, board, 1, 180);
  const potOdds = toCall / (pot + toCall + 0.0001);
  const bluffRoll = Math.random();
  if (eq < 0.25 && toCall > 0 && bluffRoll > 0.92 && stack > toCall * 3) {
    return { action: "raise", amount: Math.min(stack, Math.max(toCall + bb, Math.round(pot * 0.6))) };
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

/** Seat positions around an oval table — hero always at bottom center. */
function getSeatPositions(count: number): { x: number; y: number }[] {
  // Table dimensions (relative to the felt area)
  const tableW = SCREEN_W - 24;
  const tableH = Math.min(SCREEN_H * 0.46, 380);
  const cx = tableW / 2;
  const cy = tableH / 2;
  const rx = tableW * 0.42;
  const ry = tableH * 0.38;

  const positions: { x: number; y: number }[] = [];
  for (let i = 0; i < count; i++) {
    // Hero is always at the bottom (angle = PI/2)
    // Other seats distributed around the oval
    const heroIdx = count - 1; // hero is last index
    const angleOffset = Math.PI / 2; // bottom
    const angle = angleOffset + (i * 2 * Math.PI) / count;

    // For the hero seat, force it to bottom center
    if (i === heroIdx) {
      positions.push({ x: cx, y: cy + ry + 8 });
    } else {
      const x = cx + rx * Math.cos(angle);
      const y = cy + ry * Math.sin(angle);
      positions.push({ x, y });
    }
  }
  return positions;
}

const AI_NAMES = ["Dev", "Tori", "Mike", "Brandon", "Sam", "Riley", "Ace", "Viv"];
const AI_EMOJIS = ["\u{1F9E2}", "\u{1F33A}", "\u{1F3A7}", "\u{1F3C8}", "\u{1F3AF}", "\u{1F3B2}", "\u{1F5E1}\uFE0F", "\u{1F425}"];

export default function TableScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const {
    chips,
    payChips,
    recordBiggestPot,
    friends,
    invitedToTable,
    toggleInviteFriend,
    startTableGame,
    clearTableGame,
    tableConfig,
    addFriend,
  } = useGame();

  // ---- Lobby state ----
  const [lobbyOpen, setLobbyOpen] = useState<boolean>(true);
  const [selectedPlayerCount, setSelectedPlayerCount] = useState<number>(3);
  const [selectedBuyIn, setSelectedBuyIn] = useState<number>(200);
  const [inviteSheet, setInviteSheet] = useState<boolean>(false);
  const [addFriendSheet, setAddFriendSheet] = useState<boolean>(false);
  const [friendHandle, setFriendHandle] = useState<string>("");

  // ---- Game state ----
  const [phase, setPhase] = useState<"buyin" | "playing" | "felted" | "cashedout">("buyin");
  const [players, setPlayers] = useState<Player[]>([]);
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
  const [betSize, setBetSize] = useState<number>(20);
  const [chipFlies, setChipFlies] = useState<ChipFly[]>([]);
  const [stackFlash, setStackFlash] = useState<"win" | "loss" | null>(null);
  const [aiThinking, setAiThinking] = useState<boolean>(false);
  const [dealing, setDealing] = useState<boolean>(false);

  const deckRef = useRef<Card[]>([]);
  const usedRef = useRef<Set<number>>(new Set());
  const aiTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const chipIdRef = useRef<number>(0);

  const hero = players.find((p) => p.isHero);
  const heroIdx = players.findIndex((p) => p.isHero);
  const sb = BLINDS[selectedBuyIn][0];
  const bb = BLINDS[selectedBuyIn][1];

  const addLog = useCallback((text: string, tone: LogEntry["tone"] = "neutral") => {
    setLog((prev) => [...prev.slice(-30), { text, tone }]);
  }, []);

  const flyChips = useCallback((fromSeat: number) => {
    chipIdRef.current += 1;
    const id = chipIdRef.current;
    setChipFlies((prev) => [...prev, { id, fromSeat, toPot: true }]);
    setTimeout(() => setChipFlies((prev) => prev.filter((c) => c.id !== id)), 650);
  }, []);

  // ---- Lobby: create the game ----
  const createGame = useCallback(() => {
    if (chips < selectedBuyIn) return;

    const invitedIds = Array.from(invitedToTable);
    const invitedFriends = friends.filter((f) => invitedIds.includes(f.id));
    const friendCount = invitedFriends.length;
    const aiCount = selectedPlayerCount - 1 - friendCount;
    const startStack = selectedBuyIn * START_STACK_MULT;

    const newPlayers: Player[] = [];

    // Add friends first
    invitedFriends.forEach((f) => {
      newPlayers.push({
        id: f.id,
        name: f.name,
        emoji: f.avatar,
        isHero: false,
        isFriend: true,
        isAI: false,
        hole: [],
        stack: startStack,
        folded: false,
        bet: 0,
        totalCommitted: 0,
        hasActed: false,
        allIn: false,
        revealed: false,
        sittingOut: false,
      });
    });

    // Fill remaining with AI
    for (let i = 0; i < aiCount; i++) {
      newPlayers.push({
        id: `ai_${i}`,
        name: AI_NAMES[i % AI_NAMES.length],
        emoji: AI_EMOJIS[i % AI_EMOJIS.length],
        isHero: false,
        isFriend: false,
        isAI: true,
        hole: [],
        stack: startStack,
        folded: false,
        bet: 0,
        totalCommitted: 0,
        hasActed: false,
        allIn: false,
        revealed: false,
        sittingOut: false,
      });
    }

    // Hero at the end (bottom seat)
    newPlayers.push({
      id: "hero",
      name: "You",
      emoji: "\u{1F99B}",
      isHero: true,
      isFriend: false,
      isAI: false,
      hole: [],
      stack: startStack,
      folded: false,
      bet: 0,
      totalCommitted: 0,
      hasActed: false,
      allIn: false,
      revealed: false,
      sittingOut: false,
    });

    const config: TableConfig = {
      maxPlayers: selectedPlayerCount,
      buyIn: selectedBuyIn,
      smallBlind: sb,
      bigBlind: bb,
      invitedFriendIds: invitedIds,
    };
    startTableGame(config);
    payChips(-selectedBuyIn, true);

    setPlayers(newPlayers);
    setPhase("playing");
    setLobbyOpen(false);
    setHandsPlayed(0);
    setBiggestPot(0);
    setDealerIdx(0);
    addLog(`Game started! ${selectedPlayerCount} players, buy-in ${selectedBuyIn}, blinds ${sb}/${bb}.`, "neutral");
  }, [chips, selectedBuyIn, selectedPlayerCount, friends, invitedToTable, sb, bb, payChips, startTableGame, addLog]);

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

    const reset: Player[] = livePlayers.map((p) => ({
      ...p,
      hole: [deck.pop()!, deck.pop()!],
      folded: false,
      bet: 0,
      totalCommitted: 0,
      hasActed: false,
      allIn: p.stack <= 0,
      revealed: false,
    }));

    // If players dropped below original count, pad with AI to maintain seat count
    while (reset.length < selectedPlayerCount) {
      const idx = reset.length;
      reset.push({
        id: `ai_pad_${idx}`,
        name: AI_NAMES[idx % AI_NAMES.length],
        emoji: AI_EMOJIS[idx % AI_EMOJIS.length],
        isHero: false,
        isFriend: false,
        isAI: true,
        hole: [deck.pop()!, deck.pop()!],
        stack: selectedBuyIn * START_STACK_MULT,
        folded: false,
        bet: 0,
        totalCommitted: 0,
        hasActed: false,
        allIn: false,
        revealed: false,
        sittingOut: false,
      });
    }
    setPlayers(reset);

    const n = reset.length;
    const dIdx = dealerIdx % n;
    const sbIdx = (dIdx + 1) % n;
    const bbIdx = (dIdx + 2) % n;

    const postBlind = (arr: Player[], i: number, amt: number) => {
      const a = Math.min(amt, arr[i].stack);
      arr[i].stack -= a;
      arr[i].bet = a;
      arr[i].totalCommitted = a;
      if (arr[i].stack === 0) arr[i].allIn = true;
    };
    postBlind(reset, sbIdx, sb);
    postBlind(reset, bbIdx, bb);

    setPlayers([...reset]);
    setBoard([]);
    setStreet("preflop");
    setShowdown(null);
    setPot(sb + bb);
    setToCall(bb);
    setBetSize(bb * 2);
    setDealerIdx(dIdx);
    setActionIdx(sbIdx);
    setLog([]);
    addLog(`New hand. ${reset[dIdx].name} has the button. Blinds ${sb}/${bb}.`, "neutral");

    // Deal animation
    setDealing(true);
    setTimeout(() => setDealing(false), 800);
  }, [players, dealerIdx, selectedPlayerCount, selectedBuyIn, sb, bb, addLog]);

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
    (curPlayers: Player[], fromIdx: number): number => {
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
    (curPlayers: Player[]): boolean => {
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
    (curPlayers: Player[], curBoard: Card[]) => {
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
        return;
      }
      if (curBoard.length === 3) {
        const turn = deal(1);
        const nb = [...curBoard, ...turn];
        setBoard(nb);
        setStreet("turn");
        addLog(`Turn: ${cardStr(turn[0])}`, "neutral");
        return;
      }
      if (curBoard.length === 4) {
        const river = deal(1);
        const nb = [...curBoard, ...river];
        setBoard(nb);
        setStreet("river");
        addLog(`River: ${cardStr(river[0])}`, "neutral");
        return;
      }
      setStreet("showdown");
    },
    [addLog],
  );

  const settleHand = useCallback(
    (curPlayers: Player[], curBoard: Card[], curPot: number) => {
      const live = curPlayers.filter((p) => !p.folded);
      if (live.length === 1) {
        const winner = live[0];
        setPlayers((prev) => prev.map((p) => (p.id === winner.id ? { ...p, stack: p.stack + curPot } : p)));
        addLog(`${winner.name} wins ${curPot} chips uncontested.`, winner.isHero ? "good" : "neutral");
        setPot(0);
        setStreet("done");
        if (winner.isHero) {
          setBiggestPot((b) => Math.max(b, curPot));
          recordBiggestPot(curPot);
          setStackFlash("win");
        } else {
          setStackFlash("loss");
        }
        setTimeout(() => setStackFlash(null), 900);
        return;
      }
      // Showdown — reveal all live hands
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
    (curPlayers: Player[], curBoard: Card[], curPot: number, curStreet: Street) => {
      const live = curPlayers.filter((p) => !p.folded);
      if (live.length === 1) {
        settleHand(curPlayers, curBoard, curPot);
        return;
      }
      if (roundComplete(curPlayers)) {
        if (curBoard.length === 5) {
          settleHand(curPlayers, curBoard, curPot);
        } else {
          advanceStreet(curPlayers, curBoard);
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
        flyChips(heroIdx);
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
        flyChips(heroIdx);
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
    if (!ai || ai.isHero || ai.folded || ai.allIn) {
      const next = nextAction(curPlayers, actionIdx);
      if (next === -1) { settleHand(curPlayers, board, pot); return; }
      setActionIdx(next);
      return;
    }
    const maxBet = Math.max(...curPlayers.filter((p) => !p.folded).map((p) => p.bet));
    const owe = maxBet - ai.bet;
    const dec = aiDecide(ai.hole, board, owe, pot, ai.stack, ai.name === "Dev" ? 0.5 : 0.3, bb);

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
      flyChips(actionIdx);
    } else if (dec.action === "raise") {
      const target = Math.max(maxBet + bb, dec.amount ?? maxBet * 2);
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
      setBetSize(Math.max(bb * 2, ai.bet * 2));
      flyChips(actionIdx);
    }
    setPlayers(curPlayers);
    setAiThinking(false);
    progress(curPlayers, board, pot, street);
  }, [players, actionIdx, board, pot, street, bb, addLog, nextAction, settleHand, progress, flyChips]);

  // Drive AI turns
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
    const delay = 1200 + Math.random() * 600;
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
    const cashout = heroStack - selectedBuyIn;
    if (heroStack > 0) payChips(heroStack, true);
    addLog(`Left the table. ${heroStack > 0 ? `Cashed out ${heroStack} (${cashout >= 0 ? "+" : ""}${cashout}).` : "Felted."}`, heroStack > selectedBuyIn ? "good" : "bad");
    clearTableGame();
    router.back();
  }, [hero, payChips, addLog, router, selectedBuyIn, clearTableGame]);

  const liveOppCount = players.filter((p) => !p.isHero && !p.folded).length;
  const heroEval = useMemo(() => (hero && hero.hole.length === 2 && board.length >= 3 ? evaluate([...hero.hole, ...board]) : null), [hero, board]);

  const seatPositions = useMemo(() => getSeatPositions(players.length || selectedPlayerCount), [players.length, selectedPlayerCount]);

  const handleAddFriend = useCallback(() => {
    const clean = friendHandle.trim().replace(/^@/, "");
    if (!clean) return;
    addFriend(clean);
    setFriendHandle("");
    setAddFriendSheet(false);
  }, [friendHandle, addFriend]);

  // ============ LOBBY SCREEN ============
  if (lobbyOpen) {
    const invitedFriends = friends.filter((f) => invitedToTable.has(f.id));
    const onlineFriends = friends.filter((f) => f.online);

    return (
      <View style={[styles.screen, { paddingTop: insets.top }]}>
        <View style={styles.lobbyHeader}>
          <Pressable onPress={() => router.back()} hitSlop={10}>
            <Text style={styles.backBtn}>{"\u2039"} Back</Text>
          </Pressable>
          <Text style={styles.lobbyTitle}>Poker Room</Text>
          <View style={{ width: 50 }} />
        </View>

        <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: 40 }}>
          {/* Hero section */}
          <View style={styles.lobbyHero}>
            <Text style={styles.lobbyEmoji}>{"\u2660\uFE0F\u2665\uFE0F\u2666\uFE0F\u2663\uFE0F"}</Text>
            <Text style={styles.lobbyTitle2}>Set Up Your Game</Text>
            <Text style={styles.lobbySub}>Pick your table size, invite friends, and sit down</Text>
          </View>

          {/* Player count selector */}
          <View style={styles.lobbySection}>
            <Text style={styles.lobbySectionTitle}>
              <Users2 size={16} color={colors.mint} />  Table Size
            </Text>
            <View style={styles.playerCountRow}>
              {[2, 3, 4, 6, 9].map((n) => (
                <Pressable
                  key={n}
                  style={[styles.countChip, selectedPlayerCount === n && styles.countChipActive]}
                  onPress={() => setSelectedPlayerCount(n)}
                >
                  <Text style={[styles.countChipText, selectedPlayerCount === n && styles.countChipTextActive]}>
                    {n}
                  </Text>
                  <Text style={[styles.countChipLabel, selectedPlayerCount === n && styles.countChipLabelActive]}>
                    {n === 2 ? "H-U" : n === 9 ? "MAX" : `${n} seats`}
                  </Text>
                </Pressable>
              ))}
            </View>
          </View>

          {/* Buy-in selector */}
          <View style={styles.lobbySection}>
            <Text style={styles.lobbySectionTitle}>
              <ChipIcon size={16} />  Buy-In
            </Text>
            <View style={styles.buyInRow}>
              {BUY_IN_OPTIONS.map((b) => (
                <Pressable
                  key={b}
                  style={[styles.buyInChip, selectedBuyIn === b && styles.buyInChipActive]}
                  onPress={() => setSelectedBuyIn(b)}
                  disabled={b > chips}
                >
                  <Text style={[styles.buyInChipText, selectedBuyIn === b && styles.buyInChipTextActive]}>
                    {b}
                  </Text>
                  <Text style={[styles.buyInChipBlinds, selectedBuyIn === b && styles.buyInChipBlindsActive]}>
                    {BLINDS[b][0]}/{BLINDS[b][1]}
                  </Text>
                </Pressable>
              ))}
            </View>
            <Text style={styles.buyInHint}>Starting stack: {selectedBuyIn * START_STACK_MULT} chips</Text>
          </View>

          {/* Invited friends */}
          <View style={styles.lobbySection}>
            <View style={styles.sectionHeaderRow}>
              <Text style={styles.lobbySectionTitle}>
                <Users2 size={16} color={colors.mint} />  At the Table ({invitedFriends.length})
              </Text>
              <Pressable style={styles.inviteBtn} onPress={() => setInviteSheet(true)}>
                <UserPlus size={14} color={colors.mint} />
                <Text style={styles.inviteBtnText}>Invite</Text>
              </Pressable>
            </View>

            {invitedFriends.length === 0 ? (
              <View style={styles.emptyFriends}>
                <Text style={styles.emptyFriendsText}>No friends invited yet. Tap "Invite" to add them.</Text>
              </View>
            ) : (
              <View style={styles.invitedList}>
                {invitedFriends.map((f) => (
                  <View key={f.id} style={styles.invitedRow}>
                    <View style={styles.invitedAvatar}>
                      <Text style={styles.invitedAvatarText}>{f.avatar}</Text>
                    </View>
                    <View style={{ flex: 1 }}>
                      <Text style={styles.invitedName}>{f.name}</Text>
                      <Text style={styles.invitedStatus}>
                        {f.online ? "\u{1F7E2} Online" : "\u26AA Offline"} {" \u00b7 "} <ChipIcon size={8} /> {f.chips.toLocaleString()}
                      </Text>
                    </View>
                    <Pressable style={styles.removeInviteBtn} onPress={() => toggleInviteFriend(f.id)}>
                      <Text style={styles.removeInviteText}>{"\u2715"}</Text>
                    </Pressable>
                  </View>
                ))}
              </View>
            )}

            {/* AI fill info */}
            {invitedFriends.length < selectedPlayerCount - 1 && (
              <View style={styles.aiFillBox}>
                <Text style={styles.aiFillText}>
                  {"\u{1F9E0}"} {selectedPlayerCount - 1 - invitedFriends.length} AI player{selectedPlayerCount - 1 - invitedFriends.length > 1 ? "s" : ""} will fill the remaining seat{selectedPlayerCount - 1 - invitedFriends.length > 1 ? "s" : ""}
                </Text>
              </View>
            )}
          </View>

          {/* Bankroll display */}
          <View style={styles.bankrollBox}>
            <Text style={styles.bankrollLabel}>YOUR BANKROLL</Text>
            <View style={styles.bankrollRow2}>
              <ChipIcon size={18} />
              <Text style={styles.bankrollNum}>{chips.toLocaleString()}</Text>
            </View>
            {chips < selectedBuyIn && (
              <Text style={styles.bankrollWarn}>Need {selectedBuyIn} chips to sit down. Hit the Arena to earn some.</Text>
            )}
          </View>

          {/* Start button */}
          <View style={styles.lobbyCtaWrap}>
            <PressButton
              label={`Sit down  ${"\u2192"}`}
              onPress={createGame}
              disabled={chips < selectedBuyIn}
              style={styles.lobbyCta}
            />
          </View>
        </ScrollView>

        {/* Invite friends sheet */}
        {inviteSheet && (
          <View style={styles.promptWrap}>
            <Pressable style={styles.backdrop} onPress={() => setInviteSheet(false)} />
            <View style={styles.sheet}>
              <View style={styles.sheetHeader}>
                <Text style={styles.sheetEmoji2}>{"\u{1F91D}"}</Text>
                <Text style={styles.sheetTitle}>Invite Friends</Text>
                <Pressable style={styles.sheetClose} onPress={() => setInviteSheet(false)}>
                  <Text style={styles.sheetCloseText}>{"\u2715"}</Text>
                </Pressable>
              </View>
              <Text style={styles.sheetCopy}>
                Tap friends to invite them to your game. Online friends can join right away.
              </Text>

              <ScrollView style={{ maxHeight: 320 }} showsVerticalScrollIndicator={false}>
                {friends.map((f) => {
                  const invited = invitedToTable.has(f.id);
                  const canInvite = invitedFriends.length < selectedPlayerCount - 1;
                  return (
                    <Pressable
                      key={f.id}
                      style={[styles.friendRow, invited && styles.friendRowInvited]}
                      onPress={() => toggleInviteFriend(f.id)}
                      disabled={!invited && !canInvite}
                    >
                      <View style={styles.friendAvatar}>
                        <Text style={styles.friendAvatarText}>{f.avatar}</Text>
                      </View>
                      <View style={{ flex: 1 }}>
                        <Text style={styles.friendName}>{f.name}</Text>
                        <Text style={styles.friendStatus}>
                          {f.online ? "\u{1F7E2} Online" : "\u26AA Offline"} {" \u00b7 "} <ChipIcon size={8} /> {f.chips.toLocaleString()}
                        </Text>
                      </View>
                      {invited ? (
                        <View style={styles.invitedBadge}>
                          <Text style={styles.invitedBadgeText}>{"\u2713"} Invited</Text>
                        </View>
                      ) : (
                        <View style={[styles.inviteBadge, !canInvite && styles.inviteBadgeDisabled]}>
                          <Text style={styles.inviteBadgeText}>{canInvite ? "+ Invite" : "Full"}</Text>
                        </View>
                      )}
                    </Pressable>
                  );
                })}
              </ScrollView>

              <Pressable style={styles.addFriendLink} onPress={() => { setInviteSheet(false); setAddFriendSheet(true); }}>
                <UserPlus size={14} color={colors.mint} />
                <Text style={styles.addFriendLinkText}>Add a new friend</Text>
              </Pressable>
            </View>
          </View>
        )}

        {/* Add friend sheet */}
        {addFriendSheet && (
          <View style={styles.promptWrap}>
            <Pressable style={styles.backdrop} onPress={() => setAddFriendSheet(false)} />
            <View style={styles.sheet}>
              <Text style={styles.sheetEmoji2}>{"\u{1F44B}"}</Text>
              <Text style={styles.sheetTitle}>Add a Friend</Text>
              <Text style={styles.sheetCopy}>
                Enter their ChipIn username. When they accept, they'll appear in your friends list and you can invite them to games.
              </Text>
              <View style={styles.inputWrap}>
                <Text style={styles.inputPrefix}>@</Text>
                <TextInput
                  style={styles.textInput}
                  placeholder="username"
                  placeholderTextColor={colors.dim}
                  value={friendHandle}
                  onChangeText={setFriendHandle}
                  autoCapitalize="none"
                  autoCorrect={false}
                  returnKeyType="send"
                  onSubmitEditing={handleAddFriend}
                />
              </View>
              <PressButton label="Send request" onPress={handleAddFriend} />
              <PressButton label="Cancel" variant="ghost" onPress={() => setAddFriendSheet(false)} />
            </View>
          </View>
        )}
      </View>
    );
  }

  // ============ FELTED / CASHED OUT ============
  if (phase === "felted" || phase === "cashedout") {
    const stack = hero?.stack ?? 0;
    const profit = stack - selectedBuyIn;
    return (
      <View style={[styles.screen, { paddingTop: insets.top }]}>
        <View style={styles.buyinWrap}>
          <Text style={styles.feltEmoji}>{phase === "felted" ? "\u{1F480}" : "\u{1F3C1}"}</Text>
          <Text style={styles.feltTitle}>{phase === "felted" ? "Felted." : "Cashed out."}</Text>
          <Text style={styles.feltSub}>
            {phase === "felted"
              ? "You lost your stack. Run it back when you're ready."
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
            <PressButton label="Back to Learn" onPress={() => router.push("/")} />
          ) : (
            <PressButton label="Leave the table" onPress={() => { clearTableGame(); router.back(); }} />
          )}
        </View>
      </View>
    );
  }

  // ============ PLAYING ============
  const heroOwe = (() => {
    if (!hero || hero.folded) return 0;
    const maxBet = Math.max(...players.filter((p) => !p.folded).map((p) => p.bet));
    return Math.max(0, maxBet - hero.bet);
  })();
  const heroStack = hero?.stack ?? 0;
  const potBet = Math.max(bb, pot);
  const halfPot = Math.max(bb, Math.round(pot / 2));
  const threeQuarterPot = Math.max(bb, Math.round(pot * 0.75));
  const minRaise = Math.max(bb, (players.filter((p) => !p.folded).reduce((m, p) => Math.max(m, p.bet), 0)) + bb);

  const tableW = SCREEN_W - 24;
  const tableH = Math.min(SCREEN_H * 0.46, 380);

  return (
    <View style={[styles.screen, { paddingTop: insets.top }]}>
      {/* Top bar */}
      <View style={styles.tableHeader}>
        <Pressable onPress={leaveTable} hitSlop={10}>
          <Text style={styles.leaveBtn}>{"\u2039"} Leave</Text>
        </Pressable>
        <View style={styles.streetPill}>
          <Text style={styles.streetText}>{street === "showdown" ? "SHOWDOWN" : street.toUpperCase()}</Text>
        </View>
        <View style={styles.handPill}>
          <Text style={styles.handPillText}>H#{handsPlayed}</Text>
        </View>
      </View>

      {/* Oval felt table with positioned seats */}
      <View style={styles.feltContainer}>
        <View style={[styles.ovalFelt, { width: tableW, height: tableH }]}>
          {/* Felt inner ring */}
          <View style={[styles.feltInnerRing, { width: tableW * 0.86, height: tableH * 0.8 }]} />

          {/* Center: pot + board */}
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
                <Text style={styles.oddsLabel}>WIN %</Text>
                <Text style={[styles.oddsNum, odds.winPct >= 50 ? styles.oddsGood : odds.winPct >= 30 ? styles.oddsMid : styles.oddsBad]}>
                  {odds.winPct.toFixed(0)}%
                </Text>
                <Text style={styles.oddsDetail}>vs {liveOppCount}</Text>
              </View>
            )}
          </View>

          {/* Seats positioned around the table */}
          {players.map((p, i) => {
            const pos = seatPositions[i];
            if (!pos) return null;
            const isActive = actionIdx === i && !p.folded && street !== "showdown" && street !== "done";
            const isDealer = dealerIdx === i;
            const isHeroSeat = p.isHero;
            const showCards = (street === "showdown" || p.allIn || p.revealed || p.isHero) && p.hole.length === 2;

            return (
              <View
                key={p.id + i}
                style={[
                  styles.seatContainer,
                  {
                    left: pos.x - 55,
                    top: Math.max(0, pos.y - (isHeroSeat ? 50 : 40)),
                  },
                ]}
              >
                {/* Card backs / cards above the seat */}
                {p.hole.length === 2 && !p.folded && (
                  <View style={[styles.seatCards, isHeroSeat && styles.seatCardsHero]}>
                    {showCards
                      ? p.hole.map((c, ci) => (
                          <PlayingCard
                            key={ci}
                            card={c}
                            size={isHeroSeat ? "mini" : "tiny"}
                            highlighted={street === "showdown" && showdown?.winners.includes(p.name)}
                          />
                        ))
                      : (
                        <>
                          <View style={[styles.cardBack2, isHeroSeat && styles.cardBackHero]} />
                          <View style={[styles.cardBack2, isHeroSeat && styles.cardBackHero]} />
                        </>
                      )}
                  </View>
                )}

                {/* Seat avatar box */}
                <View
                  style={[
                    styles.seatBox,
                    isActive && styles.seatBoxActive,
                    p.folded && styles.seatBoxFolded,
                    isHeroSeat && styles.seatBoxHero,
                    stackFlash === "win" && isHeroSeat && styles.seatBoxWin,
                    stackFlash === "loss" && isHeroSeat && styles.seatBoxLoss,
                  ]}
                >
                  <Text style={styles.seatEmoji}>{p.emoji}</Text>
                  <Text style={styles.seatName} numberOfLines={1}>{p.name}</Text>
                  <View style={styles.seatStackRow}>
                    <ChipIcon size={8} />
                    <Text style={styles.seatStackNum}>{p.stack}</Text>
                  </View>
                  {/* Type badge */}
                  {p.isFriend && (
                    <View style={styles.friendBadge}>
                      <Wifi size={7} color={colors.mint} />
                      <Text style={styles.friendBadgeText}>FRIEND</Text>
                    </View>
                  )}
                  {p.isAI && (
                    <View style={styles.aiBadge}>
                      <Text style={styles.aiBadgeText}>AI</Text>
                    </View>
                  )}
                  {/* Dealer button */}
                  {isDealer && (
                    <View style={styles.dealerBtn}>
                      <Text style={styles.dealerBtnText}>D</Text>
                    </View>
                  )}
                  {/* Bet pill */}
                  {p.bet > 0 && (
                    <View style={styles.seatBetPill}>
                      <ChipIcon size={7} />
                      <Text style={styles.seatBetText}>{p.bet}</Text>
                    </View>
                  )}
                  {/* Folded tag */}
                  {p.folded && <Text style={styles.seatFoldedTag}>FOLD</Text>}
                  {p.allIn && !p.folded && <Text style={styles.seatAllInTag}>ALL-IN</Text>}
                  {/* Thinking dots */}
                  {isActive && aiThinking && <ThinkingDots />}
                </View>
              </View>
            );
          })}
        </View>
      </View>

      {/* Action bar */}
      {heroTurn && !hero?.folded && street !== "showdown" && street !== "done" ? (
        <View style={styles.actionWrap}>
          <View style={styles.betSizeRow}>
            <Pressable style={styles.presetBtn} onPress={() => setBetSize(Math.max(minRaise, halfPot))}>
              <Text style={styles.presetText}>{"\u00BD"} pot</Text>
            </Pressable>
            <Pressable style={styles.presetBtn} onPress={() => setBetSize(Math.max(minRaise, threeQuarterPot))}>
              <Text style={styles.presetText}>{"\u00BE"} pot</Text>
            </Pressable>
            <Pressable style={styles.presetBtn} onPress={() => setBetSize(Math.max(minRaise, potBet))}>
              <Text style={styles.presetText}>pot</Text>
            </Pressable>
            <Pressable style={styles.allinBtn} onPress={() => setBetSize(heroStack)}>
              <Text style={styles.allinBtnText}>ALL-IN</Text>
            </Pressable>
          </View>
          <View style={styles.raiseRow}>
            <Pressable style={styles.raiseAdj} onPress={() => setBetSize((b) => Math.max(minRaise, b - bb))}>
              <Text style={styles.raiseAdjText}>{"\u2212"}</Text>
            </Pressable>
            <Text style={styles.raiseSize}>{betSize}</Text>
            <Pressable style={styles.raiseAdj} onPress={() => setBetSize((b) => Math.min(heroStack, b + bb))}>
              <Text style={styles.raiseAdjText}>+</Text>
            </Pressable>
          </View>
          <View style={styles.actionBar}>
            <Pressable style={styles.actBtnFold} onPress={() => heroAct("fold")}>
              <Text style={styles.actBtnFoldText}>Fold</Text>
            </Pressable>
            {heroOwe === 0 ? (
              <Pressable style={styles.actBtn} onPress={() => heroAct("check")}>
                <Text style={styles.actBtnText}>Check</Text>
              </Pressable>
            ) : (
              <Pressable style={styles.actBtn} onPress={() => heroAct("call")}>
                <Text style={styles.actBtnText}>Call {Math.min(heroOwe, heroStack)}</Text>
              </Pressable>
            )}
            <Pressable style={styles.actBtnRaise} onPress={() => heroAct("raise", betSize)}>
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
          <Text style={styles.showdownTitle}>{showdown.winners.length > 1 ? "CHOP POT!" : "WINNER!"}</Text>
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

      {/* Log */}
      <ScrollView style={styles.logScroll} contentContainerStyle={{ paddingVertical: 6 }}>
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

  // ---- Lobby ----
  lobbyHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 16,
    paddingTop: 10,
    paddingBottom: 6,
  },
  backBtn: { color: colors.mint, fontSize: 14, fontFamily: "Outfit_800ExtraBold" },
  lobbyTitle: { fontSize: 18, fontFamily: "Outfit_900Black", color: colors.cream, letterSpacing: -0.5 },
  lobbyHero: { alignItems: "center", paddingVertical: 20 },
  lobbyEmoji: { fontSize: 36, marginBottom: 8 },
  lobbyTitle2: { fontSize: 24, fontFamily: "Outfit_900Black", color: colors.cream, letterSpacing: -0.5 },
  lobbySub: { fontSize: 13, color: colors.muted, fontFamily: "Outfit_600SemiBold", marginTop: 4, textAlign: "center" },

  lobbySection: {
    marginHorizontal: 16,
    marginBottom: 18,
    backgroundColor: colors.surface,
    borderRadius: 20,
    padding: 16,
    borderWidth: 1,
    borderColor: colors.line,
  },
  lobbySectionTitle: {
    fontSize: 14,
    fontFamily: "Outfit_800ExtraBold",
    color: colors.cream,
    marginBottom: 12,
  },
  playerCountRow: {
    flexDirection: "row",
    gap: 8,
    flexWrap: "wrap",
  },
  countChip: {
    width: 58,
    height: 58,
    borderRadius: 16,
    backgroundColor: colors.bg2,
    borderWidth: 1.5,
    borderColor: colors.line,
    alignItems: "center",
    justifyContent: "center",
  },
  countChipActive: {
    borderColor: colors.mint,
    backgroundColor: "rgba(198,238,199,0.1)",
  },
  countChipText: { fontSize: 20, fontFamily: "Outfit_900Black", color: colors.muted },
  countChipTextActive: { color: colors.mint },
  countChipLabel: { fontSize: 9, fontFamily: "Outfit_700Bold", color: colors.dim, marginTop: 2, letterSpacing: 0.5 },
  countChipLabelActive: { color: colors.mintDeep },

  buyInRow: { flexDirection: "row", gap: 8, flexWrap: "wrap" },
  buyInChip: {
    width: 72,
    height: 62,
    borderRadius: 16,
    backgroundColor: colors.bg2,
    borderWidth: 1.5,
    borderColor: colors.line,
    alignItems: "center",
    justifyContent: "center",
  },
  buyInChipActive: { borderColor: colors.gold, backgroundColor: "rgba(233,196,100,0.1)" },
  buyInChipText: { fontSize: 18, fontFamily: "Outfit_900Black", color: colors.muted },
  buyInChipTextActive: { color: colors.gold2 },
  buyInChipBlinds: { fontSize: 10, fontFamily: "Outfit_700Bold", color: colors.dim, marginTop: 2 },
  buyInChipBlindsActive: { color: colors.goldDeep },
  buyInHint: { fontSize: 11, color: colors.dim, fontFamily: "Outfit_600SemiBold", marginTop: 10 },

  sectionHeaderRow: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginBottom: 12 },
  inviteBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
    backgroundColor: "rgba(198,238,199,0.1)",
    borderWidth: 1,
    borderColor: colors.mintDeep,
    borderRadius: 12,
    paddingVertical: 7,
    paddingHorizontal: 12,
  },
  inviteBtnText: { fontSize: 12, fontFamily: "Outfit_800ExtraBold", color: colors.mint },

  emptyFriends: {
    padding: 20,
    alignItems: "center",
    backgroundColor: colors.bg2,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: colors.line,
    borderStyle: "dashed",
  },
  emptyFriendsText: { fontSize: 13, color: colors.dim, fontFamily: "Outfit_600SemiBold", textAlign: "center" },

  invitedList: { gap: 8 },
  invitedRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    padding: 10,
    backgroundColor: colors.bg2,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: colors.line,
  },
  invitedAvatar: {
    width: 38,
    height: 38,
    borderRadius: 12,
    backgroundColor: colors.surface2,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
    borderColor: colors.line,
  },
  invitedAvatarText: { fontSize: 18 },
  invitedName: { fontSize: 14, fontFamily: "Outfit_800ExtraBold", color: colors.cream },
  invitedStatus: { fontSize: 11, color: colors.muted, fontFamily: "Outfit_600SemiBold", marginTop: 2 },
  removeInviteBtn: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: "rgba(228,87,61,0.15)",
    alignItems: "center",
    justifyContent: "center",
  },
  removeInviteText: { color: colors.red, fontSize: 14, fontFamily: "Outfit_900Black" },

  aiFillBox: {
    marginTop: 10,
    padding: 12,
    backgroundColor: "rgba(90,176,242,0.08)",
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "rgba(90,176,242,0.25)",
  },
  aiFillText: { fontSize: 12, color: colors.blue, fontFamily: "Outfit_700Bold", textAlign: "center" },

  bankrollBox: {
    marginHorizontal: 16,
    marginBottom: 18,
    padding: 18,
    backgroundColor: colors.surface2,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: colors.lineStrong,
    alignItems: "center",
  },
  bankrollLabel: { fontSize: 10, fontFamily: "Outfit_900Black", color: colors.dim, letterSpacing: 1.4 },
  bankrollRow2: { flexDirection: "row", alignItems: "center", gap: 8, marginTop: 6 },
  bankrollNum: { fontSize: 28, fontFamily: "Outfit_900Black", color: colors.chipText, letterSpacing: -0.5 },
  bankrollWarn: { color: colors.red, fontSize: 12, fontFamily: "Outfit_700Bold", marginTop: 8, textAlign: "center" },

  lobbyCtaWrap: { marginHorizontal: 16, marginBottom: 20 },
  lobbyCta: { alignSelf: "stretch" },

  // ---- Sheets ----
  promptWrap: { position: "absolute", top: 0, bottom: 0, left: 0, right: 0, justifyContent: "flex-end", zIndex: 80 },
  backdrop: { flex: 1, backgroundColor: "rgba(3,8,5,0.65)" },
  sheet: {
    backgroundColor: "#101A13",
    borderTopLeftRadius: 26,
    borderTopRightRadius: 26,
    borderTopWidth: 1,
    borderColor: colors.lineStrong,
    padding: 20,
    paddingBottom: 36,
  },
  sheetHeader: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginBottom: 8 },
  sheetEmoji2: { fontSize: 36, textAlign: "center", marginBottom: 6 },
  sheetTitle: { fontFamily: "Outfit_900Black", fontSize: 20, textAlign: "center", color: colors.cream },
  sheetClose: { width: 30, height: 30, borderRadius: 15, backgroundColor: colors.surface, alignItems: "center", justifyContent: "center" },
  sheetCloseText: { color: colors.muted, fontSize: 14, fontFamily: "Outfit_900Black" },
  sheetCopy: { color: colors.muted, fontSize: 13, fontFamily: "Outfit_600SemiBold", lineHeight: 19, textAlign: "center", marginBottom: 16 },

  friendRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    padding: 10,
    borderRadius: 14,
    backgroundColor: colors.bg2,
    borderWidth: 1,
    borderColor: colors.line,
    marginBottom: 6,
  },
  friendRowInvited: { borderColor: colors.mintDeep, backgroundColor: "rgba(198,238,199,0.07)" },
  friendAvatar: {
    width: 38,
    height: 38,
    borderRadius: 12,
    backgroundColor: colors.surface2,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
    borderColor: colors.line,
  },
  friendAvatarText: { fontSize: 18 },
  friendName: { fontSize: 14, fontFamily: "Outfit_800ExtraBold", color: colors.cream },
  friendStatus: { fontSize: 11, color: colors.muted, fontFamily: "Outfit_600SemiBold", marginTop: 2 },
  invitedBadge: {
    backgroundColor: "rgba(67,209,124,0.15)",
    borderWidth: 1,
    borderColor: "rgba(67,209,124,0.4)",
    borderRadius: 10,
    paddingVertical: 5,
    paddingHorizontal: 10,
  },
  invitedBadgeText: { fontSize: 11, fontFamily: "Outfit_800ExtraBold", color: colors.good },
  inviteBadge: {
    backgroundColor: "rgba(198,238,199,0.1)",
    borderWidth: 1,
    borderColor: colors.mintDeep,
    borderRadius: 10,
    paddingVertical: 5,
    paddingHorizontal: 10,
  },
  inviteBadgeDisabled: { opacity: 0.4 },
  inviteBadgeText: { fontSize: 11, fontFamily: "Outfit_800ExtraBold", color: colors.mint },

  addFriendLink: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
    marginTop: 14,
    paddingVertical: 12,
  },
  addFriendLinkText: { fontSize: 14, fontFamily: "Outfit_800ExtraBold", color: colors.mint },

  inputWrap: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: colors.bg2,
    borderWidth: 1,
    borderColor: colors.line,
    borderRadius: 14,
    paddingHorizontal: 14,
    paddingVertical: 4,
    marginBottom: 16,
  },
  inputPrefix: { fontSize: 18, fontFamily: "Outfit_800ExtraBold", color: colors.muted, marginRight: 4 },
  textInput: {
    flex: 1,
    color: colors.cream,
    fontFamily: "Outfit_700Bold",
    fontSize: 16,
    paddingVertical: 12,
  },

  // ---- Buy-in / felted / cashed out ----
  buyinWrap: { flex: 1, alignItems: "center", justifyContent: "center", padding: 28 },
  feltEmoji: { fontSize: 32, marginBottom: 6 },
  feltTitle: { fontSize: 28, fontFamily: "Outfit_900Black", color: colors.cream, letterSpacing: -0.5 },
  feltSub: { fontSize: 14, color: colors.mint2, fontFamily: "Outfit_600SemiBold", marginTop: 4, textAlign: "center" },
  rewardRow: { flexDirection: "row", gap: 12, marginBottom: 28, marginTop: 20 },
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

  // ---- Playing ----
  tableHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 16,
    paddingTop: 8,
    paddingBottom: 4,
  },
  leaveBtn: { color: colors.mint, fontSize: 14, fontFamily: "Outfit_800ExtraBold" },
  streetPill: {
    backgroundColor: colors.table,
    borderRadius: 999,
    paddingVertical: 5,
    paddingHorizontal: 14,
  },
  streetText: { fontSize: 11, fontFamily: "Outfit_900Black", color: colors.mint2, letterSpacing: 1.4 },
  handPill: {
    backgroundColor: colors.surface,
    borderRadius: 999,
    paddingVertical: 5,
    paddingHorizontal: 10,
    borderWidth: 1,
    borderColor: colors.line,
  },
  handPillText: { fontSize: 10, fontFamily: "Outfit_800ExtraBold", color: colors.dim },

  // ---- Oval felt ----
  feltContainer: { alignItems: "center", marginTop: 2 },
  ovalFelt: {
    backgroundColor: colors.table2,
    borderRadius: 999,
    borderWidth: 3,
    borderColor: colors.table,
    position: "relative",
    overflow: "visible",
  },
  feltInnerRing: {
    position: "absolute",
    top: "10%",
    left: "7%",
    borderRadius: 999,
    borderWidth: 1,
    borderColor: "rgba(198,238,199,0.08)",
  },

  centerArea: {
    position: "absolute",
    top: "50%",
    left: "50%",
    transform: [{ translateX: -SCREEN_W * 0.46 }, { translateY: -60 }],
    width: SCREEN_W - 24,
    alignItems: "center",
  },
  potPill: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    backgroundColor: "rgba(10,15,12,0.65)",
    borderWidth: 1.5,
    borderColor: colors.gold,
    borderRadius: 999,
    paddingVertical: 5,
    paddingHorizontal: 16,
  },
  potLabel: { fontSize: 10, fontFamily: "Outfit_900Black", color: colors.gold2, letterSpacing: 1.4 },
  potNum: { fontSize: 17, fontFamily: "Outfit_900Black", color: colors.gold2 },
  boardRow: { flexDirection: "row", gap: 5, justifyContent: "center", marginTop: 8 },
  boardSlot: {
    width: 42,
    height: 60,
    borderRadius: 7,
    borderWidth: 1.5,
    borderStyle: "dashed",
    borderColor: "rgba(198,238,199,0.15)",
    backgroundColor: "rgba(198,238,199,0.03)",
  },
  heroHandName: { marginTop: 6, fontSize: 11.5, color: colors.mint, fontFamily: "Outfit_800ExtraBold" },
  oddsPill: {
    marginTop: 6,
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    backgroundColor: "rgba(10,15,12,0.55)",
    borderWidth: 1,
    borderColor: colors.lineStrong,
    borderRadius: 999,
    paddingVertical: 4,
    paddingHorizontal: 12,
  },
  oddsLabel: { fontSize: 9, fontFamily: "Outfit_900Black", color: colors.dim, letterSpacing: 1.2 },
  oddsNum: { fontSize: 16, fontFamily: "Outfit_900Black" },
  oddsGood: { color: colors.good },
  oddsMid: { color: colors.gold2 },
  oddsBad: { color: colors.red },
  oddsDetail: { fontSize: 10, color: colors.muted, fontFamily: "Outfit_600SemiBold" },

  // ---- Seats ----
  seatContainer: {
    position: "absolute",
    width: 110,
    alignItems: "center",
  },
  seatCards: {
    flexDirection: "row",
    gap: 3,
    marginBottom: 4,
  },
  seatCardsHero: { gap: 6, marginBottom: 6 },
  cardBack2: {
    width: 26,
    height: 36,
    borderRadius: 5,
    backgroundColor: colors.table,
    borderWidth: 1.5,
    borderColor: colors.mintDeep,
  },
  cardBackHero: { width: 46, height: 64, borderRadius: 8, borderWidth: 2 },

  seatBox: {
    width: 80,
    alignItems: "center",
    backgroundColor: "rgba(10,15,12,0.7)",
    borderWidth: 1.5,
    borderColor: "rgba(198,238,199,0.18)",
    borderRadius: 14,
    paddingVertical: 8,
    paddingHorizontal: 6,
    position: "relative",
  },
  seatBoxActive: {
    borderColor: colors.mint,
    backgroundColor: "rgba(198,238,199,0.12)",
    shadowColor: colors.mint,
    shadowOpacity: 0.4,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 0 },
    elevation: 6,
  },
  seatBoxFolded: { opacity: 0.4 },
  seatBoxHero: {
    borderColor: colors.mintDeep,
    backgroundColor: "rgba(20,29,23,0.85)",
  },
  seatBoxWin: { borderColor: colors.good, backgroundColor: "rgba(67,209,124,0.15)" },
  seatBoxLoss: { borderColor: colors.red, backgroundColor: "rgba(228,87,61,0.12)" },
  seatEmoji: { fontSize: 18 },
  seatName: { fontSize: 11, fontFamily: "Outfit_800ExtraBold", color: colors.cream, marginTop: 2 },
  seatStackRow: { flexDirection: "row", alignItems: "center", gap: 3, marginTop: 2 },
  seatStackNum: { fontSize: 11, fontFamily: "Outfit_800ExtraBold", color: colors.chipText },

  friendBadge: {
    position: "absolute",
    top: -8,
    flexDirection: "row",
    alignItems: "center",
    gap: 2,
    backgroundColor: colors.mint,
    borderRadius: 6,
    paddingVertical: 2,
    paddingHorizontal: 5,
  },
  friendBadgeText: { fontSize: 7, fontFamily: "Outfit_900Black", color: colors.mintInk, letterSpacing: 0.5 },
  aiBadge: {
    position: "absolute",
    top: -8,
    backgroundColor: colors.surface2,
    borderRadius: 6,
    paddingVertical: 2,
    paddingHorizontal: 6,
    borderWidth: 1,
    borderColor: colors.line,
  },
  aiBadgeText: { fontSize: 7, fontFamily: "Outfit_900Black", color: colors.dim, letterSpacing: 0.5 },

  dealerBtn: {
    position: "absolute",
    top: -6,
    right: -6,
    width: 20,
    height: 20,
    borderRadius: 10,
    backgroundColor: colors.cream,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1.5,
    borderColor: colors.gold,
  },
  dealerBtnText: { fontSize: 10, fontFamily: "Outfit_900Black", color: colors.bg },

  seatBetPill: {
    position: "absolute",
    bottom: -10,
    flexDirection: "row",
    alignItems: "center",
    gap: 3,
    backgroundColor: "rgba(216,73,58,0.2)",
    borderWidth: 1,
    borderColor: "rgba(216,73,58,0.45)",
    borderRadius: 999,
    paddingVertical: 2,
    paddingHorizontal: 7,
  },
  seatBetText: { fontSize: 9, fontFamily: "Outfit_800ExtraBold", color: colors.chipText },

  seatFoldedTag: { fontSize: 8, fontFamily: "Outfit_900Black", color: colors.red, letterSpacing: 1, marginTop: 3 },
  seatAllInTag: { fontSize: 8, fontFamily: "Outfit_900Black", color: colors.gold, letterSpacing: 1, marginTop: 3 },
  thinkingText: { fontSize: 9, color: colors.mint, fontFamily: "Outfit_700Bold", marginTop: 3, fontStyle: "italic" },

  // ---- Action bar ----
  actionWrap: { paddingHorizontal: 14, marginTop: 8 },
  betSizeRow: { flexDirection: "row", gap: 5, justifyContent: "center" },
  presetBtn: {
    flex: 1,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.lineStrong,
    borderRadius: 10,
    paddingVertical: 7,
    alignItems: "center",
  },
  presetText: { color: colors.mint, fontFamily: "Outfit_800ExtraBold", fontSize: 11 },
  allinBtn: {
    flex: 1.2,
    backgroundColor: "rgba(228,87,61,0.15)",
    borderWidth: 1,
    borderColor: "rgba(228,87,61,0.45)",
    borderRadius: 10,
    paddingVertical: 7,
    alignItems: "center",
  },
  allinBtnText: { color: colors.red, fontFamily: "Outfit_900Black", fontSize: 11, letterSpacing: 0.5 },
  raiseRow: { flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 14, marginTop: 8 },
  raiseAdj: {
    width: 36,
    height: 36,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: colors.line,
    backgroundColor: colors.surface,
    alignItems: "center",
    justifyContent: "center",
  },
  raiseAdjText: { color: colors.mint, fontFamily: "Outfit_900Black", fontSize: 18 },
  raiseSize: { fontSize: 20, fontFamily: "Outfit_900Black", color: colors.cream, minWidth: 70, textAlign: "center" },
  actionBar: { flexDirection: "row", gap: 7, marginTop: 8 },
  actBtn: {
    flex: 1,
    backgroundColor: colors.surface,
    borderWidth: 1.5,
    borderColor: colors.lineStrong,
    borderRadius: 14,
    paddingVertical: 13,
    alignItems: "center",
  },
  actBtnText: { color: colors.mint, fontFamily: "Outfit_900Black", fontSize: 14 },
  actBtnFold: {
    flex: 1,
    backgroundColor: "rgba(228,87,61,0.12)",
    borderWidth: 1.5,
    borderColor: "rgba(228,87,61,0.4)",
    borderRadius: 14,
    paddingVertical: 13,
    alignItems: "center",
  },
  actBtnFoldText: { color: colors.red, fontFamily: "Outfit_900Black", fontSize: 14 },
  actBtnRaise: {
    flex: 1.4,
    backgroundColor: colors.mint,
    borderRadius: 14,
    paddingVertical: 13,
    alignItems: "center",
    shadowColor: colors.mintDeep,
    shadowOpacity: 1,
    shadowRadius: 0,
    shadowOffset: { width: 0, height: 4 },
    elevation: 4,
  },
  actBtnRaiseText: { color: colors.mintInk, fontFamily: "Outfit_900Black", fontSize: 14 },

  actionBarWaiting: {
    paddingHorizontal: 16,
    marginTop: 10,
    alignItems: "center",
    paddingVertical: 12,
  },
  waitingText: { color: colors.dim, fontFamily: "Outfit_700Bold", fontSize: 13 },

  showdownSheet: {
    marginHorizontal: 16,
    marginTop: 10,
    padding: 16,
    borderRadius: 20,
    backgroundColor: colors.surface2,
    borderWidth: 1.5,
    borderColor: colors.gold,
    alignItems: "center",
  },
  showdownTitle: { fontSize: 12, fontFamily: "Outfit_900Black", color: colors.gold, letterSpacing: 1.5 },
  showdownWinner: { fontSize: 22, fontFamily: "Outfit_900Black", color: colors.mint2, marginTop: 4 },
  showdownHand: { fontSize: 13, fontFamily: "Outfit_700Bold", color: colors.muted, marginTop: 4 },
  showdownEvals: { alignSelf: "stretch", marginTop: 10 },
  showdownRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    paddingVertical: 5,
    borderBottomWidth: 1,
    borderStyle: "dashed",
    borderBottomColor: colors.line,
  },
  showdownName: { color: colors.cream, fontFamily: "Outfit_700Bold", fontSize: 13 },
  showdownEvalHand: { color: colors.muted, fontFamily: "Outfit_600SemiBold", fontSize: 13 },

  logScroll: { flex: 1, paddingHorizontal: 16, marginTop: 6 },
  logLine: { fontSize: 12, fontFamily: "Outfit_500Medium", color: colors.muted, paddingVertical: 1.5 },
  logGood: { color: colors.good },
  logBad: { color: colors.red },
  logDim: { color: colors.dim },
});
