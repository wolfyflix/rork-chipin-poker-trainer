import createContextHook from "@nkzw/create-context-hook";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";

import { fetchCustomerInfo, hasProEntitlement, isPurchasesConfigured } from "@/lib/revenuecat";

/** YYYY-MM-DD for the local day. Used to bucket daily-goal XP. */
function todayKey(d: Date = new Date()): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

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

/** Daily goal — Duolingo-style. Earn at least this many XP per day. */
export const DAILY_GOAL_XP = 50;

/** XP award per correct lesson answer. */
export const XP_PER_CORRECT = 10;

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

  // Daily goal tracking — Duolingo-style. Persists the date bucket and XP earned that day.
  const [dailyXp, setDailyXp] = useState<number>(0);
  const [dailyDate, setDailyDate] = useState<string>(todayKey());
  const [dailyGoalMet, setDailyGoalMet] = useState<boolean>(false);
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

  /** Load persisted daily goal state on mount. Resets if the date bucket rolled over. */
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const raw = await AsyncStorage.getItem("@chipin_daily");
        if (cancelled || !raw) return;
        const parsed = JSON.parse(raw) as { date: string; xp: number; met: boolean };
        const today = todayKey();
        if (parsed.date === today) {
          setDailyDate(today);
          setDailyXp(parsed.xp);
          setDailyGoalMet(parsed.met);
        } else {
          // new day — reset
          setDailyDate(today);
          setDailyXp(0);
          setDailyGoalMet(false);
        }
      } catch {
        /* ignore */
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  /** Persist daily goal state whenever it changes. */
  useEffect(() => {
    AsyncStorage.setItem(
      "@chipin_daily",
      JSON.stringify({ date: dailyDate, xp: dailyXp, met: dailyGoalMet }),
    ).catch(() => {
      /* ignore */
    });
  }, [dailyDate, dailyXp, dailyGoalMet]);

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

  /** Award XP for a correct answer toward today's goal. Idempotent-ish by question id. */
  const awardXp = useCallback((amount: number = XP_PER_CORRECT) => {
    setDailyXp((prev) => {
      const next = prev + amount;
      if (next >= DAILY_GOAL_XP) setDailyGoalMet(true);
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
      dailyXp,
      dailyGoalMet,
      dailyGoal: DAILY_GOAL_XP,
      payChips,
      completeLesson,
      awardXp,
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
    [chips, streak, streakBroken, streakRecoveredToday, completed, pro, usesLeft, biggestPot, highs, hardMode, dailyClaimed, delta, lives, nextLifeAt, tableUnlocked, paywallVisible, paywallMessage, dailyXp, dailyGoalMet, payChips, completeLesson, awardXp, recordHigh, chargeToolUse, claimDailyDrop, openPaywall, closePaywall, loseLife, addLife, refillAllLives, recordBiggestPot, breakStreak, restoreStreak, toggleHardMode, refreshProStatus],
  );
});
