/**
 * ChipIn — Skill Check. A placement quiz that asks you questions from
 * total beginner (Fish) to literal professional (Pro) and puts you on
 * the right rung of the ladder.
 *
 * Format mirrors the curriculum: multiple choice with a friend-voice
 * feedback line for right and wrong. Questions are grouped by tier;
 * each run of the quiz samples 3 per tier (easiest → hardest).
 */
import type { ExampleHand } from "@/lib/curriculum";

export interface SkillQuestion {
  q: string;
  opts: string[];
  a: number;
  fb: { right: string; wrong: string };
  /** Optional visual example(s) rendered as cards above the options. */
  ex?: ExampleHand[];
}

export interface SkillTier {
  /** Index in the ladder. */
  id: number;
  /** Short badge name. */
  name: string;
  emoji: string;
  /** One-line description shown on the result screen. */
  blurb: string;
  /** Result-screen paragraph — what this tier actually means at the table. */
  detail: string;
  /** Which curriculum unit to recommend from here. */
  unitId: string;
  unitLabel: string;
  questions: SkillQuestion[];
}

/** Questions per tier sampled into one quiz run. */
export const QUESTIONS_PER_TIER = 3;

export const SKILL_TIERS: SkillTier[] = [
  {
    id: 0,
    name: "Fish",
    emoji: "🐟",
    blurb: "Total beginner — and that's fine",
    detail: "Everyone starts here, literally everyone. You're still locking in what beats what. The good news: this is the fastest the ladder ever climbs. Two weeks of lessons and this tier is behind you.",
    unitId: "u1",
    unitLabel: "Unit 1 — Preflop Basics",
    questions: [
      {
        q: "You're dealt two cards face down. Five cards land on the board. How do you make your final hand?",
        opts: [
          "Best 5 cards from your 2 + the board's 5 — you can use none, one, or both of yours",
          "Exactly 2 from your hand, always",
          "Exactly 3 from the board, always",
          "All 7 cards count together",
        ],
        a: 0,
        fb: {
          right: "Yep — best 5 of 7. That's why a pair on the board can carry you even when your hole cards missed.",
          wrong: "It's always best 5 of 7. You can 'play the board' — use zero of your cards — if the board itself makes your best hand.",
        },
      },
      {
        q: "You hold 8♦7♣ and the board runs out 6♠5♥9♦K♣2♠. What's your best hand?",
        ex: [
          { label: "You", cards: [{ r: 8, s: 2 }, { r: 7, s: 3 }], caption: "Your hole cards." },
          { label: "Board", cards: [{ r: 6, s: 0 }, { r: 5, s: 1 }, { r: 9, s: 2 }, { r: 13, s: 3 }, { r: 2, s: 0 }], caption: "Five community cards." },
        ],
        opts: ["A straight — five through nine", "Two pair", "A pair of nines", "Nothing — king high"],
        a: 0,
        fb: {
          right: "5-6-7-8-9, a straight. Your 8-7 slid right into the middle of the board.",
          wrong: "Look again: 5, 6, 7, 8, 9 — five in a row. A straight. This is why you always scan the board for runs before mucking.",
        },
      },
      {
        q: "What is 'the button'?",
        opts: [
          "The dealer position — acts LAST on every street after the flop",
          "The player with the biggest stack",
          "The minimum bet",
          "A special card the dealer burns",
        ],
        a: 0,
        fb: {
          right: "The button acts last after the flop — seeing everyone else move first is the best seat in the house.",
          wrong: "The button is the dealer seat, and acting last is a huge edge. Whoever's 'on the button' gets to watch the whole hand unfold first.",
        },
      },
      {
        q: "What's a 'blind'?",
        opts: [
          "A forced bet posted before any cards are dealt",
          "A hand played without looking at your cards",
          "An all-in made face down",
          "A fee for joining a home game",
        ],
        a: 0,
        fb: {
          right: "Small blind and big blind go in before the cards are dealt — they're why there's always money to fight over.",
          wrong: "Blinds are forced bets posted pre-deal (small + big). They seed every pot so nobody can just wait for aces all night.",
        },
      },
      {
        q: "Which pair of hole cards would you rather start with?",
        ex: [
          { label: "Hand A", cards: [{ r: 14, s: 1 }, { r: 14, s: 3 }], caption: "Pocket aces." },
          { label: "Hand B", cards: [{ r: 13, s: 0 }, { r: 12, s: 2 }], caption: "King-queen offsuit." },
        ],
        opts: ["Hand A — pocket aces", "Hand B — two big cards", "They're identical", "Depends on the day"],
        a: 0,
        fb: {
          right: "Aces, always. Pocket pairs — especially aces — start life way ahead of two unpaired cards.",
          wrong: "Pocket aces is the best starting hand in Hold'em. Two unpaired cards (even kings and queens) are behind any pocket pair of similar size.",
        },
      },
    ],
  },
  {
    id: 1,
    name: "Casual",
    emoji: "🎒",
    blurb: "You know the rules — now learn the game",
    detail: "You can play, follow the action, and win the odd pot. But your decisions run on instinct. This is the tier where you stop playing your cards and start playing positions, prices, and people.",
    unitId: "u1",
    unitLabel: "Unit 1 — Preflop Basics",
    questions: [
      {
        q: "Why is acting last (in position) such a big advantage?",
        opts: [
          "You see what everyone else did before you have to decide",
          "You get dealt better cards in late position",
          "The pot is smaller when you act last",
          "It's just superstition — position doesn't matter",
        ],
        a: 0,
        fb: {
          right: "Information is money. Acting last means every decision is easier — you already know what you're up against.",
          wrong: "Position is information. Acting last, you know if they bet, checked, or raised BEFORE you choose — and that extra info turns marginal hands into easy decisions.",
        },
      },
      {
        q: "Your buddy plays literally every hand — 8-3 offsuit, J-4 suited, all of it. Why does he bleed chips long-term?",
        opts: [
          "Weak starting hands are playing from behind — they rarely connect and rarely win at showdown",
          "He's just unlucky",
          "He doesn't bluff enough",
          "Poker is pure luck, so it evens out",
        ],
        a: 0,
        fb: {
          right: "Trash hands start the race losing. He's paying the same blinds you are for way worse cards.",
          wrong: "It's not luck — 8-3 offsuit flops garbage the vast majority of the time. Playing everything means paying for cards that almost never improve.",
        },
      },
      {
        q: "You flopped top pair with K♠Q♠ on a K♦7♥2♣ board. Your opponent bets half the pot. What's the standard play?",
        ex: [
          { label: "You", cards: [{ r: 13, s: 0 }, { r: 12, s: 0 }], caption: "Your hole cards." },
          { label: "Board", cards: [{ r: 13, s: 2 }, { r: 7, s: 1 }, { r: 2, s: 3 }], caption: "You have top pair, queen kicker." },
        ],
        opts: [
          "Bet or raise for value — top pair is usually ahead of a calling range here",
          "Fold immediately — they clearly have a set",
          "Check-fold forever, never put money in",
          "Flip your cards face up to end the hand",
        ],
        a: 0,
        fb: {
          right: "Top pair good kicker wants value. Most of the time you're ahead of second pairs, draws, and ace-high.",
          wrong: "Top pair is usually good here. You fold it when the board gets scary or the pressure ramps up — but a half-pot bet on K72? You're raising, not folding.",
        },
      },
      {
        q: "What's a 'kicker'?",
        opts: [
          "The side card that breaks ties when two players have the same hand rank",
          "The last card dealt on the river",
          "A bonus bet on the flop",
          "The card that makes you fold",
        ],
        a: 0,
        fb: {
          right: "Same pair? The higher unpaired card wins. AK vs KQ on a king board — the ace kicker is the whole pot.",
          wrong: "When two players make the same hand rank, the best unused card decides it. That's why AK is worth so much more than KJ — the kicker wins the tie.",
        },
      },
      {
        q: "When does a bluff work best?",
        opts: [
          "When your story is believable — the board is scary for their range and they can hold little",
          "Any time, against anyone, always",
          "Only against total beginners",
          "Never bluff in home games — house rule",
        ],
        a: 0,
        fb: {
          right: "Bluffs work when the board punishes their range. Betting big on an ace-high board when you can only hold aces and they can't? That's printing.",
          wrong: "A bluff needs a story. If the board is full of cards that fit YOUR range and not theirs, they fold — that's the whole trick.",
        },
      },
    ],
  },
  {
    id: 2,
    name: "Regular",
    emoji: "🎰",
    blurb: "Solid fundamentals — you do the math",
    detail: "You know pot odds, outs, and why position pays. You're a winning home-game player. What separates you from the sharks is range thinking — reading the board for what it means, not just what it gives you.",
    unitId: "u2",
    unitLabel: "Unit 2 — Pot Odds",
    questions: [
      {
        q: "You have a flush draw on the flop — 9 clean outs. Using the rule of 2 and 4, roughly how often do you hit by the river?",
        opts: ["~36% — outs × 4 with two cards to come", "~9%", "~50%", "~75%"],
        a: 0,
        fb: {
          right: "9 × 4 = 36% by the river (9 × 2 = 18% on the next street only). The rule of 2 and 4 is the fastest math in poker.",
          wrong: "Rule of 4: outs × 4 with two cards to come → 9 × 4 = ~36%. (Exactly it's 35%, but the rule gets you close enough in real time.)",
        },
      },
      {
        q: "The pot is 100 and your opponent bets 50. What price are you getting on a call, and what equity do you need?",
        opts: [
          "150-to-50 — 3-to-1, so you need about 25% equity",
          "50-to-100 — 1-to-2, so you need 66% equity",
          "Even money — you need 50% equity",
          "100-to-50 — 2-to-1, so you need 33% equity",
        ],
        a: 0,
        fb: {
          right: "Call 50 to win 150 → 3-to-1 → 50 / (150 + 50) = 25%. If your draw hits more than a quarter of the time, the call prints.",
          wrong: "Pot + bet = 150, and you risk 50 to win it. That's 3-to-1, which you break even on with 50/200 = 25% equity.",
        },
      },
      {
        q: "You're first to act before the flop, nine-handed (under the gun). Which hand is a standard open?",
        opts: ["A pair of nines", "7-2 offsuit", "K-3 offsuit", "Q-8 offsuit"],
        a: 0,
        fb: {
          right: "From early position you need hands that win against SIX players who act after you. 99 clears that bar; Q-8 and K-3 don't.",
          wrong: "Early position = more players to act after you = stronger range required. 99 is a standard UTG open; Q-8 offsuit gets run over by everyone behind.",
        },
      },
      {
        q: "You raise with A♦K♦, the big blind calls, and the flop comes K♥9♣4♠. He checks. Why is betting here standard?",
        opts: [
          "You likely have the best hand AND worse kings, nines, and ace-high will call — value plus protection",
          "Pure bluff — you actually missed",
          "Just to 'see where you stand' with zero downside",
          "Because the pot is too small to matter",
        ],
        a: 0,
        fb: {
          right: "You have top pair top kicker. Worse kings call, draws call, and betting denies them a free card. This is textbook value-plus-protection.",
          wrong: "You DID hit — pair of kings, top kicker. This is a value bet: worse hands call, and you don't want draws seeing free cards.",
        },
      },
      {
        q: "Set mining: you have 5♠5♥, a loose aggressive player re-raises, and you both have 200 behind. Why is calling the standard play?",
        opts: [
          "Implied odds — if you flop a set, you can win his entire stack",
          "Small pairs are favorites against big pairs pre-flop",
          "Because re-raises mean the raiser is bluffing",
          "Sets win every hand, always",
        ],
        a: 0,
        fb: {
          right: "You'll flop a set ~12% of the time, but when you do, a stack-sized pot is coming your way. Calling 30 to win 200+ is the whole play.",
          wrong: "You're calling for implied odds. Fives flop a set rarely — but when they do, you're stacking the guy who re-raised with AK. Small call, huge payoff.",
        },
      },
    ],
  },
  {
    id: 3,
    name: "Shark",
    emoji: "🦈",
    blurb: "You play ranges, not cards",
    detail: "You think in ranges, size bets by board texture, and know what blockers do. You're the one the home game is scared of. From here it's solver-level refinement — frequencies, equilibrium, and exploit trees.",
    unitId: "u3",
    unitLabel: "Unit 3 — Reading the Board",
    questions: [
      {
        q: "What is a 'range' in modern poker?",
        opts: [
          "The set of all hands a player could reasonably hold, given how they've played so far",
          "Your emotional state at the table",
          "The seating chart",
          "A series of raises back and forth",
        ],
        a: 0,
        fb: {
          right: "Nobody has a hand until the river — they have a range. Every action narrows it, and winning poker is attacking what's left.",
          wrong: "A range is every hand that fits their story. When you bet, you're not beating 'their hand' — you're beating the range of hands they'd play this way.",
        },
      },
      {
        q: "You continuation-bet the flop. Which board gets the SMALL bet at high frequency?",
        opts: [
          "A♠7♦2♣ — the dry board, where their range has very few honest continues",
          "9♥8♣7♥ — the wet board full of draws",
          "Never small-bet either",
          "Identical strategy on both",
        ],
        a: 0,
        fb: {
          right: "On A72 they can't have much — small and frequent prints. On 987 their range is loaded with draws and pairs that fight back, so size up or check.",
          wrong: "Dry boards crush their range, so tiny bets work at max frequency. Wet boards hit the caller's range too — there you need bigger, more careful sizing.",
        },
      },
      {
        q: "What's a 'blocker'?",
        opts: [
          "A card in your hand that makes it less likely the opponent has their strongest hand — like holding the A♠ when bluffing at a flush board",
          "A card the dealer burns",
          "A seat reserved for a big stack",
          "A bad-beat jackpot rule",
        ],
        a: 0,
        fb: {
          right: "Holding the A♠ means they can't have the nut flush. Your 'bad' ace becomes a weapon exactly when it looks worthless.",
          wrong: "Blockers are card-removal logic. Holding one of their key cards makes their big hand less likely — which is why pros bluff with aces they can't even show down.",
        },
      },
      {
        q: "Stack-to-pot ratio (SPR) is 2 and you flopped top pair with a good kicker. What's the plan?",
        opts: [
          "Get the chips in — at SPR 2 you're essentially never folding top pair",
          "Fold to any significant bet",
          "Check down to keep the pot small, always",
          "Only min-raise, never more",
        ],
        a: 0,
        fb: {
          right: "SPR 2 means the money's going in with one more bet. Top pair is plenty — commit, and let the math do the arguing.",
          wrong: "Low SPR is pre-committed money. With top pair at SPR 2, folding is a leak — you're getting the stack in and only worried about the rare board runout.",
        },
      },
      {
        q: "What is 'range advantage'?",
        opts: [
          "One player's whole range connects with the board better than the other's, so they can bet more aggressively",
          "Having the bigger chip stack",
          "Being on the button",
          "A casino promotion",
        ],
        a: 0,
        fb: {
          right: "On low boards the preflop raiser's range smashes it. That advantage justifies betting nearly 100% of the time at small sizes.",
          wrong: "It's not about your hand — it's whose range fits the board. When it's yours, you can bet more often; when it's theirs, you proceed carefully.",
        },
      },
    ],
  },
  {
    id: 4,
    name: "Pro",
    emoji: "🎩",
    blurb: "Solver-certified — equilibrium and exploits",
    detail: "You speak frequencies. MDF, polarization, ICM pressure, blocker-based bluffing — this is where the game stops being cards and becomes applied game theory. Very few players honestly live here.",
    unitId: "u4",
    unitLabel: "Unit 4 — Reading People",
    questions: [
      {
        q: "Villain bets pot on the river. What's your minimum defense frequency (MDF) to stay unexploitable?",
        opts: [
          "50% — call with half your range; fold the rest",
          "33% of your range",
          "67% of your range",
          "100% — never fold the river",
        ],
        a: 0,
        fb: {
          right: "MDF = pot / (pot + bet) = 100 / 200 = 50%. Fold more than half and their bluffs mint money; that's the whole exploit tree.",
          wrong: "Against a pot-sized bet you must defend 100/(100+100) = 50%. Overfold and they can profitably bluff every single time.",
        },
      },
      {
        q: "At equilibrium, roughly how much of a pot-sized RIVER betting range should be bluffs?",
        opts: [
          "~1 in 3 — two value hands for every one bluff",
          "~1 in 20",
          "Half — even split",
          "Zero — equilibrium never bluffs",
        ],
        a: 0,
        fb: {
          right: "Pot-sized bet risks 100 to win 100, so it needs to work 50% — which prices in a 2:1 value-to-bluff ratio. That's why pros seem to bluff 'too much.'",
          wrong: "A pot-sized bluff succeeds 50% of the time break-even, so equilibrium balances it: two value combos per bluff. About a third of the betting range.",
        },
      },
      {
        q: "You're on the bubble of a tournament with a medium stack and the chip leader shoves. Why does ICM say folding A-J is often correct?",
        opts: [
          "Losing the flip costs you more real-money equity than the chips are worth",
          "A-J loses to most shoving ranges",
          "The chip leader always wins flips",
          "ICM only applies at the final table",
        ],
        a: 0,
        fb: {
          right: "ICM: chips won are worth less than chips lost. Bubble time, your stack's survival value outweighs the flip's chip equity — fold and let others bust.",
          wrong: "It's not the cards — it's the money. On the bubble, a lost flip can zero your payout while the win barely moves it. That asymmetry makes folds that feel wild correct.",
        },
      },
      {
        q: "Board has three spades, villain shoves. Why is calling with Q♠J♦ better than calling with Q♦J♠ — same hand strength?",
        opts: [
          "The Q♠ blocks their made spade flushes — one fewer spade out there for them",
          "The Q♠ is worth more points",
          "Spades are statistically lucky",
          "They're identical — no difference",
        ],
        a: 0,
        fb: {
          right: "Card removal: holding the Q♠ removes a spade from their possible flushes. Same-looking hand, meaningfully different equity. This is pro-level blocker logic.",
          wrong: "The Q♠ means one fewer spade villain can hold. Your hand 'blocks' their flush — same rank pair, different equity. Blockers decide river calls at high stakes.",
        },
      },
      {
        q: "What does it mean when solvers 'mix' — taking different actions in the SAME spot?",
        opts: [
          "Multiple actions at specific frequencies, so no counter-strategy can exploit you",
          "The solver crashed and is guessing",
          "Mixing means always shoving",
          "It's noise — solvers always have one answer",
        ],
        a: 0,
        fb: {
          right: "Equilibrium is often a frequency — raise this combo 70%, call it 30%. Indifference is the point: there's nothing to attack.",
          wrong: "Mixing is deliberate indifference. If the solver calls 70% and raises 30% with the same hand, any read you make on one action gets punished by the other.",
        },
      },
    ],
  },
];

export interface AssessmentQuestion extends SkillQuestion {
  tier: number;
}

/** Shuffle a copy of an array (Fisher–Yates). */
function shuffled<T>(arr: T[]): T[] {
  const out = [...arr];
  for (let i = out.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [out[i], out[j]] = [out[j], out[i]];
  }
  return out;
}

/**
 * Build one run of the quiz: QUESTIONS_PER_TIER sampled from each tier,
 * easiest ladder rung first. Fresh questions on every retake.
 */
export function buildAssessment(): AssessmentQuestion[] {
  const run: AssessmentQuestion[] = [];
  for (const tier of SKILL_TIERS) {
    for (const q of shuffled(tier.questions).slice(0, QUESTIONS_PER_TIER)) {
      run.push({ ...q, tier: tier.id });
    }
  }
  return run;
}

export interface PlacementResult {
  /** Placed tier id (0–4). */
  tier: number;
  /** Correct count per tier index. */
  correctByTier: number[];
  total: number;
  totalCorrect: number;
}

/**
 * Placement: the user's level is the HIGHEST tier where they got at
 * least 2 of 3 right. Clean fail of tier 0 still lands on Fish —
 * the floor is the floor. Answers are in run order (3 per tier).
 */
export function computePlacement(answers: boolean[]): PlacementResult {
  const correctByTier = SKILL_TIERS.map((_, t) => {
    const slice = answers.slice(t * QUESTIONS_PER_TIER, (t + 1) * QUESTIONS_PER_TIER);
    return slice.filter(Boolean).length;
  });
  let tier = 0;
  for (let t = 0; t < SKILL_TIERS.length; t++) {
    if (correctByTier[t] >= 2) tier = t;
  }
  return {
    tier,
    correctByTier,
    total: answers.length,
    totalCorrect: answers.filter(Boolean).length,
  };
}
