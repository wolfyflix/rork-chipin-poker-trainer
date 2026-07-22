import createContextHook from "@nkzw/create-context-hook";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";

import { fetchCustomerInfo, hasProEntitlement, isPurchasesConfigured } from "@/lib/revenuecat";

export interface ArenaHighs {
  whw: number;
  outs: number;
  swipe: number;
  beat: number;
}

interface DeltaEvent {
  id: number;
  amount: number;
}

/** Lessons that must be completed before The Table unlocks. */
export const TABLE_UNLOCK_LESSONS = 2;

/** Starting bankroll — feels like real poker apps, no "50 min bet" bad look. */
export const START_BANKROLL = 5000;

/** Lives system — Duolingo style. Lose one per wrong answer. Refill one every 8 min. */
export const MAX_LIVES = 5;
const LIFE_REFILL_MS = 8 * 60 * 1000;

/** Streak recovery — pay chips to restore a broken streak (Duolingo-style). */
export const STREAK_RECOVERY_COST = 100;

/**
 * ChipIn game state — Stage 1 uses local (in-memory) state with placeholder data.
 * Stage 2 will sync this with Supabase.
 *
 * Economy v2:
 *  - Lessons are FREE (no buy-in). Correct answers EARN chips.
 *  - Lives gate lessons: lose one per wrong answer, regenerate over time.
 *  - Chips are spent only in Arena (current mini-games, may earn) and The Table (real buy-in).
 *  - The Table unlocks after TABLE_UNLOCK_LESSONS completed lessons.
 *  - Streak: broken when you skip a day; can be restored once for STREAK_RECOVERY_COST chips.
 */
export const [GameProvider, useGame] = createContextHook(() => {
  const [chips, setChips] = useState<number>(START_BANKROLL);
  const [streak, setStreak] = useState<number>(4);
  const [streakBroken, setStreakBroken] = useState<boolean>(false);
  const [streakRecoveredToday, setStreakRecoveredToday] = useState<boolean>(false);
  const [completed, setCompleted] = useState<Set<string>>(new Set(["u1l1", "u1l2"]));
  const [pro, setPro] = useState<boolean>(false);
  const [usesLeft, setUsesLeft] = useState<number>(3);
  const [biggestPot, setBiggestPot] = useState<number>(0);
  const [highs, setHighs] = useState<ArenaHighs>({ whw: 0, outs: 0, swipe: 0, beat: 0 });
  const [hardMode, setHardMode] = useState<boolean>(false);
  const [dailyClaimed, setDailyClaimed] = useState<boolean>(false);
  const [delta, setDelta] = useState<DeltaEvent | null>(null);
  const [paywallVisible, setPaywallVisible] = useState<boolean>(false);
  const [paywallMessage, setPaywallMessage] = useState<string | null>(null);
  const deltaId = useRef<number>(0);

  // Lives — start full, refill on a timer.
  const [lives, setLives] = useState<number>(MAX_LIVES);
  const [nextLifeAt, setNextLifeAt] = useState<number | null>(null);

  /** Sync `pro` with RevenueCat customer info on mount, and whenever a purchase completes upstream. */
  useEffect(() => {
    if (!isPurchasesConfigured()) return;
    let cancelled = false;
    fetchCustomerInfo()
      .then((info) => {
        if (cancelled) return;
        setPro(hasProEntitlement(info));
      })
      .catch(() => {
        /* fail soft — keep local state */
      });
    return () => {
      cancelled = true;
    };
  }, []);

  /** Re-check entitlement after a purchase completes (called from PaywallSheet). */
  const refreshProStatus = useCallback(async () => {
    if (!isPurchasesConfigured()) return;
    try {
      const info = await fetchCustomerInfo();
      setPro(hasProEntitlement(info));
    } catch {
      /* keep local state */
    }
  }, []);

  const payChips = useCallback((n: number, silent?: boolean) => {
    setChips((c) => Math.max(0, c + n));
    if (!silent) {
      deltaId.current += 1;
      setDelta({ id: deltaId.current, amount: n });
    }
  }, []);

  const recordBiggestPot = useCallback((pot: number) => {
    setBiggestPot((prev) => (pot > prev ? pot : prev));
  }, []);

  const completeLesson = useCallback((lessonId: string) => {
    setCompleted((prev) => {
      const next = new Set(prev);
      next.add(lessonId);
      return next;
    });
  }, []);

  /** Lose a life on a wrong answer. If this drops us below MAX, start the refill clock. */
  const loseLife = useCallback((): boolean => {
    let allowed = false;
    setLives((cur) => {
      if (cur >= MAX_LIVES) return cur;
      if (cur <= 0) {
        allowed = false;
        return 0;
      }
      allowed = true;
      const next = cur - 1;
      if (next < MAX_LIVES) setNextLifeAt(Date.now() + LIFE_REFILL_MS);
      return next;
    });
    return allowed;
  }, []);

  const addLife = useCallback(() => {
    setLives((cur) => {
      if (cur >= MAX_LIVES) {
        setNextLifeAt(null);
        return MAX_LIVES;
      }
      return cur + 1;
    });
  }, []);

  const refillAllLives = useCallback(() => {
    setLives(MAX_LIVES);
    setNextLifeAt(null);
  }, []);

  const recordHigh = useCallback((game: keyof ArenaHighs, score: number) => {
    let isBest = false;
    setHighs((prev) => {
      if (score > prev[game]) {
        isBest = true;
        return { ...prev, [game]: score };
      }
      return prev;
    });
    return isBest;
  }, []);

  const chargeToolUse = useCallback((): boolean => {
    if (pro) return true;
    if (usesLeft <= 0) return false;
    setUsesLeft((u) => u - 1);
    return true;
  }, [pro, usesLeft]);

  const claimDailyDrop = useCallback((): boolean => {
    if (dailyClaimed) return false;
    setDailyClaimed(true);
    payChips(500);
    return true;
  }, [dailyClaimed, payChips]);

  const openPaywall = useCallback((message?: string) => {
    setPaywallMessage(message ?? null);
    setPaywallVisible(true);
  }, []);

  const closePaywall = useCallback(() => {
    setPaywallVisible(false);
  }, []);

  /** Break the streak (called when a day is missed in future Supabase build). */
  const breakStreak = useCallback(() => {
    setStreakBroken(true);
  }, []);

  /** Pay chips to restore a broken streak — one-time per break. */
  const restoreStreak = useCallback((): boolean => {
    if (!streakBroken || streakRecoveredToday) return false;
    if (chips < STREAK_RECOVERY_COST) return false;
    setChips((c) => c - STREAK_RECOVERY_COST);
    setStreakBroken(false);
    setStreakRecoveredToday(true);
    return true;
  }, [streakBroken, streakRecoveredToday, chips]);

  const toggleHardMode = useCallback(() => {
    setHardMode((h) => !h);
  }, []);

  /** The Table unlocks after N completed lessons. */
  const tableUnlocked = completed.size >= TABLE_UNLOCK_LESSONS;

  return useMemo(
    () => ({
      chips,
      streak,
      streakBroken,
      streakRecoveredToday,
      completed,
      pro,
      setPro,
      usesLeft,
      biggestPot,
      highs,
      hardMode,
      dailyClaimed,
      delta,
      lives,
      nextLifeAt,
      tableUnlocked,
      paywallVisible,
      paywallMessage,
      payChips,
      completeLesson,
      recordHigh,
      chargeToolUse,
      claimDailyDrop,
      openPaywall,
      closePaywall,
      loseLife,
      addLife,
      refillAllLives,
      recordBiggestPot,
      breakStreak,
      restoreStreak,
      toggleHardMode,
      refreshProStatus,
    }),
    [chips, streak, streakBroken, streakRecoveredToday, completed, pro, usesLeft, biggestPot, highs, hardMode, dailyClaimed, delta, lives, nextLifeAt, tableUnlocked, paywallVisible, paywallMessage, payChips, completeLesson, recordHigh, chargeToolUse, claimDailyDrop, openPaywall, closePaywall, loseLife, addLife, refillAllLives, recordBiggestPot, breakStreak, restoreStreak, toggleHardMode, refreshProStatus],
  );
});
