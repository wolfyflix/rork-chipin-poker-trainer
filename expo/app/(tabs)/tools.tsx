import React, { useCallback, useMemo, useRef, useState } from "react";
import { Animated, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from "react-native";
import * as ImagePicker from "expo-image-picker";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import CardPicker from "@/components/CardPicker";
import PlayingCard from "@/components/PlayingCard";
import PressButton from "@/components/PressButton";
import colors from "@/constants/colors";
import { OUTS_REF } from "@/lib/curriculum";
import { Card, cardKey, myOdds, OddsResult, OddsVerdict, oddsVerdict, whoWon, WhoWonResult } from "@/lib/poker";
import { useGame } from "@/providers/GameProvider";

type ToolId = "hub" | "who" | "odds";

interface PickTarget {
  arr: "whoBoard" | "oddsHero" | "oddsBoard" | `p${number}`;
  idx: number;
  label: string;
}

interface PlayerSlots {
  name: string;
  hole: (Card | null)[];
}

const VERDICT_COLORS: Record<OddsVerdict["tone"], string> = {
  fire: colors.gold2,
  good: colors.good,
  mid: colors.blue,
  bad: "#F2A33C",
  dead: colors.red,
};

const COMMON_DRAWS: { name: string; outs: number; pct: number }[] = [
  { name: "Flush draw", outs: 9, pct: 36 },
  { name: "Open-ended straight", outs: 8, pct: 32 },
  { name: "Two overcards", outs: 6, pct: 24 },
  { name: "Gutshot straight", outs: 4, pct: 16 },
  { name: "Set to full house+", outs: 7, pct: 28 },
];

export default function ToolsScreen() {
  const insets = useSafeAreaInsets();
  const { usesLeft, pro, chargeToolUse, openPaywall } = useGame();
  const scrollRef = useRef<ScrollView>(null);

  const [tool, setTool] = useState<ToolId>("hub");
  const [whoBoard, setWhoBoard] = useState<(Card | null)[]>(Array(5).fill(null));
  const [players, setPlayers] = useState<PlayerSlots[]>([
    { name: "Me", hole: [null, null] },
    { name: "Mike", hole: [null, null] },
  ]);
  const [oddsHero, setOddsHero] = useState<(Card | null)[]>([null, null]);
  const [oddsBoard, setOddsBoard] = useState<(Card | null)[]>(Array(5).fill(null));
  const [oppN, setOppN] = useState<number>(2);
  const [potSize, setPotSize] = useState<number>(100);
  const [betSize, setBetSize] = useState<number>(50);
  const [pickTarget, setPickTarget] = useState<PickTarget | null>(null);
  const [whoResult, setWhoResult] = useState<WhoWonResult | null>(null);
  const [oddsResult, setOddsResult] = useState<{ o: OddsResult; v: OddsVerdict } | null>(null);
  const [outsSel, setOutsSel] = useState<number>(0);
  const [notice, setNotice] = useState<string | null>(null);
  const [scanning, setScanning] = useState<boolean>(false);
  const noticeTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const showNotice = useCallback((msg: string) => {
    setNotice(msg);
    if (noticeTimer.current) clearTimeout(noticeTimer.current);
    noticeTimer.current = setTimeout(() => setNotice(null), 2300);
  }, []);

  const usedKeys = useMemo(() => {
    const all = [...whoBoard, ...players.flatMap((p) => p.hole), ...oddsHero, ...oddsBoard];
    return new Set(all.filter((c): c is Card => c != null).map(cardKey));
  }, [whoBoard, players, oddsHero, oddsBoard]);

  const openTool = useCallback((t: ToolId) => {
    setTool(t);
    scrollRef.current?.scrollTo({ y: 0, animated: false });
  }, []);

  const setSlot = useCallback(
    (target: PickTarget, card: Card | null) => {
      if (target.arr === "whoBoard") {
        setWhoBoard((prev) => prev.map((c, i) => (i === target.idx ? card : c)));
      } else if (target.arr === "oddsHero") {
        setOddsHero((prev) => prev.map((c, i) => (i === target.idx ? card : c)));
      } else if (target.arr === "oddsBoard") {
        setOddsBoard((prev) => prev.map((c, i) => (i === target.idx ? card : c)));
      } else {
        const pi = Number(target.arr.slice(1));
        setPlayers((prev) =>
          prev.map((p, i) => (i === pi ? { ...p, hole: p.hole.map((c, ci) => (ci === target.idx ? card : c)) } : p)),
        );
      }
    },
    [],
  );

  const tapSlot = useCallback(
    (target: PickTarget, current: Card | null) => {
      if (current) {
        setSlot(target, null);
        return;
      }
      setPickTarget(target);
    },
    [setSlot],
  );

  const handlePick = useCallback(
    (card: Card) => {
      if (!pickTarget) return;
      setSlot(pickTarget, card);
      setPickTarget(null);
    },
    [pickTarget, setSlot],
  );

  const chargeOrPaywall = useCallback((): boolean => {
    if (chargeToolUse()) return true;
    openPaywall("You're out of free tool runs today.\nPro = unlimited, forever.");
    return false;
  }, [chargeToolUse, openPaywall]);

  const settleIt = useCallback(() => {
    if (!chargeOrPaywall()) return;
    const board = whoBoard.filter((c): c is Card => c != null);
    const ps = players.map((p) => ({
      name: p.name.trim() || "??",
      hole: p.hole.filter((c): c is Card => c != null),
    }));
    const res = whoWon(ps, board);
    setWhoResult(res);
  }, [whoBoard, players, chargeOrPaywall]);

  const runOdds = useCallback(() => {
    if (!chargeOrPaywall()) return;
    const hero = oddsHero.filter((c): c is Card => c != null);
    const board = oddsBoard.filter((c): c is Card => c != null);
    const o = myOdds(hero, board, oppN, 3000);
    const v = oddsVerdict(o.winPct, oppN, board.length);
    setOddsResult({ o, v });
  }, [oddsHero, oddsBoard, oppN, chargeOrPaywall]);

  const exWho = useCallback(() => {
    setWhoBoard([{ r: 12, s: 0 }, { r: 11, s: 0 }, { r: 4, s: 0 }, { r: 9, s: 2 }, { r: 2, s: 3 }]);
    setPlayers([
      { name: "Me", hole: [{ r: 14, s: 0 }, { r: 10, s: 0 }] },
      { name: "Mike", hole: [{ r: 12, s: 1 }, { r: 12, s: 2 }] },
    ]);
    setWhoResult(null);
    showNotice("Example loaded: flush vs trips — tap Settle it");
  }, [showNotice]);

  const exOdds = useCallback(() => {
    setOddsHero([{ r: 14, s: 1 }, { r: 9, s: 1 }]);
    setOddsBoard([{ r: 12, s: 1 }, { r: 7, s: 1 }, { r: 2, s: 0 }, null, null]);
    setOddsResult(null);
    setPotSize(120);
    setBetSize(40);
    showNotice("Example: nut flush draw on the flop vs 2 players");
  }, [showNotice]);

  const addPlayer = useCallback(() => {
    setPlayers((prev) =>
      prev.length >= 4 ? prev : [...prev, { name: `Player ${prev.length + 1}`, hole: [null, null] }],
    );
  }, []);

  const removePlayer = useCallback((i: number) => {
    setPlayers((prev) => prev.filter((_, pi) => pi !== i));
  }, []);

  /** Camera scan — opens the camera, snaps a photo, runs simulated detection, prefills cards. */
  const scanTable = useCallback(async () => {
    setScanning(true);
    try {
      const res = await ImagePicker.launchCameraAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.Images,
        allowsEditing: true,
        aspect: [4, 3],
        quality: 0.7,
      });
      if (res.canceled || !res.assets?.length) {
        setScanning(false);
        return;
      }
      // Simulated detection — preview v1. Real card-recognition model comes in a later version.
      const used = new Set<number>();
      const board: Card[] = [];
      while (board.length < 5) {
        const r = 2 + Math.floor(Math.random() * 13);
        const s = Math.floor(Math.random() * 4);
        const k = r * 4 + s;
        if (!used.has(k)) { used.add(k); board.push({ r, s }); }
      }
      const h1a: Card[] = [];
      const h1b: Card[] = [];
      while (h1a.length < 2) {
        const r = 2 + Math.floor(Math.random() * 13);
        const s = Math.floor(Math.random() * 4);
        const k = r * 4 + s;
        if (!used.has(k)) { used.add(k); h1a.push({ r, s }); }
      }
      while (h1b.length < 2) {
        const r = 2 + Math.floor(Math.random() * 13);
        const s = Math.floor(Math.random() * 4);
        const k = r * 4 + s;
        if (!used.has(k)) { used.add(k); h1b.push({ r, s }); }
      }
      setWhoBoard(board);
      setPlayers([
        { name: "Me", hole: h1a },
        { name: "Mike", hole: h1b },
      ]);
      setWhoResult(null);
      showNotice("📸 Scanned — cards prefilled (preview). Tap any slot to fix a wrong read.");
    } catch {
      showNotice("Camera unavailable — tap the slots to enter cards manually.");
    } finally {
      setScanning(false);
    }
  }, [showNotice]);

  const whoReady = whoBoard.every(Boolean) && players.every((p) => p.hole.every(Boolean));
  const oddsBoardCount = oddsBoard.filter(Boolean).length;
  const oddsReady = oddsHero.every(Boolean) && [0, 3, 4, 5].includes(oddsBoardCount);
  const poNeed = (betSize / (potSize + 2 * betSize)) * 100;
  const poRatio = ((potSize + betSize) / betSize).toFixed(1).replace(/\.0$/, "");

  const renderSlot = (target: PickTarget, card: Card | null) => (
    <Pressable
      key={`${target.arr}-${target.idx}`}
      onPress={() => tapSlot(target, card)}
      style={[styles.slot, card != null && styles.slotFilled]}
      testID={`slot-${target.arr}-${target.idx}`}
    >
      {card ? <PlayingCard card={card} size="mini" /> : <Text style={styles.slotPlus}>+</Text>}
    </Pressable>
  );

  const oddsResultBox = (o: OddsResult, v: OddsVerdict) => (
    <View style={styles.resultBox}>
      <View style={styles.winRing}>
        <Text style={styles.winPct}>{o.winPct.toFixed(0)}%</Text>
        <Text style={styles.winSub}>TO WIN</Text>
      </View>
      <Text style={[styles.verdict, { color: VERDICT_COLORS[v.tone] }]}>{v.rating}</Text>
      <Text style={styles.explain}>{v.text}</Text>

      <View style={styles.callFoldBox}>
        <Text style={styles.callFoldLabel}>
          Pot {potSize} · bet {betSize} → you need {poNeed.toFixed(0)}% to call
        </Text>
        <View style={styles.callFoldRow}>
          <View style={[styles.callFoldPill, o.winPct >= poNeed ? styles.pillGood : styles.pillBad]}>
            <Text style={styles.pillText}>{o.winPct >= poNeed ? "CALL ✓" : "FOLD ✕"}</Text>
          </View>
          <Text style={styles.potRatioText}>Pot odds {poRatio}:1</Text>
        </View>
        <Text style={styles.drawsHeading}>Do your draws clear the bar? (flop → river)</Text>
        {COMMON_DRAWS.map((d) => {
          const ok = d.pct >= poNeed;
          return (
            <View key={d.name} style={styles.drawRow}>
              <Text style={styles.drawName}>
                {d.name} <Text style={styles.drawSub}>({d.outs} outs, ~{d.pct}%)</Text>
              </Text>
              <Text style={[styles.drawVerdict, { color: ok ? colors.good : colors.red }]}>
                {ok ? "CALL ✓" : "FOLD ✕"}
              </Text>
            </View>
          );
        })}
      </View>

      <Text style={styles.simNote}>
        {o.iters.toLocaleString()} simulated runouts · ties {o.tiePct.toFixed(1)}%
      </Text>
    </View>
  );

  const toolHeader = (title: string) => (
    <View style={styles.toolHead}>
      <Pressable style={styles.backBtn} onPress={() => openTool("hub")} testID="tool-back">
        <Text style={styles.backText}>‹</Text>
      </Pressable>
      <Text style={styles.toolTitle}>{title}</Text>
    </View>
  );

  return (
    <View style={[styles.screen, { paddingTop: insets.top }]}>
      <ScrollView ref={scrollRef} showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: 40 }}>
        <View style={styles.topbar}>
          <View style={styles.brandRow}>
            <View style={styles.brandChip} />
            <Text style={styles.brand}>Tools</Text>
          </View>
          <View style={styles.usesChip}>
            <Text style={styles.usesText}>
              ⚡ <Text style={styles.usesNum}>{pro ? "∞" : usesLeft}</Text> free today
            </Text>
          </View>
        </View>

        {tool === "hub" && (
          <>
            <Text style={styles.pageSub}>Settle arguments. Check your math. Win the group chat.</Text>
            {([
              ["who", "🏆", "Who Won?", "Hand's over, table's arguing. Snap the board or tap it in — get the verdict."],
              ["odds", "📊", "My Odds", "Your hand vs the field. Win %, plain-English verdict, and call/fold for the common draws."],
            ] as [ToolId, string, string, string][]).map(([id, icon, title, sub]) => (
              <Pressable key={id} style={styles.toolCard} onPress={() => openTool(id)} testID={`tool-${id}`}>
                <View style={styles.toolIcon}>
                  <Text style={styles.toolIconText}>{icon}</Text>
                </View>
                <View style={styles.toolInfo}>
                  <Text style={styles.toolCardTitle}>{title}</Text>
                  <Text style={styles.toolCardSub}>{sub}</Text>
                </View>
                <Text style={styles.arr}>›</Text>
              </Pressable>
            ))}
            <View style={styles.discl}>
              <Text style={styles.disclText}>
                📚 Every tool here is for reviewing hands <Text style={styles.disclBold}>after</Text> they happen.
                Live-hand use is cheating everywhere — settle it after the river.
              </Text>
            </View>
          </>
        )}

        {tool === "who" && (
          <>
            {toolHeader("Who Won?")}
            <View style={styles.what}>
              <Text style={styles.whatText}>
                Hand just ended, two people both think they won. Snap the table or tap the slots in — ChipIn
                calls it using real ranking rules.
              </Text>
            </View>
            <Pressable style={styles.scanBtn} onPress={scanTable} disabled={scanning} testID="scan-table">
              <Text style={styles.scanEmoji}>📸</Text>
              <Text style={styles.scanText}>{scanning ? "Scanning…" : "Scan the table"}</Text>
            </Pressable>
            <Text style={styles.scanNote}>Preview — simulated detection. Tap any slot to fix a wrong read.</Text>
            <Pressable style={styles.exampleBtn} onPress={exWho} testID="example-who">
              <Text style={styles.exampleText}>👀 show me an example</Text>
            </Pressable>
            <View style={styles.panel}>
              <Text style={styles.sectionLabel}>
                <Text style={styles.stepNum}>1</Text> The 5 cards on the table
              </Text>
              <View style={styles.slotRow}>
                {whoBoard.map((c, i) => renderSlot({ arr: "whoBoard", idx: i, label: `Board card ${i + 1}` }, c))}
              </View>
            </View>
            <View style={styles.panel}>
              <Text style={styles.sectionLabel}>
                <Text style={styles.stepNum}>2</Text> Each player&apos;s 2 cards
              </Text>
              {players.map((p, pi) => (
                <View key={pi} style={styles.playerBox}>
                  <View style={styles.playerHead}>
                    <TextInput
                      value={p.name}
                      onChangeText={(t) =>
                        setPlayers((prev) => prev.map((pp, i) => (i === pi ? { ...pp, name: t } : pp)))
                      }
                      style={styles.playerInput}
                      placeholderTextColor={colors.dim}
                      testID={`player-name-${pi}`}
                    />
                    {players.length > 2 && (
                      <Pressable onPress={() => removePlayer(pi)}>
                        <Text style={styles.linkBtn}>remove</Text>
                      </Pressable>
                    )}
                  </View>
                  <View style={styles.slotRow}>
                    {p.hole.map((c, i) =>
                      renderSlot({ arr: `p${pi}`, idx: i, label: `${p.name} card ${i + 1}` }, c),
                    )}
                  </View>
                </View>
              ))}
              {players.length < 4 && (
                <Pressable onPress={addPlayer} testID="add-player">
                  <Text style={[styles.linkBtn, { marginTop: 10 }]}>+ Add another player</Text>
                </Pressable>
              )}
            </View>
            <PressButton
              label="Settle it 🔨"
              onPress={settleIt}
              disabled={!whoReady}
              style={styles.cta}
              testID="settle-it"
            />
            {whoResult && (
              <View style={styles.resultBox}>
                <Text style={styles.winnerBanner}>
                  {whoResult.tie ? "It's a chop — split the pot" : "And the pot goes to…"}
                </Text>
                <Text style={styles.winnerName}>
                  {whoResult.tie ? whoResult.winners.join(" + ") : `🏆 ${whoResult.winners[0]}`}
                </Text>
                <View style={styles.winnerHand}>
                  <Text style={styles.winnerHandText}>{whoResult.hand}</Text>
                </View>
                <View style={{ marginTop: 14, alignSelf: "stretch" }}>
                  {whoResult.evals.map((e) => (
                    <View key={e.name} style={styles.showdownRow}>
                      <Text style={styles.showdownName}>{e.name}</Text>
                      <Text style={styles.showdownHand}>{e.hand}</Text>
                    </View>
                  ))}
                </View>
                <Text style={styles.settledNote}>Argument settled. Venmo accordingly. 🤝</Text>
              </View>
            )}
          </>
        )}

        {tool === "odds" && (
          <>
            {toolHeader("My Odds")}
            <View style={styles.what}>
              <Text style={styles.whatText}>
                &quot;Should I have called?&quot; Enter your two cards, any board cards you saw, and how many players
                were in. Get your real win %, a plain-English verdict, and a call/fold answer for the common draws.
              </Text>
            </View>
            <View style={styles.disclStrong}>
              <Text style={styles.disclText}>
                ⚠️ For reviewing hands after play—not for use during a live hand.
              </Text>
            </View>
            <Pressable style={styles.exampleBtn} onPress={exOdds} testID="example-odds">
              <Text style={styles.exampleText}>👀 show me an example</Text>
            </Pressable>
            <View style={styles.panel}>
              <Text style={styles.sectionLabel}>
                <Text style={styles.stepNum}>1</Text> Your 2 cards
              </Text>
              <View style={styles.slotRow}>
                {oddsHero.map((c, i) => renderSlot({ arr: "oddsHero", idx: i, label: `Your card ${i + 1}` }, c))}
              </View>
            </View>
            <View style={styles.panel}>
              <Text style={styles.sectionLabel}>
                <Text style={styles.stepNum}>2</Text> Board — skip if preflop
              </Text>
              <View style={styles.slotRow}>
                {oddsBoard.map((c, i) => renderSlot({ arr: "oddsBoard", idx: i, label: `Board card ${i + 1}` }, c))}
              </View>
            </View>
            <View style={styles.panel}>
              <Text style={styles.sectionLabel}>
                <Text style={styles.stepNum}>3</Text> Players against you
              </Text>
              <View style={styles.stepper}>
                <Pressable
                  style={styles.stepBtn}
                  onPress={() => setOppN((n) => Math.max(1, n - 1))}
                  testID="opp-minus"
                >
                  <Text style={styles.stepBtnText}>−</Text>
                </Pressable>
                <Text style={styles.stepN}>{oppN}</Text>
                <Pressable
                  style={styles.stepBtn}
                  onPress={() => setOppN((n) => Math.min(8, n + 1))}
                  testID="opp-plus"
                >
                  <Text style={styles.stepBtnText}>+</Text>
                </Pressable>
              </View>
            </View>
            <View style={styles.panel}>
              <Text style={styles.sectionLabel}>
                <Text style={styles.stepNum}>4</Text> Pot &amp; bet (for the call/fold verdict)
              </Text>
              <View style={styles.poRow}>
                <View style={styles.poBox}>
                  <Text style={styles.poK}>Pot before bet</Text>
                  <Text style={styles.poV}>{potSize}</Text>
                  <View style={styles.poAdj}>
                    <Pressable style={styles.poAdjBtn} onPress={() => setPotSize((v) => Math.max(25, v - 25))}>
                      <Text style={styles.poAdjText}>−</Text>
                    </Pressable>
                    <Pressable style={styles.poAdjBtn} onPress={() => setPotSize((v) => v + 25)}>
                      <Text style={styles.poAdjText}>+</Text>
                    </Pressable>
                  </View>
                </View>
                <View style={styles.poBox}>
                  <Text style={styles.poK}>Their bet</Text>
                  <Text style={styles.poV}>{betSize}</Text>
                  <View style={styles.poAdj}>
                    <Pressable style={styles.poAdjBtn} onPress={() => setBetSize((v) => Math.max(10, v - 10))}>
                      <Text style={styles.poAdjText}>−</Text>
                    </Pressable>
                    <Pressable style={styles.poAdjBtn} onPress={() => setBetSize((v) => v + 10)}>
                      <Text style={styles.poAdjText}>+</Text>
                    </Pressable>
                  </View>
                </View>
              </View>
            </View>
            <PressButton
              label="Get my odds"
              onPress={runOdds}
              disabled={!oddsReady}
              style={styles.cta}
              testID="run-odds"
            />
            {oddsResult && oddsResultBox(oddsResult.o, oddsResult.v)}
          </>
        )}
      </ScrollView>

      {notice && (
        <View style={[styles.toast, { top: insets.top + 56 }]}>
          <Text style={styles.toastText}>{notice}</Text>
        </View>
      )}

      <CardPicker
        visible={pickTarget != null}
        title={pickTarget?.label ?? "Pick a card"}
        usedKeys={usedKeys}
        onPick={handlePick}
        onClose={() => setPickTarget(null)}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.bg },
  topbar: {
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
  brand: { fontFamily: "Outfit_900Black", fontSize: 24, letterSpacing: -1, color: colors.cream },
  usesChip: {
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.line,
    borderRadius: 999,
    paddingVertical: 6,
    paddingHorizontal: 12,
  },
  usesText: { color: colors.muted, fontSize: 12, fontFamily: "Outfit_800ExtraBold" },
  usesNum: { color: colors.mint },
  pageSub: {
    paddingHorizontal: 20,
    paddingBottom: 8,
    fontSize: 13.5,
    color: colors.muted,
    fontFamily: "Outfit_600SemiBold",
  },
  toolCard: {
    marginHorizontal: 16,
    marginVertical: 6,
    padding: 16,
    paddingHorizontal: 18,
    borderRadius: 24,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.line,
    flexDirection: "row",
    gap: 14,
    alignItems: "center",
  },
  toolIcon: {
    width: 52,
    height: 52,
    borderRadius: 16,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "rgba(198,238,199,0.07)",
    borderWidth: 1,
    borderColor: colors.line,
  },
  toolIconText: { fontSize: 24 },
  toolInfo: { flex: 1 },
  toolCardTitle: { fontSize: 16, fontFamily: "Outfit_800ExtraBold", letterSpacing: -0.2, color: colors.cream },
  toolCardSub: { fontSize: 12.5, color: colors.muted, fontFamily: "Outfit_600SemiBold", lineHeight: 17, marginTop: 2 },
  arr: { color: colors.dim, fontSize: 18, fontFamily: "Outfit_900Black" },
  discl: {
    marginHorizontal: 16,
    marginTop: 10,
    padding: 12,
    paddingHorizontal: 14,
    borderRadius: 14,
    backgroundColor: "rgba(228,87,61,0.06)",
    borderWidth: 1,
    borderColor: "rgba(228,87,61,0.25)",
  },
  disclStrong: {
    marginHorizontal: 16,
    marginTop: 8,
    padding: 12,
    paddingHorizontal: 14,
    borderRadius: 14,
    backgroundColor: "rgba(228,87,61,0.1)",
    borderWidth: 1,
    borderColor: "rgba(228,87,61,0.35)",
  },
  disclText: { fontSize: 12, lineHeight: 18, color: "#F0A08F", fontFamily: "Outfit_600SemiBold" },
  disclBold: { fontFamily: "Outfit_800ExtraBold" },
  toolHead: { flexDirection: "row", alignItems: "center", gap: 10, paddingHorizontal: 20, paddingTop: 4 },
  backBtn: {
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.line,
    width: 38,
    height: 38,
    borderRadius: 12,
    alignItems: "center",
    justifyContent: "center",
  },
  backText: { color: colors.mint, fontSize: 20, fontFamily: "Outfit_900Black", marginTop: -2 },
  toolTitle: { fontSize: 20, fontFamily: "Outfit_900Black", letterSpacing: -0.4, color: colors.cream },
  what: {
    marginHorizontal: 16,
    marginTop: 8,
    padding: 12,
    paddingHorizontal: 15,
    borderRadius: 14,
    backgroundColor: "rgba(198,238,199,0.05)",
    borderWidth: 1,
    borderColor: colors.line,
  },
  whatText: { fontSize: 13, color: colors.mint2, fontFamily: "Outfit_600SemiBold", lineHeight: 19 },
  scanBtn: {
    marginHorizontal: 16,
    marginTop: 10,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 10,
    paddingVertical: 16,
    borderRadius: 18,
    backgroundColor: colors.table2,
    borderWidth: 2,
    borderColor: colors.table,
  },
  scanEmoji: { fontSize: 22 },
  scanText: { color: colors.mint2, fontFamily: "Outfit_900Black", fontSize: 16, letterSpacing: -0.2 },
  scanNote: {
    textAlign: "center",
    marginHorizontal: 24,
    marginTop: 6,
    fontSize: 11,
    color: colors.dim,
    fontFamily: "Outfit_500Medium",
  },
  exampleBtn: {
    alignSelf: "center",
    borderWidth: 1,
    borderStyle: "dashed",
    borderColor: colors.lineStrong,
    paddingVertical: 8,
    paddingHorizontal: 14,
    borderRadius: 999,
    marginTop: 10,
  },
  exampleText: { color: colors.mint, fontFamily: "Outfit_800ExtraBold", fontSize: 12.5 },
  panel: {
    marginHorizontal: 16,
    marginTop: 12,
    padding: 18,
    borderRadius: 24,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.line,
  },
  sectionLabel: {
    fontSize: 11.5,
    fontFamily: "Outfit_800ExtraBold",
    letterSpacing: 1.6,
    color: colors.dim,
    textTransform: "uppercase",
    marginBottom: 10,
  },
  stepNum: { color: colors.mint },
  slotRow: { flexDirection: "row", gap: 8, flexWrap: "wrap" },
  slot: {
    width: 56,
    height: 78,
    borderRadius: 10,
    borderWidth: 2,
    borderStyle: "dashed",
    borderColor: "rgba(198,238,199,0.3)",
    backgroundColor: "rgba(198,238,199,0.03)",
    alignItems: "center",
    justifyContent: "center",
  },
  slotFilled: { borderStyle: "solid", borderColor: "transparent", backgroundColor: "transparent" },
  slotPlus: { color: colors.dim, fontSize: 20, fontFamily: "Outfit_700Bold" },
  playerBox: {
    marginTop: 14,
    padding: 14,
    borderRadius: 16,
    backgroundColor: colors.bg2,
    borderWidth: 1,
    borderColor: colors.line,
  },
  playerHead: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginBottom: 10 },
  playerInput: {
    color: colors.cream,
    fontFamily: "Outfit_800ExtraBold",
    fontSize: 15,
    width: "58%",
    borderBottomWidth: 1,
    borderStyle: "dashed",
    borderBottomColor: colors.lineStrong,
    paddingVertical: 2,
  },
  linkBtn: { color: colors.mint, fontFamily: "Outfit_800ExtraBold", fontSize: 13 },
  cta: { marginHorizontal: 16, marginTop: 14 },
  resultBox: {
    marginHorizontal: 16,
    marginTop: 14,
    padding: 22,
    borderRadius: 24,
    backgroundColor: colors.surface2,
    borderWidth: 1,
    borderColor: colors.lineStrong,
    alignItems: "center",
  },
  winnerBanner: { fontSize: 15, fontFamily: "Outfit_700Bold", color: colors.muted, marginBottom: 2 },
  winnerName: { fontSize: 30, fontFamily: "Outfit_900Black", color: colors.mint2, letterSpacing: -0.5, textAlign: "center" },
  winnerHand: {
    marginTop: 8,
    backgroundColor: "rgba(198,238,199,0.1)",
    borderWidth: 1,
    borderColor: colors.lineStrong,
    paddingVertical: 7,
    paddingHorizontal: 14,
    borderRadius: 999,
  },
  winnerHandText: { color: colors.mint, fontFamily: "Outfit_800ExtraBold", fontSize: 14 },
  showdownRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    paddingVertical: 9,
    paddingHorizontal: 2,
    borderBottomWidth: 1,
    borderStyle: "dashed",
    borderBottomColor: colors.line,
  },
  showdownName: { fontSize: 14, fontFamily: "Outfit_600SemiBold", color: colors.cream },
  showdownHand: { fontSize: 14, fontFamily: "Outfit_600SemiBold", color: colors.muted, flexShrink: 1, textAlign: "right" },
  settledNote: { fontSize: 12, color: colors.dim, fontFamily: "Outfit_600SemiBold", marginTop: 12 },
  stepper: { flexDirection: "row", alignItems: "center", gap: 16, justifyContent: "center", marginVertical: 6 },
  stepBtn: {
    width: 44,
    height: 44,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: colors.line,
    backgroundColor: colors.surface2,
    alignItems: "center",
    justifyContent: "center",
  },
  stepBtnText: { color: colors.mint, fontSize: 22, fontFamily: "Outfit_900Black" },
  stepN: { fontSize: 26, fontFamily: "Outfit_900Black", minWidth: 44, textAlign: "center", color: colors.mint },
  poRow: { flexDirection: "row", gap: 10 },
  poBox: {
    flex: 1,
    backgroundColor: colors.bg2,
    borderWidth: 1,
    borderColor: colors.line,
    borderRadius: 16,
    padding: 12,
    alignItems: "center",
  },
  poK: {
    fontSize: 11,
    fontFamily: "Outfit_800ExtraBold",
    letterSpacing: 1,
    color: colors.dim,
    textTransform: "uppercase",
    textAlign: "center",
  },
  poV: { fontSize: 24, fontFamily: "Outfit_900Black", color: colors.cream, marginVertical: 4 },
  poAdj: { flexDirection: "row", gap: 6 },
  poAdjBtn: {
    width: 34,
    height: 34,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: colors.line,
    backgroundColor: colors.surface2,
    alignItems: "center",
    justifyContent: "center",
  },
  poAdjText: { color: colors.mint, fontFamily: "Outfit_900Black", fontSize: 16 },
  winRing: {
    width: 150,
    height: 150,
    borderRadius: 75,
    marginVertical: 6,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: colors.bg2,
    borderWidth: 10,
    borderColor: colors.mint,
  },
  winPct: { fontSize: 31, fontFamily: "Outfit_900Black", color: colors.mint2, letterSpacing: -1 },
  winSub: { fontSize: 9.5, fontFamily: "Outfit_800ExtraBold", letterSpacing: 1.5, color: colors.muted },
  verdict: { fontSize: 21, fontFamily: "Outfit_900Black", letterSpacing: -0.3, marginTop: 8, marginBottom: 8 },
  explain: { fontSize: 14.5, lineHeight: 22, color: colors.cream, opacity: 0.9, fontFamily: "Outfit_500Medium", textAlign: "center" },
  callFoldBox: {
    alignSelf: "stretch",
    marginTop: 14,
    padding: 14,
    borderRadius: 16,
    backgroundColor: colors.bg2,
    borderWidth: 1,
    borderColor: colors.line,
  },
  callFoldLabel: { fontSize: 11.5, color: colors.muted, fontFamily: "Outfit_700Bold", textAlign: "center" },
  callFoldRow: { flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 14, marginVertical: 10 },
  callFoldPill: {
    paddingVertical: 8,
    paddingHorizontal: 18,
    borderRadius: 999,
    borderWidth: 1.5,
  },
  pillGood: { backgroundColor: "rgba(67,209,124,0.15)", borderColor: colors.good },
  pillBad: { backgroundColor: "rgba(228,87,61,0.15)", borderColor: colors.red },
  pillText: { fontFamily: "Outfit_900Black", fontSize: 15, letterSpacing: 0.5 },
  potRatioText: { fontSize: 12.5, color: colors.muted, fontFamily: "Outfit_700Bold" },
  drawsHeading: {
    fontSize: 11,
    fontFamily: "Outfit_800ExtraBold",
    letterSpacing: 1.2,
    color: colors.dim,
    textTransform: "uppercase",
    marginTop: 12,
    marginBottom: 6,
    textAlign: "center",
  },
  drawRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    paddingVertical: 7,
    borderBottomWidth: 1,
    borderStyle: "dashed",
    borderBottomColor: colors.line,
  },
  drawName: { fontSize: 13, fontFamily: "Outfit_600SemiBold", color: colors.cream },
  drawSub: { color: colors.muted },
  drawVerdict: { fontSize: 13, fontFamily: "Outfit_900Black" },
  simNote: { fontSize: 11, color: colors.dim, fontFamily: "Outfit_600SemiBold", marginTop: 10 },
  toast: {
    position: "absolute",
    alignSelf: "center",
    backgroundColor: "#16281C",
    borderWidth: 1,
    borderColor: colors.lineStrong,
    paddingVertical: 11,
    paddingHorizontal: 18,
    borderRadius: 14,
    zIndex: 60,
  },
  toastText: { color: colors.cream, fontFamily: "Outfit_700Bold", fontSize: 13.5 },
});
