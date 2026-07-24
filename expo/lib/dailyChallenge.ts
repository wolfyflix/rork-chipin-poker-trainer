import { Card, evaluate, myOdds } from "./poker";

/**
 * Daily Challenge — one deterministic poker scenario per day.
 * Uses a seeded PRNG based on the date so every player gets the same
 * challenge on the same day.
 */

export interface DailyChallenge {
  date: string;
  hero: Card[];
  board: Card[];
  heroName: string;
  winPct: number;
  pot: number;
  oppBet: number;
  // 0 = fold, 1 = call, 2 = raise
  correct: 0 | 1 | 2;
  explanation: string;
  options: { label: string; value: 0 | 1 | 2 }[];
}

/** Mulberry32 seeded PRNG — deterministic per seed. */
function mulberry32(seed: number): () => number {
  let a = seed;
  return () => {
    a |= 0;
    a = (a + 0x6D2B79F5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** YYYY-MM-DD for a date. */
function dateKey(d: Date = new Date()): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

/** Seed from a date string. */
function seedFromDate(date: string): number {
  let h = 0;
  for (let i = 0; i < date.length; i++) {
    h = (Math.imul(31, h) + date.charCodeAt(i)) | 0;
  }
  return Math.abs(h);
}

/** Pick n distinct cards from a fresh deck using the PRNG. */
function dealCards(rng: () => number, n: number, used: Set<number>): Card[] {
  const cards: Card[] = [];
  while (cards.length < n) {
    const r = 2 + Math.floor(rng() * 13);
    const s = Math.floor(rng() * 4);
    const k = r * 4 + s;
    if (!used.has(k)) {
      used.add(k);
      cards.push({ r, s });
    }
  }
  return cards;
}

/**
 * Generate today's daily challenge deterministically from the date.
 * Same date = same challenge for every player.
 */
export function getTodayChallenge(): DailyChallenge {
  const date = dateKey();
  const seed = seedFromDate(date);
  const rng = mulberry32(seed);

  const used = new Set<number>();
  // Board: 3 or 4 cards (flop or turn)
  const boardLen = 3 + Math.floor(rng() * 2);
  const board = dealCards(rng, boardLen, used);
  const hero = dealCards(rng, 2, used);

  const heroEv = evaluate([...hero, ...board]);
  const odds = myOdds(hero, board, 1, 800);
  const winPct = odds.winPct;

  const pot = [100, 150, 200, 250, 300][Math.floor(rng() * 5)];
  const betFraction = [0.33, 0.5, 0.75, 1][Math.floor(rng() * 4)];
  const oppBet = Math.round(pot * betFraction);

  let correct: 0 | 1 | 2;
  let explanation: string;

  if (winPct >= 62) {
    correct = 2;
    explanation = `You have ${heroEv.name} with ~${winPct.toFixed(0)}% equity — you're ahead. Raise for value and build the pot.`;
  } else if (winPct >= 35) {
    correct = 1;
    explanation = `~${winPct.toFixed(0)}% equity with ${heroEv.name}. The price is okay — call and see the next card, but don't overcommit.`;
  } else {
    correct = 0;
    explanation = `Only ~${winPct.toFixed(0)}% with ${heroEv.name}. You're behind — fold and save your chips for a better spot.`;
  }

  return {
    date,
    hero,
    board,
    heroName: heroEv.name,
    winPct,
    pot,
    oppBet,
    correct,
    explanation,
    options: [
      { label: "Fold", value: 0 },
      { label: "Call", value: 1 },
      { label: "Raise", value: 2 },
    ],
  };
}

/** Check if the user has already completed today's challenge. */
export function isChallengeDone(doneDates: string[]): boolean {
  return doneDates.includes(dateKey());
}

/** Get the number of consecutive days the challenge was completed. */
export function getChallengeStreak(doneDates: string[]): number {
  if (doneDates.length === 0) return 0;
  const sorted = [...doneDates].sort().reverse();
  let streak = 0;
  let cursor = new Date();
  for (const d of sorted) {
    const dk = dateKey(cursor);
    if (d === dk) {
      streak++;
      cursor = new Date(cursor.getTime() - 86400000);
    } else {
      break;
    }
  }
  return streak;
}
