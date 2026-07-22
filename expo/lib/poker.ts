/**
 * ChipIn poker engine — ported 1:1 from the prototype's dependency-free poker.js.
 * Card = { r: 2..14, s: 0..3 } (s: 0=♠ 1=♥ 2=♦ 3=♣)
 */

export interface Card {
  r: number;
  s: number;
}

export interface HandEval {
  cat: number;
  kick: number[];
  name: string;
}

export const RANK_NAMES: Record<number, string> = {
  2: "2", 3: "3", 4: "4", 5: "5", 6: "6", 7: "7", 8: "8", 9: "9",
  10: "10", 11: "J", 12: "Q", 13: "K", 14: "A",
};
export const RANK_WORDS: Record<number, string> = {
  2: "Twos", 3: "Threes", 4: "Fours", 5: "Fives", 6: "Sixes", 7: "Sevens",
  8: "Eights", 9: "Nines", 10: "Tens", 11: "Jacks", 12: "Queens", 13: "Kings", 14: "Aces",
};
export const RANK_WORD: Record<number, string> = {
  2: "Two", 3: "Three", 4: "Four", 5: "Five", 6: "Six", 7: "Seven",
  8: "Eight", 9: "Nine", 10: "Ten", 11: "Jack", 12: "Queen", 13: "King", 14: "Ace",
};

export const SUITS = ["♠", "♥", "♦", "♣"] as const;
export const isRedSuit = (s: number): boolean => s === 1 || s === 2;
export const cardKey = (c: Card): number => c.r * 4 + c.s;

/**
 * 7-card evaluator. Returns {cat, kick, name}; higher cat wins, then compare kick arrays.
 * cat: 8=straight flush, 7=quads, 6=full house, 5=flush, 4=straight,
 *      3=trips, 2=two pair, 1=pair, 0=high card
 */
export function evaluate(cards: Card[]): HandEval {
  const byRank: Record<number, number> = {};
  const bySuit: number[][] = [[], [], [], []];
  for (const c of cards) {
    byRank[c.r] = (byRank[c.r] || 0) + 1;
    bySuit[c.s].push(c.r);
  }
  const ranksDesc = Object.keys(byRank).map(Number).sort((a, b) => b - a);

  let flushSuit = -1;
  for (let s = 0; s < 4; s++) if (bySuit[s].length >= 5) flushSuit = s;

  const straightHigh = (ranks: number[]): number => {
    const set = new Set<number>(ranks);
    if (set.has(14)) set.add(1); // wheel
    for (let hi = 14; hi >= 5; hi--) {
      let ok = true;
      for (let k = 0; k < 5; k++) if (!set.has(hi - k)) { ok = false; break; }
      if (ok) return hi;
    }
    return 0;
  };

  if (flushSuit >= 0) {
    const sfHigh = straightHigh(bySuit[flushSuit]);
    if (sfHigh) {
      return {
        cat: 8, kick: [sfHigh],
        name: sfHigh === 14 ? "Royal Flush" : `Straight Flush, ${RANK_WORD[sfHigh]} high`,
      };
    }
  }

  const quads = ranksDesc.filter((r) => byRank[r] === 4);
  if (quads.length) {
    const q = quads[0];
    const kicker = ranksDesc.filter((r) => r !== q)[0];
    return { cat: 7, kick: [q, kicker], name: `Four of a Kind, ${RANK_WORDS[q]}` };
  }

  const trips = ranksDesc.filter((r) => byRank[r] === 3);
  const pairs = ranksDesc.filter((r) => byRank[r] === 2);
  if (trips.length && (trips.length > 1 || pairs.length)) {
    const t = trips[0];
    const p = trips.length > 1 ? trips[1] : pairs[0];
    return { cat: 6, kick: [t, p], name: `Full House, ${RANK_WORDS[t]} over ${RANK_WORDS[p]}` };
  }

  if (flushSuit >= 0) {
    const top5 = [...bySuit[flushSuit]].sort((a, b) => b - a).slice(0, 5);
    return { cat: 5, kick: top5, name: `Flush, ${RANK_WORD[top5[0]]} high` };
  }

  const st = straightHigh(ranksDesc);
  if (st) return { cat: 4, kick: [st], name: `Straight, ${RANK_WORD[st]} high` };

  if (trips.length) {
    const t = trips[0];
    const ks = ranksDesc.filter((r) => r !== t).slice(0, 2);
    return { cat: 3, kick: [t, ...ks], name: `Three of a Kind, ${RANK_WORDS[t]}` };
  }

  if (pairs.length >= 2) {
    const [p1, p2] = pairs;
    const kicker = ranksDesc.filter((r) => r !== p1 && r !== p2)[0];
    return { cat: 2, kick: [p1, p2, kicker], name: `Two Pair, ${RANK_WORDS[p1]} and ${RANK_WORDS[p2]}` };
  }

  if (pairs.length === 1) {
    const p = pairs[0];
    const ks = ranksDesc.filter((r) => r !== p).slice(0, 3);
    return { cat: 1, kick: [p, ...ks], name: `Pair of ${RANK_WORDS[p]}` };
  }

  return { cat: 0, kick: ranksDesc.slice(0, 5), name: `High Card, ${RANK_WORD[ranksDesc[0]]}` };
}

export function compareEval(a: HandEval, b: HandEval): number {
  if (a.cat !== b.cat) return a.cat - b.cat;
  for (let i = 0; i < Math.max(a.kick.length, b.kick.length); i++) {
    const d = (a.kick[i] || 0) - (b.kick[i] || 0);
    if (d) return d;
  }
  return 0;
}

export interface WhoWonPlayer {
  name: string;
  hole: Card[];
}

export interface WhoWonResult {
  winners: string[];
  tie: boolean;
  hand: string;
  evals: { name: string; hand: string }[];
}

/** players: [{name, hole:[c,c]}], board: [5 cards] */
export function whoWon(players: WhoWonPlayer[], board: Card[]): WhoWonResult {
  const evals = players.map((p) => ({ name: p.name, ev: evaluate([...p.hole, ...board]) }));
  let best = evals[0];
  for (const e of evals) if (compareEval(e.ev, best.ev) > 0) best = e;
  const winners = evals.filter((e) => compareEval(e.ev, best.ev) === 0).map((e) => e.name);
  return {
    winners,
    tie: winners.length > 1,
    hand: best.ev.name,
    evals: evals.map((e) => ({ name: e.name, hand: e.ev.name })),
  };
}

export interface OddsResult {
  winPct: number;
  tiePct: number;
  iters: number;
}

/**
 * Monte Carlo equity. hero: [2 cards], board: 0/3/4/5 cards, nOpponents: 1..8
 */
export function myOdds(hero: Card[], board: Card[], nOpponents: number, iters: number = 3000): OddsResult {
  const used = new Set<number>([...hero, ...board].map(cardKey));
  const deck: Card[] = [];
  for (let r = 2; r <= 14; r++)
    for (let s = 0; s < 4; s++)
      if (!used.has(r * 4 + s)) deck.push({ r, s });

  let wins = 0;
  let ties = 0;
  const need = 5 - board.length;

  for (let i = 0; i < iters; i++) {
    // partial Fisher-Yates for just the cards we need
    const drawCount = need + nOpponents * 2;
    for (let j = 0; j < drawCount; j++) {
      const k = j + Math.floor(Math.random() * (deck.length - j));
      [deck[j], deck[k]] = [deck[k], deck[j]];
    }
    const fullBoard = [...board, ...deck.slice(0, need)];
    const heroEv = evaluate([...hero, ...fullBoard]);
    let beaten = false;
    let tied = false;
    for (let o = 0; o < nOpponents; o++) {
      const opp = deck.slice(need + o * 2, need + o * 2 + 2);
      const d = compareEval(evaluate([...opp, ...fullBoard]), heroEv);
      if (d > 0) { beaten = true; break; }
      if (d === 0) tied = true;
    }
    if (!beaten) { if (tied) ties++; else wins++; }
  }
  return { winPct: (100 * wins) / iters, tiePct: (100 * ties) / iters, iters };
}

export type VerdictTone = "fire" | "good" | "mid" | "bad" | "dead";

export interface OddsVerdict {
  rating: string;
  tone: VerdictTone;
  text: string;
}

/** odds -> rating + plain-english explanation (the "friend explaining it" layer) */
export function oddsVerdict(winPct: number, nOpponents: number, boardLen: number): OddsVerdict {
  const fair = 100 / (nOpponents + 1);
  const edge = winPct / fair;
  const street = boardLen === 0 ? "preflop" : boardLen === 3 ? "on the flop" : boardLen === 4 ? "on the turn" : "on the river";
  const pl = nOpponents === 1 ? "player" : "players";
  if (edge >= 1.8) return {
    rating: "Crushing it", tone: "fire",
    text: `You're way ahead ${street}. Against ${nOpponents} ${pl} your fair share is ~${fair.toFixed(0)}% and you're at ${winPct.toFixed(0)}%. Bet for value — don't let them see cards for free.`,
  };
  if (edge >= 1.25) return {
    rating: "Ahead", tone: "good",
    text: `Solidly ahead of the field ${street} — ${winPct.toFixed(0)}% vs a fair share of ~${fair.toFixed(0)}%. Betting here is fine; just slow down if the board gets scary.`,
  };
  if (edge >= 0.85) return {
    rating: "Coin flip-ish", tone: "mid",
    text: `Right around your fair share (${winPct.toFixed(0)}% vs ~${fair.toFixed(0)}%). Pot odds decide this one — call small bets, fold to big pressure.`,
  };
  if (edge >= 0.5) return {
    rating: "Behind", tone: "bad",
    text: `Below your fair share ${street} (${winPct.toFixed(0)}% vs ~${fair.toFixed(0)}%). You need the right price to keep going — no hero calls.`,
  };
  return {
    rating: "Let it go", tone: "dead",
    text: `Only ${winPct.toFixed(0)}% against ${nOpponents} ${pl}. This is a fold in almost every spot. Save the chips for a better hand.`,
  };
}

/** Draw n random unused cards, mutating the used set. */
export function drawDeck(n: number, used: Set<number> = new Set()): Card[] {
  const cards: Card[] = [];
  while (cards.length < n) {
    const r = 2 + Math.floor(Math.random() * 13);
    const s = Math.floor(Math.random() * 4);
    const k = r * 4 + s;
    if (!used.has(k)) { used.add(k); cards.push({ r, s }); }
  }
  return cards;
}
