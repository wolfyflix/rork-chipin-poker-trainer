/**
 * ChipIn — curriculum v4. Ported from the prototype and expanded.
 * Voice rule: your friend who's good at poker, never a textbook.
 * Question types: default = multiple choice {q, opts, a, fb, ex?}
 *   {t:'duel'}   = runtime-generated "which hand wins" (uses real evaluator)
 *   {t:'outs', idx:n} = count-the-outs from OUTS_SCENARIOS
 *   {t:'board'}  = runtime-generated "beat the board" (am I ahead of a random opponent?)
 *   {t:'name'}   = runtime-generated "name that hand"
 *   {t:'move'}   = runtime-generated "bet or fold"
 * Each lesson now opens with a `primer` — a short visual tutorial with example hands.
 */
import type { Card } from "@/lib/poker";

/** A visual example hand shown in a primer block or beside an MC question. */
export interface ExampleHand {
  /** Optional label, e.g. "You", "Board", "Hand A". */
  label?: string;
  cards: Card[];
  /** One-line caption explaining what this hand shows. */
  caption: string;
}

/** A section inside a primer — heading + paragraph + optional example hands. */
export interface PrimerBlock {
  h: string;
  p: string;
  ex?: ExampleHand[];
}

/** The tutorial shown before a lesson's questions begin. */
export interface Primer {
  tagline: string;
  blocks: PrimerBlock[];
}

export interface MCQuestion {
  t?: undefined;
  q: string;
  opts: string[];
  a: number;
  fb: { right: string; wrong: string };
  /** Optional example hand(s) to visualize the scenario. */
  ex?: ExampleHand[];
}
export interface DuelQuestion { t: "duel" }
export interface OutsQuestion { t: "outs"; idx: number }
export interface BoardQuestion { t: "board" }
/** Name That Hand — runtime-generated. 5 cards shown, pick the correct hand name. */
export interface NameQuestion { t: "name" }
/** Bet or Fold — runtime-generated. Hero + board + pot + opponent bet → pick Fold/Call/Raise. */
export interface MoveQuestion { t: "move" }
export type Question = MCQuestion | DuelQuestion | OutsQuestion | BoardQuestion | NameQuestion | MoveQuestion;

export interface Lesson {
  id: string;
  title: string;
  boss?: boolean;
  /** Visual tutorial shown before the questions. Required for every lesson. */
  primer: Primer;
  questions: Question[];
}

export interface Unit {
  id: string;
  title: string;
  emoji: string;
  free: boolean;
  /** Base chip reward for a perfect lesson. Checkpoints pay 2x. Wrong answers scale this down (0.4x floor). */
  reward: number;
  tagline: string;
  lessons: Lesson[];
}

export interface OutsScenario {
  hand: Card[];
  board: Card[];
  outs: number;
  why: string;
}

export const OUTS_SCENARIOS: OutsScenario[] = [
  { hand: [{ r: 14, s: 1 }, { r: 9, s: 1 }], board: [{ r: 12, s: 1 }, { r: 7, s: 1 }, { r: 2, s: 0 }], outs: 9, why: "Flush draw: 13 hearts − your 4 = 9 outs." },
  { hand: [{ r: 9, s: 0 }, { r: 8, s: 2 }], board: [{ r: 7, s: 1 }, { r: 6, s: 3 }, { r: 2, s: 0 }], outs: 8, why: "Open-ended: four 10s + four 5s = 8 outs." },
  { hand: [{ r: 14, s: 0 }, { r: 13, s: 2 }], board: [{ r: 9, s: 1 }, { r: 6, s: 3 }, { r: 2, s: 0 }], outs: 6, why: "Two overcards: three aces + three kings = 6 outs." },
  { hand: [{ r: 11, s: 0 }, { r: 10, s: 0 }], board: [{ r: 9, s: 0 }, { r: 8, s: 1 }, { r: 2, s: 0 }], outs: 15, why: "Straight (8) + flush (9) − the 2 spades counted twice = 15 outs. Monster draw." },
  { hand: [{ r: 5, s: 1 }, { r: 5, s: 3 }], board: [{ r: 12, s: 0 }, { r: 9, s: 1 }, { r: 2, s: 2 }], outs: 2, why: "Need a 5: only 2 left. Set-mining is a long shot after the flop." },
  { hand: [{ r: 12, s: 1 }, { r: 11, s: 1 }], board: [{ r: 10, s: 1 }, { r: 9, s: 0 }, { r: 3, s: 2 }], outs: 17, why: "Flush (9) + straight (8, the K♥ and 8♥ already counted) = 17. The dream draw." },
  { hand: [{ r: 8, s: 1 }, { r: 7, s: 1 }], board: [{ r: 6, s: 1 }, { r: 5, s: 2 }, { r: 2, s: 0 }], outs: 8, why: "Open-ended: four 9s + four 4s = 8 outs. (Plus the flush draw is hidden equity.)" },
  { hand: [{ r: 10, s: 1 }, { r: 9, s: 1 }], board: [{ r: 8, s: 1 }, { r: 2, s: 0 }, { r: 5, s: 3 }], outs: 9, why: "Flush draw: 13 hearts − 4 = 9 outs. (No straight draw — gap between 9 and 5.)" },
  { hand: [{ r: 13, s: 0 }, { r: 12, s: 0 }], board: [{ r: 11, s: 1 }, { r: 10, s: 2 }, { r: 8, s: 3 }], outs: 4, why: "Gutshot: only the four Qs complete the straight. 4 outs, ~16% by the river." },
  { hand: [{ r: 14, s: 2 }, { r: 14, s: 3 }], board: [{ r: 12, s: 0 }, { r: 7, s: 1 }, { r: 4, s: 2 }], outs: 2, why: "Pocket aces → set: only two remaining aces. 2 outs, but flopping top set is worth chasing cheaply." },
];

export const CURRICULUM: Unit[] = [
  {
    id: "u1", title: "Preflop Basics", emoji: "🂡", free: true, reward: 100,
    tagline: "Stop playing every hand. Seriously.",
    lessons: [
      { id: "u1l1", title: "Hand Rankings",
        primer: {
          tagline: "The 10 hands that decide who wins at showdown.",
          blocks: [
            { h: "The ladder, best to worst",
              p: "Poker hands rank in a fixed order. Memorize it once, use it forever. Top to bottom: Royal Flush → Straight Flush → Four of a Kind → Full House → Flush → Straight → Three of a Kind → Two Pair → One Pair → High Card.",
              ex: [
                { label: "Royal Flush", cards: [{ r: 14, s: 0 }, { r: 13, s: 0 }, { r: 12, s: 0 }, { r: 11, s: 0 }, { r: 10, s: 0 }], caption: "10-J-Q-K-A, all one suit. Unbeatable." },
                { label: "Straight Flush", cards: [{ r: 9, s: 1 }, { r: 8, s: 1 }, { r: 7, s: 1 }, { r: 6, s: 1 }, { r: 5, s: 1 }], caption: "Five in a row, same suit." },
                { label: "Four of a Kind", cards: [{ r: 8, s: 0 }, { r: 8, s: 1 }, { r: 8, s: 2 }, { r: 8, s: 3 }, { r: 13, s: 0 }], caption: "All four of one rank + a kicker." },
              ] },
            { h: "Pairs beat no-pair, every time",
              p: "A pair, even a small one, beats ace-high. People lose dorm games by overvaluing 'ace high' when someone paired a 3. Two pair beats one pair; trips beat two pair.",
              ex: [
                { label: "You", cards: [{ r: 13, s: 0 }, { r: 13, s: 2 }], caption: "Pair of kings." },
                { label: "Him", cards: [{ r: 14, s: 1 }, { r: 12, s: 1 }], caption: "Ace high — loses to any pair." },
              ] },
            { h: "The wheel: ace plays low too",
              p: "A straight is five in a row. The ace can be the LOW end: A-2-3-4-5 (\"the wheel\"). It cannot wrap around — Q-K-A-2-3 is NOT a straight.",
              ex: [
                { label: "The Wheel", cards: [{ r: 14, s: 2 }, { r: 2, s: 2 }, { r: 3, s: 2 }, { r: 4, s: 2 }, { r: 5, s: 2 }], caption: "A-2-3-4-5. Legal straight (and a straight flush here)." },
              ] },
          ],
        },
        questions: [
        { q: "Which hand wins at showdown?", opts: ["Flush", "Straight", "Two Pair", "Three of a Kind"], a: 0,
          ex: [{ label: "Board", cards: [{ r: 7, s: 1 }, { r: 4, s: 1 }, { r: 9, s: 1 }, { r: 2, s: 0 }, { r: 13, s: 3 }], caption: "Three hearts on the board." }],
          fb: { right: "Yep — flush beats a straight. Five of the same suit > five in a row.", wrong: "Flush wins. Order at the top: straight < flush < full house < quads < straight flush." } },
        { q: "You have K♠K♦. Your buddy flips A♥Q♥ and the board is all low cards, no hearts. Who wins?", opts: ["You — pair of kings", "Him — ace high", "Split pot", "Depends on kickers"], a: 0,
          ex: [
            { label: "You", cards: [{ r: 13, s: 0 }, { r: 13, s: 1 }], caption: "Pocket kings." },
            { label: "Him", cards: [{ r: 14, s: 1 }, { r: 12, s: 1 }], caption: "Ace-queen suited." },
            { label: "Board", cards: [{ r: 9, s: 2 }, { r: 6, s: 3 }, { r: 4, s: 0 }, { r: 2, s: 3 }, { r: 7, s: 0 }], caption: "All low, no hearts, no help for AQ." },
          ],
          fb: { right: "A pair beats no pair, every time. Ace-high only wins when nobody has anything.", wrong: "Any pair beats any high card. His AQ missed everything — your kings are good." } },
        { q: "Board: 9♣9♦9♠2♥2♦. You hold A♣K♣. What do you actually have?", opts: ["Full house, nines over twos", "Three of a kind", "Two pair", "Nothing, ace high"], a: 0,
          ex: [
            { label: "Board", cards: [{ r: 9, s: 0 }, { r: 9, s: 1 }, { r: 9, s: 2 }, { r: 2, s: 1 }, { r: 2, s: 2 }], caption: "The board itself is a full house." },
            { label: "You", cards: [{ r: 14, s: 0 }, { r: 13, s: 0 }], caption: "Your ace-king — you 'play the board.'" },
          ],
          fb: { right: "The board IS a full house — everyone has at least nines full. Your ace only matters vs someone who can't beat the board.", wrong: "The board itself is a full house (999 + 22). You \"play the board\" — best 5 cards from your 2 + the 5 on the table." } },
        { q: "True or false: three of a kind beats two pair.", opts: ["True", "False"], a: 0,
          fb: { right: "Trips > two pair. People mess this up in dorm games constantly — now you're the one who knows.", wrong: "Trips beat two pair, always. Two pair FEELS strong but it's below trips on the ladder." } },
        { q: "A straight can go A-2-3-4-5 (\"the wheel\"). Can it also wrap around, like Q-K-A-2-3?", opts: ["No — around-the-corner straights aren't real", "Yes, any 5 in a row counts", "Only in tournaments", "Only if suited"], a: 0,
          ex: [{ label: "Not a straight", cards: [{ r: 12, s: 0 }, { r: 13, s: 1 }, { r: 14, s: 2 }, { r: 2, s: 3 }, { r: 3, s: 0 }], caption: "Q-K-A-2-3 = nothing." }],
          fb: { right: "The wheel is the ONLY time ace plays low. Q-K-A-2-3 is a classic dorm-game fake rule — it's nothing.", wrong: "Wrap-around straights don't exist. Ace plays high (10-J-Q-K-A) or low (A-2-3-4-5), never the middle of a wrap." } },
        { q: "Two players both have a straight, 5-6-7-8-9. One used the 9 from his hand, the other used a higher kicker. Who wins?", opts: ["Split — same 5-card hand", "The one with the 9 in hand", "Whoever bet first", "Whoever has more chips"], a: 0,
          ex: [{ label: "Both made", cards: [{ r: 5, s: 0 }, { r: 6, s: 1 }, { r: 7, s: 2 }, { r: 8, s: 3 }, { r: 9, s: 0 }], caption: "Same 5-card straight = split pot." }],
          fb: { right: "It's the best 5 cards that count — if both made the exact same straight, it's a chop. Kickers only matter for unmatched cards.", wrong: "Same 5-card straight = split pot. Hole-card ownership doesn't matter; only the 5-card hand does." } },
        { t: "duel" },
        { t: "board" },
        { t: "name" },
      ] },
      { id: "u1l2", title: "Which Hands to Play",
        primer: {
          tagline: "Most hands are trash. Folding trash is how you win.",
          blocks: [
            { h: "Premium hands — raise these",
              p: "Top-tier starting hands you should almost always raise: pocket aces, kings, queens, ace-king suited. These win the most money and punish the people playing garbage.",
              ex: [
                { label: "AA", cards: [{ r: 14, s: 0 }, { r: 14, s: 1 }], caption: "The best hand in poker." },
                { label: "AK suited", cards: [{ r: 14, s: 2 }, { r: 13, s: 2 }], caption: "Top-5 starting hand." },
              ] },
            { h: "Trash — fold these",
              p: "Most hands are unplayable from most seats. 7-2 offsuit is the worst. Anything with a weak ace and a bad kicker (A5o, A9o) bleeds chips slowly.",
              ex: [
                { label: "72 offsuit", cards: [{ r: 7, s: 0 }, { r: 2, s: 1 }], caption: "Worst hand in the game. Fold." },
                { label: "A5 offsuit", cards: [{ r: 14, s: 0 }, { r: 5, s: 3 }], caption: "Trap hand — dominated by every better ace." },
              ] },
            { h: "Suited adds a little — not magic",
              p: "Two cards of the same suit gain ~2-3% equity from flush potential. Suited trash is still trash. Suited connectors (like 9♠8♠) in late position are the goldmine.",
              ex: [
                { label: "QJ suited", cards: [{ r: 12, s: 1 }, { r: 11, s: 1 }], caption: "Play it — big draw potential." },
                { label: "72 suited", cards: [{ r: 7, s: 0 }, { r: 2, s: 0 }], caption: "Still trash, suited or not." },
              ] },
          ],
        },
        questions: [
        { q: "You're dealt 7♦2♣ (the famous worst hand). Someone raises. You…", opts: ["Fold, obviously", "Call, it might hit", "Raise, nobody expects it", "Ask the table for advice"], a: 0,
          ex: [{ label: "You", cards: [{ r: 7, s: 1 }, { r: 2, s: 0 }], caption: "72 offsuit — the worst hand." }],
          fb: { right: "72 offsuit is the worst hand in the game. Folding trash preflop is the #1 fastest way to stop losing money.", wrong: "72o wins ~12% of the time in a full game. \"It might hit\" is how your buy-in ends up in someone else's Venmo." } },
        { q: "Which of these is a legit premium hand you should almost always raise?", opts: ["A♠A♥", "K♣9♦", "J♠8♠", "A♦5♣"], a: 0,
          ex: [
            { label: "AA", cards: [{ r: 14, s: 0 }, { r: 14, s: 1 }], caption: "Raise every time." },
            { label: "K9o", cards: [{ r: 13, s: 0 }, { r: 9, s: 1 }], caption: "Fold — dominated by KQ/KJ." },
          ],
          fb: { right: "Pocket aces — the best starting hand there is. Raise it. Don't get cute and just call.", wrong: "AA is the one. K9, J8s, A5o are hands that look pretty and lose you money from most seats." } },
        { q: "\"Suited\" cards (like Q♥J♥) are better than offsuit because…", opts: ["You can make a flush", "They're worth double", "Suited hands beat pairs", "They look cooler"], a: 0,
          ex: [{ label: "QJ suited", cards: [{ r: 12, s: 1 }, { r: 11, s: 1 }], caption: "Flush potential + straight potential." }],
          fb: { right: "Flush potential. But heads up: suited only adds ~2-3% equity. QJ suited is nice, 72 suited is still garbage.", wrong: "It's the flush chance — worth ~2-3% extra, not a superpower. Suited trash is still trash." } },
        { q: "Everyone folds to you and you have A♣J♣. Best move?", opts: ["Raise", "Just call", "Fold", "Go all-in"], a: 0,
          ex: [{ label: "You (button)", cards: [{ r: 14, s: 0 }, { r: 11, s: 0 }], caption: "AJ suited, everyone folded." }],
          fb: { right: "Strong hand, everyone folded — raise and take control. Limping invites the whole table in.", wrong: "AJ suited with everyone folded is a clear raise. All-in is too much, folding is too little, calling wins nothing." } },
        { q: "Rough guide: in a full game, what % of hands do decent players actually play?", opts: ["Around 20-25%", "Around 50%", "Around 80%", "Every hand you paid the blind for"], a: 0,
          fb: { right: "Yep — roughly 1 in 4 or 5. Feels boring, wins money. The table clown playing 70% is your income source.", wrong: "Winning players fold ~75-80% of hands preflop. Folding isn't losing — it's skipping the hands designed to drain you." } },
        { q: "You've folded 10 hands in a row and you're bored. You look down at J♦4♠. You…", opts: ["Fold #11 — boredom isn't a strategy", "Play it, you're \"due\"", "Raise to look unpredictable", "Show everyone how patient you are"], a: 0,
          ex: [{ label: "J4 offsuit", cards: [{ r: 11, s: 1 }, { r: 4, s: 0 }], caption: "Still trash, hand 1 or hand 100." }],
          fb: { right: "The deck doesn't know you're bored. \"I'm due\" is the sound of a bankroll leaving.", wrong: "You're never \"due.\" Every deal is fresh. J4o is a fold whether it's hand 1 or hand 100." } },
        { q: "What's the golden rule about \"calling a big raise just to see a flop\"?", opts: ["Calling big raises with trash is how you go broke", "Always see the flop, you might hit", "It's fine if it's pretty", "It's a flex"], a: 0,
          fb: { right: "Seeing flops is cheap when everyone limps. Calling raises with weak hands is burning chips for a ~1-in-8 dream.", wrong: "Calling big raises to \"see what happens\" is how people lose their whole buy-in. Cheap flops only." } },
        { t: "duel" },
      ] },
      { id: "u1l3", title: "Position Is Everything",
        primer: {
          tagline: "Where you sit changes what your cards are worth.",
          blocks: [
            { h: "The button is the best seat",
              p: "The dealer button moves one spot left each hand. The player on the button acts LAST on every street after the flop. Acting last = seeing what everyone does before you decide. Info is money.",
              ex: [
                { label: "Button (late)", cards: [{ r: 9, s: 1 }, { r: 8, s: 1 }], caption: "98 suited here = raise. Info-rich." },
                { label: "UTG (early)", cards: [{ r: 9, s: 1 }, { r: 8, s: 1 }], caption: "Same hand, first to act = fold." },
              ] },
            { h: "The blinds are the worst seats",
              p: "The small blind and big blind are forced bets posted before cards are dealt. They act LAST preflop but FIRST on every street after — meaning they're out of position with no info all hand.",
              ex: [
                { label: "Blinds", cards: [{ r: 6, s: 3 }, { r: 3, s: 0 }], caption: "63o in the blinds — even 'cheap' is too expensive here." },
              ] },
            { h: "Same hand, different seat, different play",
              p: "A hand's value isn't fixed — it scales with position. A medium hand like 9♣8♣ is a fold up front (6 players behind you, no info) and a raise on the button (everyone folded, you have the info edge).",
              ex: [
                { label: "Fold up front", cards: [{ r: 9, s: 0 }, { r: 8, s: 2 }], caption: "6 players behind you = minefield." },
                { label: "Raise on button", cards: [{ r: 9, s: 1 }, { r: 8, s: 1 }], caption: "Everyone folded + suited = green light." },
              ] },
          ],
        },
        questions: [
        { q: "Being \"on the button\" (last to act) is the best seat because…", opts: ["You see what everyone does first", "You get better cards", "You pay smaller blinds", "Dealer always wins ties"], a: 0,
          fb: { right: "Info is money. Acting last means you know who's scared and who's strong before you put in a chip.", wrong: "Cards are random everywhere — the button's edge is INFO. You watch everyone act before you decide." } },
        { q: "Same hand (9♠8♠), two spots: first to act vs on the button. How do you play it?", opts: ["Fold early, play it late", "Same everywhere", "Only play it early", "All-in from anywhere"], a: 0,
          ex: [{ label: "9♠8♠", cards: [{ r: 9, s: 0 }, { r: 8, s: 0 }], caption: "Position decides, not the cards." }],
          fb: { right: "Medium hands need position. First to act with 6 behind you = minefield. On the button = green light.", wrong: "Same cards ≠ same play. 98s is a fold up front and a fun hand on the button. Position changes everything." } },
        { q: "The two forced bets before cards are dealt are called…", opts: ["The blinds", "The antes", "The openers", "The marks"], a: 0,
          fb: { right: "Small blind and big blind. They act LAST preflop but FIRST every round after — worst seats at the table.", wrong: "Those are the blinds. They're the least profitable seats in poker — defend them carefully, not proudly." } },
        { q: "Why is acting FIRST after the flop such a disadvantage?", opts: ["You give away info and decide blind", "You have to bet double", "You can't raise", "It isn't"], a: 0,
          fb: { right: "You act with zero info while everyone behind you reacts to YOU. That's why the same hand is worth less up front.", wrong: "Acting first = betting into the unknown, and whatever you do leaks info. Everyone behind you gets to react." } },
        { q: "Poker night is 6 people. Who should be playing the MOST hands?", opts: ["Whoever's on the button each hand", "The host", "Whoever's losing, to catch up", "The best player"], a: 0,
          fb: { right: "The button rotates, and whoever has it gets the discount on entering pots. Play more hands late, fewer early — everyone.", wrong: "It rotates with the button. Late position = play more hands. \"Losing so play more\" is how losing gets worse." } },
        { q: "You're in the small blind, everyone limps. You have 6♣3♦. What's the trap?", opts: ["It looks cheap, but you'll be out of position the entire hand", "It's actually free", "You should raise huge", "Blinds always win limped pots"], a: 0,
          ex: [
            { label: "You (SB)", cards: [{ r: 6, s: 0 }, { r: 3, s: 1 }], caption: "Looks cheap. Acts first every street after." },
          ],
          fb: { right: "The \"cheap\" price hides the real cost: you act first on every street after. Trash hand + worst position = a leak.", wrong: "You'll be first to act on flop, turn, AND river. The discount isn't worth being blind on every betting round." } },
        { t: "duel" },
        { t: "board" },
        { t: "name" },
        { t: "move" },
      ] },
      { id: "u1l4", title: "Bet Sizing 101",
        primer: {
          tagline: "The size of your bet is a whole second language.",
          blocks: [
            { h: "Half-pot to pot is the normal range",
              p: "A standard bet is about half the pot up to the full pot. Big enough to charge draws, small enough that worse hands still call. Min-bets and massive overbets both leave money on the table.",
              ex: [
                { label: "Pot: 100", cards: [], caption: "Half-pot bet = 50. Full-pot bet = 100. The normal range." },
              ] },
            { h: "Min-bets give free draws",
              p: "Betting 5 into a 100 pot gives your opponent 21:1 — literally any draw calls correctly. You're charging nothing for people to outdraw you. Don't do it.",
              ex: [
                { label: "Pot: 100", cards: [], caption: "Bet 5 → opponent needs just ~5% to call. Any draw gets there." },
              ] },
            { h: "Don't tell them your hand size",
              p: "If your big bets always mean strong and your small bets always mean weak, anyone paying attention reads you like a book. Keep bet sizes consistent so your bets don't narrate your cards.",
              ex: [
                { label: "Consistent", cards: [], caption: "Same ~60% pot bet with AA and with a bluff. No tell." },
              ] },
          ],
        },
        questions: [
        { q: "The pot is 100 chips in your dorm game. A \"standard\" strong bet is about…", opts: ["50-100 (half to full pot)", "5 (min bet)", "500 (5x pot)", "Whatever's in your pocket"], a: 0,
          fb: { right: "Half-pot to pot is the normal range — big enough to charge draws, small enough that worse hands call.", wrong: "Half-pot to full pot is standard. Min-bets do nothing, and massive overbets fold out everyone you beat." } },
        { q: "Why is min-betting 5 into a 100-chip pot usually bad?", opts: ["Everyone gets a perfect price to call", "It's against the rules", "It always means bluffing", "It's rude"], a: 0,
          fb: { right: "A tiny bet gives 21:1 — literally any draw calls correctly. You're charging nothing for people to beat you.", wrong: "It gives insane pot odds — anyone with any draw is right to call. You want opponents making mistakes, not free profit." } },
        { q: "You flop the absolute nuts. Your goal is now…", opts: ["Build the pot without scaring everyone off", "Check it down to be safe", "Instantly go all-in", "Show your neighbor"], a: 0,
          fb: { right: "Max value. Bet sizes people can actually call — a huge overbet often wins you a tiny pot.", wrong: "With the nuts you can't lose — the mission is extraction. Bet callable amounts and let them come along." } },
        { q: "Your bets are 25 with weak hands and 100 with strong ones, every time. Problem?", opts: ["You're readable — sizes are telling everyone your hand", "No problem, it's honest", "Bets should be random", "Only online players notice"], a: 0,
          fb: { right: "Bet-size tells are the easiest reads at casual games. Keep sizes consistent so your bets don't narrate your cards.", wrong: "Size-matching-strength is a walking tell. Anyone paying attention folds when you're big and pounces when you're small." } },
        { q: "Everyone checks to the river and you have a medium hand. The move is usually…", opts: ["Check — thin hands want cheap showdowns", "Huge bluff", "Min bet \"for info\"", "Fold before showdown"], a: 0,
          fb: { right: "Medium hands love free showdowns. Betting there mostly gets called by better and folds out worse — the bad combo.", wrong: "When you're medium, showdown is your friend. Bets get called by hands that beat you and fold hands you beat. Check it." } },
        { q: "You raise preflop to 30 and 3 people call. The pot is now ~120. Flop comes — a good continuation bet is around…", opts: ["40-60 (about half pot)", "10 (min)", "All of it", "Check always, you missed"], a: 0,
          fb: { right: "~half pot continues the story you told preflop (\"I have a hand\") without overcommitting when 3 people saw the flop.", wrong: "Half pot keeps up the pressure and prices out draws. A min bet gives infinite odds; an overbet folds out worse hands." } },
      ] },
      { id: "u1cp", title: "Checkpoint: Prove It", boss: true,
        primer: {
          tagline: "Boss time. Everything from Unit 1, mixed together, double stakes.",
          blocks: [
            { h: "Quick recap",
              p: "1) Hand rankings: flush > straight > trips > two pair > pair > high card. 2) Play ~20-25% of hands, more in late position. 3) Position is info, and info is money. 4) Bet half-to-full pot, never min-bet, never size-tell your hand.",
              ex: [
                { label: "Premium", cards: [{ r: 14, s: 0 }, { r: 14, s: 1 }], caption: "Raise every time." },
                { label: "Trash", cards: [{ r: 7, s: 0 }, { r: 2, s: 1 }], caption: "Fold every time." },
              ] },
            { h: "Boss rules",
              p: "Checkpoints mix every challenge type — duels, beat-the-board, count-the-outs, name-that-hand, bet-or-fold — and pay double. One wrong answer costs a life. Stay sharp." },
          ],
        },
        questions: [
        { q: "On the button with A♠K♠. Two people limp in. You…", opts: ["Raise — punish the limpers", "Call quietly", "Fold", "All-in"], a: 0,
          ex: [{ label: "You (button)", cards: [{ r: 14, s: 0 }, { r: 13, s: 0 }], caption: "AK suited + best position + limpers = raise." }],
          fb: { right: "Big hand + best position + weak limpers = raise. Build the pot while ahead AND get info.", wrong: "AK suited on the button over limpers is a textbook raise. Limping behind wastes the best hand you've seen all night." } },
        { t: "duel" },
        { q: "Flop K♥7♦2♣. You bet, one caller. Turn 4♠ — he suddenly bets huge. Most likely story?", opts: ["Trap or bluff — proceed carefully", "He definitely has nothing", "The 4 helped him", "He misclicked"], a: 0,
          ex: [
            { label: "Board", cards: [{ r: 13, s: 1 }, { r: 7, s: 1 }, { r: 2, s: 0 }, { r: 4, s: 0 }], caption: "K-7-2-4 — the 4 changed nothing." },
          ],
          fb: { right: "Sudden big bet on a blank turn = he was trapping, or he's bluffing. Top pair just became a bluff-catcher.", wrong: "The 4 changed nothing. When a caller suddenly wakes up on a nothing card, respect it." } },
        { t: "outs", idx: 0 },
        { t: "board" },
        { t: "duel" },
        { q: "River bricks. He bets your whole stack. You beat exactly nothing he'd value-bet. This is a…", opts: ["Fold — pay off less, win more", "Call — you have top pair!", "Raise", "Coin flip"], a: 0,
          fb: { right: "The discipline that separates winners. If everything he'd bet like this beats you, top pair is a pretty bluff-catcher.", wrong: "\"But I have top pair\" is the most expensive sentence in poker. If his value hands all beat you, folding IS the win." } },
        { t: "outs", idx: 8 },
        { t: "board" },
        { t: "move" },
        { t: "name" },
      ] },
    ],
  },
  {
    id: "u2", title: "Pot Odds", emoji: "🎯", free: false, reward: 150,
    tagline: "The math that pays your rent.",
    lessons: [
      { id: "u2l1", title: "What Are Pot Odds",
        primer: {
          tagline: "Risk vs reward. The one calculation that upgrades your whole game.",
          blocks: [
            { h: "The formula",
              p: "Pot odds = (what you must call) : (what you win). Pot is 300, opponent bets 100 → pot becomes 400. You call 100 to win 400 = 4:1. You need to win 1 in 5 (20%) to break even.",
              ex: [
                { label: "Example", cards: [], caption: "Pot 300 → he bets 100 → pot 400. Call 100 → 4:1 → need 20%." },
              ] },
            { h: "Equity vs price",
              p: "Your hand wins X% of the time (your equity). The pot odds say you need Y%. If X > Y, calling is profitable long-term — even though you lose most individual pots. That's the mindset shift.",
              ex: [
                { label: "Profitable", cards: [], caption: "Win 30%, need 20% → call. You lose 70% of pots and still print money." },
                { label: "Unprofitable", cards: [], caption: "Win 10%, need 20% → fold. The dream doesn't pay." },
              ] },
            { h: "The numbers to memorize",
              p: "1/3-pot bet → need ~25%. Half-pot bet → need ~33%. Pot-sized bet → need ~50% wait no — 33% (you call pot to win 2x pot). Actually: pot-sized bet = need 33%. 2x pot overbet = need 40%.",
              ex: [
                { label: "Pot-sized bet", cards: [], caption: "Bet = pot. Call pot to win 2×pot = 33% needed." },
              ] },
          ],
        },
        questions: [
        { q: "Pot is 300. Opponent bets 100 (pot now 400). Costs you 100 to call. Your pot odds?", opts: ["4:1 — need to win 20% of the time", "1:1 — 50%", "10:1 — 9%", "Vibes"], a: 0,
          fb: { right: "100 to win 400 = 4:1. Win more than 1 in 5 and calling prints money long-term.", wrong: "Risk 100 to win the 400 out there = 4:1 = need 20% equity. This one calculation upgrades your whole game." } },
        { q: "You need 20% to call and your hand wins 30% of the time. Calling is…", opts: ["Profitable — every time", "Break even", "A losing play", "Gambling"], a: 0,
          fb: { right: "30% > 20% = free money over time, even though you LOSE most of these pots. That's the mindset shift.", wrong: "30% vs 20% needed = profitable. You'll lose most of these pots and still make money long-run. Poker is weird like that." } },
        { q: "Why do pot odds matter more than \"I think he's bluffing\"?", opts: ["Math works every time; vibes work sometimes", "They don't", "Bluffs are illegal", "Odds only matter online"], a: 0,
          fb: { right: "Reads are a bonus on top of the math, not a replacement. Price first, psychology second.", wrong: "Feelings lie, prices don't. Get the math right first — reads are the tiebreaker, not the foundation." } },
        { q: "He bets 50 into a 50 pot. You now need what % to call?", opts: ["~33%", "~50%", "~10%", "~66%"], a: 0,
          fb: { right: "Call 50 to win 100 → 50/150 = 33%. Pot-sized bet = need a third. Memorize that one.", wrong: "You call 50, total pot becomes 150. 50/150 = 33%. A pot-sized bet always means \"need one-third.\"" } },
        { q: "Quick one: smaller bets mean you can call with…", opts: ["Weaker hands and more draws", "Only the nuts", "Nothing different", "Any two cards, always"], a: 0,
          fb: { right: "Cheap price = wide calls. Big price = tight calls. The bet size literally tells you how strong you need to be.", wrong: "Better price = more hands become playable. That's the whole system: the price sets the bar." } },
        { q: "He bets 1/3 pot. You need roughly what % to call?", opts: ["~25%", "~33%", "~50%", "~10%"], a: 0,
          fb: { right: "A 1/3-pot bet gives you a great price — you only need to win ~1 in 4 to break even. Most draws get there.", wrong: "1/3 pot → risk a little to win a lot. You need ~25%. Suddenly, a lot of calls are correct." } },
      ] },
      { id: "u2l2", title: "Counting Outs",
        primer: {
          tagline: "How many cards left in the deck improve your hand?",
          blocks: [
            { h: "What's an 'out'?",
              p: "An out is any card still in the deck that would improve your hand to (probably) the winner. Count them, then use the rule of 4 and 2 to turn outs into a win %.",
              ex: [
                { label: "Flush draw", cards: [{ r: 12, s: 1 }, { r: 8, s: 1 }], caption: "4 hearts → 9 outs (13 − 4)." },
                { label: "Board", cards: [{ r: 7, s: 1 }, { r: 3, s: 1 }, { r: 2, s: 0 }], caption: "Two more hearts on the flop." },
              ] },
            { h: "The common counts",
              p: "Flush draw = 9 outs. Open-ended straight = 8 outs. Two overcards = 6 outs. Gutshot = 4 outs. Pocket pair → set = 2 outs. These five numbers do 90% of the work.",
              ex: [
                { label: "Open-ender", cards: [{ r: 9, s: 0 }, { r: 8, s: 2 }], caption: "Any 10 or 7 = 8 outs." },
                { label: "Board", cards: [{ r: 7, s: 1 }, { r: 6, s: 3 }, { r: 2, s: 0 }], caption: "Four 10s + four 5s." },
              ] },
            { h: "Rule of 4 and 2",
              p: "Outs × 4 with two cards coming (flop → river). Outs × 2 with one card coming (turn → river). Off by a point or two, doable with a drink in your hand. 9 outs × 4 ≈ 36% by the river.",
              ex: [
                { label: "9 outs on flop", cards: [], caption: "9 × 4 ≈ 36% by the river. 9 × 2 ≈ 18% on the turn only." },
              ] },
          ],
        },
        questions: [
        { q: "You have 4 hearts after the flop (flush draw). How many cards finish it?", opts: ["9", "13", "4", "7"], a: 0,
          ex: [
            { label: "You", cards: [{ r: 12, s: 1 }, { r: 8, s: 1 }], caption: "Two hearts in hand." },
            { label: "Flop", cards: [{ r: 7, s: 1 }, { r: 3, s: 1 }, { r: 2, s: 0 }], caption: "Two more hearts = 4 total. 13 − 4 = 9 outs." },
          ],
          fb: { right: "13 hearts minus your 4 = 9 outs. Burn it in: flush draw = 9.", wrong: "13 hearts in the deck, you can see 4. 9 left = 9 outs." } },
        { q: "Rule of 4 and 2: with 9 outs on the flop, odds to hit by the river ≈", opts: ["9 × 4 = ~36%", "9 × 2 = ~18%", "9%", "90%"], a: 0,
          fb: { right: "Outs × 4 with two cards coming, × 2 with one. Off by a point or two, doable with a drink in your hand.", wrong: "Flop (2 cards coming) = outs × 4 ≈ 36%. On the turn it drops to × 2 ≈ 18%." } },
        { q: "Open-ended straight draw (9-8 on a 7-6-2 board). Outs?", opts: ["8", "4", "12", "6"], a: 0,
          ex: [
            { label: "You", cards: [{ r: 9, s: 0 }, { r: 8, s: 2 }], caption: "9-8." },
            { label: "Board", cards: [{ r: 7, s: 1 }, { r: 6, s: 3 }, { r: 2, s: 0 }], caption: "7-6-2. Any 10 or 5 completes it." },
          ],
          fb: { right: "Four 10s + four 5s = 8. Straight draw = 8, flush draw = 9. Those two numbers do 90% of the work.", wrong: "Either a 10 or a 5 completes it — four of each = 8 outs." } },
        { t: "outs", idx: 2 },
        { t: "outs", idx: 3 },
        { q: "Gutshot (inside straight draw, like 9-8 on a 6-5-2 board needing exactly a 7). Outs?", opts: ["4", "8", "2", "10"], a: 0,
          ex: [
            { label: "You", cards: [{ r: 9, s: 0 }, { r: 8, s: 2 }], caption: "9-8, need a 7." },
            { label: "Board", cards: [{ r: 6, s: 1 }, { r: 5, s: 3 }, { r: 2, s: 0 }], caption: "6-5-2. Only the four 7s help." },
          ],
          fb: { right: "Only the four 7s save you. Gutshots are pretty but they hit ~16% by the river — price them honestly.", wrong: "One rank fills an inside straight — 4 outs. Half a real draw. Chase cheap or not at all." } },
        { q: "You have a flush draw AND an open-ended straight draw (no overlap). Total outs?", opts: ["15", "9", "8", "17"], a: 0,
          ex: [
            { label: "You", cards: [{ r: 11, s: 0 }, { r: 10, s: 0 }], caption: "J10 of spades." },
            { label: "Board", cards: [{ r: 9, s: 0 }, { r: 8, s: 1 }, { r: 2, s: 0 }], caption: "9-8-2. Flush (9) + straight (8) − 2 overlap = 15." },
          ],
          fb: { right: "9 (flush) + 8 (straight) − 2 cards that'd complete both = 15. A monster draw — you'll hit more than half the time by the river.", wrong: "Combo draws add up: flush (9) + straight (8) − 2 overlap = 15. When you have one of these, play it fast." } },
        { t: "outs", idx: 9 },
      ] },
      { id: "u2l3", title: "Draws vs Prices",
        primer: {
          tagline: "Same draw, different price, different answer.",
          blocks: [
            { h: "Compare equity to pot odds",
              p: "Step 1: count your outs. Step 2: convert to a win % (rule of 4 and 2). Step 3: compare to the % you need to call. If your equity > required %, call. Otherwise fold. That's the whole system.",
              ex: [
                { label: "Flush draw", cards: [{ r: 12, s: 1 }, { r: 8, s: 1 }], caption: "9 outs ≈ 36% by the river." },
                { label: "Board", cards: [{ r: 7, s: 1 }, { r: 3, s: 1 }, { r: 2, s: 0 }], caption: "Pot 400, he bets 100 → need 20%." },
              ] },
            { h: "Implied odds — the future money",
              p: "If your draw hits and your opponent will keep paying you off, a slightly-bad price can become good. Deep stacks make draws more valuable because the payoff is bigger when you hit.",
              ex: [
                { label: "Deep stacks", cards: [], caption: "Bad price now, but you'll win 800 more when you hit → still profitable." },
              ] },
            { h: "Hit and bet",
              p: "The chase only profits if you cash in when you hit. Hitting a flush and checking back is leaving the tip on someone else's table — you called all that way to WIN chips, not to admire the pretty flush.",
              ex: [
                { label: "You hit", cards: [{ r: 12, s: 1 }, { r: 8, s: 1 }, { r: 7, s: 1 }, { r: 3, s: 1 }, { r: 2, s: 1 }], caption: "Flush! Now BET — don't check." },
              ] },
          ],
        },
        questions: [
        { q: "Flush draw (~36% by river). He bets pot — you need ~33%. You…", opts: ["Call — you're getting the price", "Fold — draws are for suckers", "Must raise", "Flip a coin"], a: 0,
          ex: [
            { label: "You", cards: [{ r: 12, s: 1 }, { r: 8, s: 1 }], caption: "Flush draw — 9 outs ≈ 36%." },
            { label: "Board", cards: [{ r: 7, s: 1 }, { r: 3, s: 1 }, { r: 2, s: 0 }], caption: "Pot-sized bet → need ~33%." },
          ],
          fb: { right: "36% > 33%. Snap call. When the math says yes, you don't need to \"feel good\" about it.", wrong: "~36% win vs ~33% needed = call. Folding profitable draws is burning money politely." } },
        { q: "Same draw, but he bets 3x pot — now you need ~43%. You…", opts: ["Fold — the price got too bad", "Call anyway, flushes are fun", "All-in", "Cry"], a: 0,
          fb: { right: "Same cards, different price, different answer. That's the entire lesson.", wrong: "36% vs 43% needed = money on fire. The draw didn't change — the PRICE did. Fold." } },
        { q: "\"Implied odds\" means…", opts: ["Extra chips you'll win AFTER you hit", "Odds that are implied to be good", "A bluffing technique", "Table etiquette"], a: 0,
          fb: { right: "If he'll pay you off big when you hit, a slightly-bad price can become good. Deep stacks make draws better.", wrong: "It's the future money: when your draw hits and he still pays you. That bonus can rescue a borderline call." } },
        { q: "You hit your flush on the river. He checks. You…", opts: ["Bet — get paid for the hand you chased", "Check back, mission complete", "Show your cards first", "Bet 1 chip"], a: 0,
          ex: [{ label: "River flush", cards: [{ r: 12, s: 1 }, { r: 8, s: 1 }, { r: 7, s: 1 }, { r: 3, s: 1 }, { r: 2, s: 1 }], caption: "You hit — now bet for value." }],
          fb: { right: "The chase only profits if you cash it in. Hitting and checking back is leaving the tip on someone else's table.", wrong: "You called all that way to WIN chips, not to see a pretty flush. Bet it." } },
        { t: "outs", idx: 1 },
        { q: "You have a gutshot (4 outs, ~16% by river) and face a half-pot bet (need ~25%). You…", opts: ["Fold unless stacks are deep for implied odds", "Always call, it might hit", "Raise as a bluff", "It's a coin flip"], a: 0,
          ex: [
            { label: "You", cards: [{ r: 9, s: 0 }, { r: 8, s: 2 }], caption: "9-8, need a 7." },
            { label: "Board", cards: [{ r: 6, s: 1 }, { r: 5, s: 3 }, { r: 2, s: 0 }], caption: "6-5-2. 4 outs ≈ 16%." },
          ],
          fb: { right: "16% < 25% — fold unless you'll win a LOT when you hit. Gutshots are the classic trap for people who hate folding.", wrong: "Gutshots miss 84% of the time and the price isn't there. Only deep implied odds save the call." } },
        { t: "board" },
      ] },
      { id: "u2cp", title: "Checkpoint: Price Check", boss: true,
        primer: {
          tagline: "Boss time. The whole pot-odds unit, double stakes.",
          blocks: [
            { h: "Recap",
              p: "1) Pot odds = call : pot-to-win. Convert to a required %. 2) Outs × 4 (flop) or × 2 (turn) ≈ equity. 3) If equity > required %, call. 4) Implied odds = future payoff, can rescue a thin call. 5) When you hit, BET.",
              ex: [
                { label: "Cheat sheet", cards: [], caption: "1/3-pot → 25%. Half-pot → 33%. Pot → 33%. 2× pot → 40%." },
              ] },
            { h: "Boss rules",
              p: "All challenge types mixed. Double stakes. Lives on the line. The math doesn't lie — trust it." },
          ],
        },
        questions: [
        { q: "Pot 200. He bets 200. You have an open-ender (8 outs, one card coming ≈ 16%). Need 33%. Verdict?", opts: ["Fold — 16% vs 33%", "Call — straights pay big", "Raise as a bluff", "Depends on his shirt"], a: 0,
          ex: [
            { label: "You", cards: [{ r: 9, s: 0 }, { r: 8, s: 2 }], caption: "Open-ender: 8 outs ≈ 16%." },
            { label: "Board", cards: [{ r: 7, s: 1 }, { r: 6, s: 3 }, { r: 2, s: 0 }, { r: 13, s: 2 }], caption: "One card left → 16% vs 33% needed." },
          ],
          fb: { right: "Clear fold on raw odds (unless he'll pay you a FORTUNE when you hit). You just did real poker math.", wrong: "8 outs × 2 ≈ 16%, need 33%. Unless implied odds are huge, fold." } },
        { t: "outs", idx: 5 },
        { t: "duel" },
        { t: "outs", idx: 4 },
        { t: "board" },
        { t: "outs", idx: 7 },
        { q: "Biggest takeaway from this unit?", opts: ["Calling depends on price, not hope", "Always chase flushes", "Math ruins poker", "Bet big = win big"], a: 0,
          fb: { right: "That's it. Same draw, different bet size = different answer. Your friends are still using hope.", wrong: "The unit in one line: the PRICE decides, not the dream. Compare equity to pot odds and the answer falls out." } },
        { t: "duel" },
        { t: "move" },
      ] },
    ],
  },
  {
    id: "u3", title: "Reading the Board", emoji: "👀", free: false, reward: 200,
    tagline: "See what everyone else could have.",
    lessons: [
      { id: "u3l1", title: "Wet vs Dry Boards",
        primer: {
          tagline: "Some flops are deserts. Some are warzones. Know the difference.",
          blocks: [
            { h: "Wet = draw-heavy and dangerous",
              p: "A wet board has connected, suited cards — straights, flushes, and combo draws are all in play. Top pair is shaky on wet boards. Bet bigger to charge the draws, trust one-pair hands less.",
              ex: [
                { label: "Wet flop", cards: [{ r: 11, s: 1 }, { r: 10, s: 1 }, { r: 9, s: 0 }], caption: "J-10-9 two hearts. Straights + flush draws everywhere." },
              ] },
            { h: "Dry = safe and simple",
              p: "A dry board has unconnected, rainbow cards. Few draws possible — top pair is probably still the best hand. Smaller bets get the same job done because nothing's chasing.",
              ex: [
                { label: "Dry flop", cards: [{ r: 13, s: 1 }, { r: 7, s: 0 }, { r: 2, s: 2 }], caption: "K-7-2 rainbow. Desert — nothing draws." },
              ] },
            { h: "Rainbow = no flush draw yet",
              p: "Three different suits on the flop means nobody flopped a flush draw. One less monster hiding in the bushes. A suited flop (two or three of one suit) is wetter and scarier.",
              ex: [
                { label: "Rainbow", cards: [{ r: 13, s: 0 }, { r: 9, s: 1 }, { r: 4, s: 2 }], caption: "Three suits, no flush draw possible yet." },
              ] },
          ],
        },
        questions: [
        { q: "Which flop is \"wet\" (dangerous, draw-heavy)?", opts: ["J♥10♥9♠", "K♦7♣2♠", "2♣2♦7♥", "A♠8♦3♣"], a: 0,
          ex: [{ label: "J♥10♥9♠", cards: [{ r: 11, s: 1 }, { r: 10, s: 1 }, { r: 9, s: 0 }], caption: "Connected + two hearts = soaked." }],
          fb: { right: "J-10-9 two hearts is soaked — straights, flush draws, big pairs all live there. Bet bigger, trust top pair less.", wrong: "J♥10♥9♠: straight draws everywhere plus a flush draw. K-7-2 rainbow is a desert." } },
        { q: "On a dry board like K♦7♣2♠, your top pair is…", opts: ["Usually still the best hand", "Basically dead", "A guaranteed winner", "A bluff"], a: 0,
          ex: [{ label: "Dry K-7-2", cards: [{ r: 13, s: 1 }, { r: 7, s: 0 }, { r: 2, s: 2 }], caption: "Nothing draws at you here." }],
          fb: { right: "Nothing draws at you on K-7-2 rainbow. Bet confidently — few hands beat you, few can outdraw you.", wrong: "Dry board = few draws = top pair stays strong. It's wet boards where one pair starts sweating." } },
        { q: "On WET boards, good players bet ___ ; on DRY boards they can bet ___", opts: ["Bigger; smaller", "Smaller; bigger", "The same", "Never; always"], a: 0,
          fb: { right: "Wet = charge the draws rent. Dry = a small bet does the same job for cheaper.", wrong: "Wet boards: bet big, make draws pay. Dry boards: small bets get it done because nothing's drawing." } },
        { q: "\"Rainbow\" flop means…", opts: ["Three different suits", "Three of the same suit", "A face-card flop", "A flop everyone likes"], a: 0,
          fb: { right: "Three suits = no flush draw possible yet. One less monster hiding in the bushes.", wrong: "Rainbow = all different suits, so nobody has a flush draw yet. Calmer board, calmer decisions." } },
        { q: "Flop 8♠7♠6♠. Three players saw it. What's SCARIEST about this board?", opts: ["Both flush draws AND straight draws — someone could have a monster already", "It's rainbow so nothing", "Only the 8 matters", "It's totally safe"], a: 0,
          ex: [{ label: "8♠7♠6♠", cards: [{ r: 8, s: 0 }, { r: 7, s: 0 }, { r: 6, s: 0 }], caption: "Three spades + connected = the whole zoo." }],
          fb: { right: "Three spades + three-connected = made straights, made flushes, and combo draws all at once. Top pair here is a trap.", wrong: "Wet, connected, suited — the whole zoo is in play. Slow way down with one-pair hands on boards like this." } },
        { t: "duel" },
        { t: "board" },
        { t: "name" },
      ] },
      { id: "u3l2", title: "Scare Cards",
        primer: {
          tagline: "The turn and river can flip who's winning in a single card.",
          blocks: [
            { h: "A scare card changes the pecking order",
              p: "You have KK and an ace falls on the turn — every A-x just passed you. You have two pair and the third spade hits — any one spade in someone's hand beats you. Scare cards demand a re-read.",
              ex: [
                { label: "You had KK", cards: [{ r: 13, s: 0 }, { r: 13, s: 1 }], caption: "Boss on the flop." },
                { label: "Turn: A♠", cards: [{ r: 14, s: 0 }], caption: "Any ace now beats you. KK → bluff-catcher." },
              ] },
            { h: "Paired boards spawn full houses",
              p: "When the board pairs (flop 9-6-2, turn 6), suddenly anyone with a 6 has trips and flopped pairs can make a full house. Sudden aggression on a paired board usually means business.",
              ex: [
                { label: "Flop", cards: [{ r: 9, s: 1 }, { r: 6, s: 0 }, { r: 2, s: 1 }], caption: "9-6-2." },
                { label: "Turn: 6♠", cards: [{ r: 6, s: 0 }], caption: "Board paired — trips and boats now possible." },
              ] },
            { h: "Completed draws on the river",
              p: "When the 4th heart, the 4th straight card, or the pairing card hits the river, your strong hand may have just become a bluff-catcher. Slow down and think before calling big bets.",
              ex: [
                { label: "Board", cards: [{ r: 13, s: 1 }, { r: 9, s: 1 }, { r: 6, s: 1 }, { r: 2, s: 1 }], caption: "Four hearts. Any single heart in a hand = flush." },
              ] },
          ],
        },
        questions: [
        { q: "You have K♣K♠. Flop 9♦6♣2♥ (great). Turn: A♠. Why is that scary?", opts: ["Any ace now beats your kings", "Aces are unlucky", "It completes a flush", "It isn't"], a: 0,
          ex: [
            { label: "You", cards: [{ r: 13, s: 0 }, { r: 13, s: 2 }], caption: "KK was the boss." },
            { label: "Board", cards: [{ r: 9, s: 1 }, { r: 6, s: 0 }, { r: 2, s: 1 }, { r: 14, s: 0 }], caption: "Turn ace — every A-x beats you now." },
          ],
          fb: { right: "Every A-x just passed you. Not auto-fold — but slow down and re-read the table.", wrong: "Any random ace — A7, A4, whatever — now has you beat. KK goes from boss to bluff-catcher in one card." } },
        { q: "Board runs out with 4 spades; you hold zero spades. Your two pair is…", opts: ["Losing to any single spade", "Still definitely good", "A flush somehow", "Worth an all-in"], a: 0,
          ex: [
            { label: "Board", cards: [{ r: 13, s: 0 }, { r: 9, s: 0 }, { r: 6, s: 0 }, { r: 2, s: 0 }], caption: "Four spades out there." },
            { label: "You", cards: [{ r: 14, s: 1 }, { r: 11, s: 2 }], caption: "Two pair, no spades — losing to any single spade." },
          ],
          fb: { right: "One spade in anyone's hand = flush. Two pair on a 4-flush board is check-and-pray.", wrong: "Four spades out there = anyone holding ONE spade beats you. Two pair shrinks to a bluff-catcher." } },
        { q: "The board PAIRS on the turn (flop 9♦6♣2♥ → turn 6♠). Who just got scarier?", opts: ["Anyone holding a 6 — they have trips now", "Nobody", "Flush draws", "The dealer"], a: 0,
          ex: [
            { label: "Flop", cards: [{ r: 9, s: 1 }, { r: 6, s: 0 }, { r: 2, s: 1 }], caption: "9-6-2." },
            { label: "Turn", cards: [{ r: 6, s: 0 }], caption: "Pair card — trips and boats now live." },
          ],
          fb: { right: "Board pairing turns sneaky little 6s into trips and flopped pairs into boats. Big bets after a pair card mean business.", wrong: "A paired board = trips and full houses just became possible. Sudden aggression there is rarely a bluff at casual tables." } },
        { q: "The 4th card to a straight hits the river (board 5-6-7-x-8). Your top pair should…", opts: ["Slow way down — any 4 or 9 beats you", "Bet huge, you're still top pair", "Fold instantly no matter what", "Ask for a re-deal"], a: 0,
          ex: [{ label: "Board", cards: [{ r: 5, s: 0 }, { r: 6, s: 1 }, { r: 7, s: 2 }, { r: 11, s: 3 }, { r: 8, s: 0 }], caption: "5-6-7-J-8. Any 4 or 9 = straight." }],
          fb: { right: "Any 4 or 9 in anyone's hand made a straight. One pair on that river is showdown material, not betting material.", wrong: "Four-to-a-straight boards murder one-pair hands. Check, and think hard before calling anything big." } },
        { q: "Hearts complete on the river and the table goes quiet. Your set (three of a kind) is now…", opts: ["Beaten by anyone holding one heart", "Still the nuts", "A guaranteed chop", "Stronger than before"], a: 0,
          fb: { right: "A completed flush on the board means any single heart in someone's hand beats your set. Check-fold to big bets.", wrong: "When the flush gets there, sets drop from boss to bluff-catcher. Respect the fourth heart." } },
        { t: "duel" },
      ] },
      { id: "u3l3", title: "What Are They Repping?",
        primer: {
          tagline: "Every bet tells a story. Does the story add up?",
          blocks: [
            { h: "Repping = telling a believable story",
              p: "When someone bets, ask: 'What real hand would play exactly this way?' If their line matches a strong hand (check-call with a flush draw, then bet when it hits), believe them. If it makes no sense, suspect a bluff.",
              ex: [
                { label: "Believable", cards: [{ r: 13, s: 1 }, { r: 9, s: 1 }, { r: 6, s: 1 }, { r: 2, s: 1 }], caption: "Hearts hit the river and he bets — matches a flush." },
              ] },
            { h: "Inconsistent lines lean bluff-heavy",
              p: "Check-call flop, check-call turn, then suddenly bomb a blank river — that's a busted draw trying to steal. Real value usually bets earlier to build the pot. When the story breaks, suspicion up.",
              ex: [
                { label: "Suspicious", cards: [{ r: 13, s: 0 }, { r: 7, s: 2 }, { r: 2, s: 3 }, { r: 9, s: 1 }], caption: "Blank river, sudden bomb — often a busted draw." },
              ] },
            { h: "Showdowns are free data",
              p: "Every time you see someone's cards at showdown, note how they bet that hand. After a few poker nights you'll have a book on each player — and reads become undeniable.",
              ex: [
                { label: "Data point", cards: [], caption: "He bombed river with air again → note it. Pattern = read." },
              ] },
          ],
        },
        questions: [
        { q: "Tight player who never bluffs bombs the river when the flush completes. He has…", opts: ["The flush. Fold. It's the flush.", "Definitely a bluff", "Middle pair", "No clue, call to find out"], a: 0,
          fb: { right: "Tight + scare card + big bet = exactly what it looks like. \"Call to find out\" is a 400-chip tuition payment.", wrong: "When the guy who never bluffs bets the scare card, believe him. Fold and keep your stack." } },
        { q: "Board 2♣2♦7♥7♠K♦, your maniac friend jams. You hold K♣Q♣. What beats you?", opts: ["Only a 2, a 7, or pocket kings", "Everything", "Nothing", "Flushes"], a: 0,
          ex: [
            { label: "Board", cards: [{ r: 2, s: 0 }, { r: 2, s: 1 }, { r: 7, s: 1 }, { r: 7, s: 0 }, { r: 13, s: 1 }], caption: "2-2-7-7-K — no flush possible." },
            { label: "You", cards: [{ r: 13, s: 0 }, { r: 12, s: 0 }], caption: "Kings-up. Short list of hands beat you." },
          ],
          fb: { right: "That's reading the board: an exact, short list of what beats kings-up. Short list + maniac = often a call.", wrong: "Count it: any 2, any 7, or KK. No flushes possible. Vs a maniac, kings-up looks pretty good." } },
        { q: "\"Repping\" a hand means…", opts: ["Betting like your cards match the scary board", "Showing your cards", "Playing two tables", "Rebuying chips"], a: 0,
          fb: { right: "A bluff works when the STORY works — your bets have to match a real hand you'd actually play this way.", wrong: "Repping = telling a believable story with bets. The flush hits, you bet like you have it. Story sells it." } },
        { q: "His story makes no sense — he check-called twice, then jammed a blank river. Often that's…", opts: ["A busted draw giving up… by shoving", "Always the nuts", "A misdeal", "Time to fold everything"], a: 0,
          fb: { right: "Stories that don't add up lean bluff-heavy. Busted draws have exactly one way to win: the panic jam.", wrong: "When the line doesn't match any real hand, suspicion up. Missed draws turn into river bombs constantly." } },
        { q: "The safest habit at showdown when unsure if your call was good:", opts: ["Note what they showed vs how they bet", "Never look", "Argue", "Rage quit"], a: 0,
          fb: { right: "Every showdown is free data: THIS is what his river bomb looks like. Three poker nights of notes = you own the table.", wrong: "Free intel every showdown: match what they showed to how they bet it. That's how reads get built." } },
        { q: "He raised preflop, bet the flop, checked the turn, then bombed the river when the third spade fell. Best read?", opts: ["He's repping the flush — but he'd have bet the turn with a real flush draw", "He has the nuts always", "No idea, always fold", "He has trips"], a: 0,
          ex: [
            { label: "Board", cards: [{ r: 13, s: 0 }, { r: 9, s: 0 }, { r: 4, s: 0 }, { r: 11, s: 2 }, { r: 7, s: 0 }], caption: "Three spades on the river. He checked the turn though — inconsistent." },
          ],
          fb: { right: "If the story is inconsistent (checked turn on a flush draw, then bombed river when it hit) it's often a bluff repping it.", wrong: "People who flop flush draws usually bet the turn too. The check-then-bomb line is a classic bluff pattern." } },
      ] },
      { id: "u3cp", title: "Checkpoint: Read the Room", boss: true,
        primer: {
          tagline: "Boss time. Board-reading under pressure, double stakes.",
          blocks: [
            { h: "Recap",
              p: "1) Wet boards = draw-heavy, bet bigger, trust one-pair less. 2) Dry boards = safe, small bets work. 3) Scare cards (ace on turn, 4th flush card, paired board) demand a re-read. 4) Repping = the story your bets tell — if it's inconsistent, suspect a bluff. 5) Showdowns = free data.",
              ex: [
                { label: "Wet", cards: [{ r: 11, s: 1 }, { r: 10, s: 1 }, { r: 9, s: 0 }], caption: "Bet big, charge draws." },
                { label: "Dry", cards: [{ r: 13, s: 1 }, { r: 7, s: 0 }, { r: 2, s: 2 }], caption: "Bet small, top pair is safe." },
              ] },
          ],
        },
        questions: [
        { q: "Final boss: A♥K♥ on A♠J♠10♠4♣8♦. You bet, tight player raises big. Best read?", opts: ["Flush or straight — top pair is behind", "He's scared of your ace", "Auto-call, top pair top kicker", "He has 72o"], a: 0,
          ex: [
            { label: "You", cards: [{ r: 14, s: 1 }, { r: 13, s: 1 }], caption: "AK hearts — top pair top kicker." },
            { label: "Board", cards: [{ r: 14, s: 0 }, { r: 11, s: 0 }, { r: 10, s: 0 }, { r: 4, s: 0 }, { r: 8, s: 1 }], caption: "Three spades + straight cards. Your AK is behind." },
          ],
          fb: { right: "Three spades + straight cards + tight raise = your AK is a bluff-catcher. Knowing when top pair DIED is the graduation moment.", wrong: "Spade flushes and KQ straights everywhere, and tight players don't raise air there. The fold is the flex." } },
        { t: "duel" },
        { t: "outs", idx: 3 },
        { t: "board" },
        { t: "duel" },
        { t: "outs", idx: 6 },
        { q: "Someone bets big into 4 players on a wet board. Their hand is usually…", opts: ["Real — multiway bluffs are rare", "Always a bluff", "A misclick", "Impossible to say"], a: 0,
          fb: { right: "Bluffing one person is brave; bluffing four is charity. Multiway aggression = believe it.", wrong: "Into a crowd, big bets are honest. Someone always has a piece — bluffs need heads-up, not a party." } },
        { t: "board" },
        { t: "move" },
      ] },
    ],
  },
  {
    id: "u4", title: "Reading People", emoji: "😎", free: false, reward: 250,
    tagline: "The tells that actually matter.",
    lessons: [
      { id: "u4l1", title: "Real Tells vs Fake Tells",
        primer: {
          tagline: "Hollywood got tells wrong. Here's what actually works at home games.",
          blocks: [
            { h: "The glance-then-chip-stack",
              p: "Someone looks at their cards, then immediately glances at their chip stack — they liked what they saw and are already planning a bet. One of the most reliable casual tells.",
              ex: [
                { label: "Strong", cards: [{ r: 14, s: 0 }, { r: 14, s: 1 }], caption: "He looked at chips right after seeing these." },
              ] },
            { h: "Shaky hands = strength, not bluff",
              p: "Counterintuitive but classic: at casual tables, shaking hands come from the excitement of a monster hand, not fear. Amateurs freeze when bluffing, they don't shake.",
              ex: [
                { label: "Monster", cards: [{ r: 13, s: 0 }, { r: 13, s: 1 }, { r: 13, s: 2 }], caption: "Set of kings — his hands are shaking. Be afraid." },
              ] },
            { h: "Nervous talk = weak",
              p: "A quiet player who suddenly starts chatting during your decision is uncomfortable — often a bluff. Real strength is usually silent and relaxed. Don't trust the talk; trust the patterns.",
              ex: [
                { label: "Bluff", cards: [{ r: 7, s: 0 }, { r: 2, s: 1 }], caption: "72o — and he won't stop talking. Guilt leaks." },
              ] },
          ],
        },
        questions: [
        { q: "Your buddy looks at his cards, then suddenly at his chips. Classic tell?", opts: ["He liked what he saw — he's planning a bet", "He's bluffing", "It means nothing", "He wants the bathroom"], a: 0,
          fb: { right: "The glance-then-chip-stack is one of the most reliable casual tells. He's already deciding how much to bet.", wrong: "Looking at chips right after seeing cards = he likes them. People physically prepare to bet." } },
        { q: "Someone's hand shakes when they place a big bet. At a home game this usually means…", opts: ["They're excited — they have a monster", "They're bluffing", "They're nervous in a bad way", "They're cold"], a: 0,
          fb: { right: "Counterintuitive but classic: shaking hands come from the excitement of a huge hand, not fear. Be very afraid.", wrong: "Shaky hands = adrenaline from strength, not a bluff. Amateurs freeze when bluffing, they don't shake." } },
        { q: "A quiet player suddenly starts chatting during your decision. Probably…", opts: ["Uncomfortable — often a bluff", "Totally relaxed with the nuts", "Wants to be your friend", "Time to fold for sure"], a: 0,
          fb: { right: "People who feel guilty (bluffing) often over-explain or talk to seem relaxed. Real strength is usually silent.", wrong: "Nervous talk = nervous money. Players with the nuts typically go quiet and let you decide." } },
        { q: "The single most reliable \"tell\" at a casual table is…", opts: ["Bet sizing patterns over time", "Eye contact", "What they're drinking", "How they stack chips"], a: 0,
          fb: { right: "Patterns beat one-off tells every time. After 3 nights you'll know what his big-bet-on-the-river always means.", wrong: "Long-term patterns are the gold mine. Anyone can fake one hand; nobody can fake twenty." } },
        { t: "duel" },
        { t: "board" },
      ] },
      { id: "u4l2", title: "When to Trust a Read",
        primer: {
          tagline: "Reads adjust the math. They don't replace it.",
          blocks: [
            { h: "Math first, reads second",
              p: "A read can tip a close decision, but it cannot save a -EV call. If the pot odds say fold and you 'feel' bluff, fold. The read only wins when the math is already close.",
              ex: [
                { label: "Bad price", cards: [], caption: "Need 40%, you have 15%. No read rescues this — fold." },
              ] },
            { h: "Patterns need samples",
              p: "A read is only as good as the evidence behind it. One session is a tiny sample. Three nights of watching the same player bomb the river with air — that's a pattern you can trust your stack to.",
              ex: [
                { label: "Pattern", cards: [], caption: "He's bluffed the river 3× tonight → snap call with medium." },
              ] },
            { h: "Great folds come from data",
              p: "Pros fold 'obvious' calls because they KNOW the player, not because they feel it. Build the book on each regular and the reads become undeniable. The data is the edge.",
              ex: [
                { label: "Great fold", cards: [{ r: 13, s: 0 }, { r: 13, s: 1 }], caption: "Fold KK to the tight player's 4-bet — he has AA, every time." },
              ] },
          ],
        },
        questions: [
        { q: "You \"feel\" he's bluffing but the math says fold. What wins?", opts: ["The math, every time", "Your gut, always", "Flip a coin", "Ask the table"], a: 0,
          fb: { right: "Reads adjust the math — they don't replace it. If the price is bad, no read is strong enough to fix it.", wrong: "Math first, reads second. A great read might tip a close decision, but it can't save a -EV call." } },
        { q: "You've seen this guy bluff 3 times tonight. He bombs the river. You have a medium hand. You…", opts: ["Call — the pattern says bluff", "Fold, he might have it this time", "All-in", "Tank for 5 minutes"], a: 0,
          fb: { right: "That's a read built on evidence. A 3-time bluffer bombing the river with you holding medium = snap call.", wrong: "You've collected the data. The pattern is a tell. Trust it and call — this is how reads pay off." } },
        { q: "You've played with him ONCE. He shoves the river. How much do you trust your read?", opts: ["Very little — not enough data", "Totally", "I trust my gut", "I'd ask to see his cards"], a: 0,
          fb: { right: "One session is a tiny sample. Treat this as a math decision, not a read decision.", wrong: "You need a pattern, and patterns take time. One night isn't enough to call off your stack on a read." } },
        { q: "The best players fold \"obvious\" calls when their read is strong. This works because…", opts: ["Trust is built on a pattern of observations, not a feeling", "They're just lucky", "They never actually fold", "It's a bluff itself"], a: 0,
          fb: { right: "Great folds come from great data. The pros fold because they KNOW, not because they feel.", wrong: "Big folds come from patterns, not vibes. Build the book on each player and the reads get undeniable." } },
        { t: "board" },
        { t: "duel" },
        { t: "name" },
        { t: "move" },
      ] },
      { id: "u4cp", title: "Checkpoint: The Full Picture", boss: true,
        primer: {
          tagline: "Final boss. Board, odds, and people — all at once.",
          blocks: [
            { h: "Recap",
              p: "1) Tells: glance-then-chips = strength, shaking = strength, nervous talk = bluff. 2) Math beats reads — reads tip close calls, they don't rescue bad ones. 3) Patterns need samples — 3 nights > 1 hand. 4) Great folds come from data. 5) Combine board-reading + odds + reads for the full picture.",
              ex: [
                { label: "Tight player 4-bets", cards: [{ r: 14, s: 0 }, { r: 14, s: 1 }], caption: "He never 4-bets light. He has aces. Fold KK." },
              ] },
            { h: "Final boss",
              p: "Every challenge type, mixed, double stakes. This is the graduation — pot odds + board reading + reads in one room." },
          ],
        },
        questions: [
        { q: "Tight player limps for the first time all night, then calls your raise. On the flop he checks. You bet and he snaps all-in. Read?", opts: ["He has a monster — he was trapping", "He's bluffing for the first time", "He misclicked", "Coin flip, call it off"], a: 0,
          fb: { right: "Tight player breaking pattern = strength. The limp-call-shove line from someone who never limps is the nuts, basically.", wrong: "When the tight player breaks their pattern, it's never a bluff. Snap fold." } },
        { t: "duel" },
        { t: "outs", idx: 2 },
        { t: "board" },
        { t: "duel" },
        { q: "You've been at the table 4 hours. The maniac just made it 8x preflop for the 5th time. You pick up Q♣Q♦. You…", opts: ["Reraise — the pattern says he has nothing special", "Fold, respect the raise", "Just call", "All-in, flips are fun"], a: 0,
          ex: [{ label: "You", cards: [{ r: 12, s: 0 }, { r: 12, s: 1 }], caption: "QQ crushes his wide 8x range." }],
          fb: { right: "The pattern is the read: his 8x range is wide. QQ is way ahead of that range — reraise and print chips.", wrong: "You've watched him do this with trash all night. QQ crushes his range. Punish the pattern." } },
        { t: "outs", idx: 0 },
        { t: "board" },
      ] },
    ],
  },
];

export interface SwipeHand {
  c: Card[];
  pos: string;
  play: boolean;
  why: string;
}

export const SWIPE_HANDS: SwipeHand[] = [
  { c: [{ r: 14, s: 0 }, { r: 14, s: 1 }], pos: "Any position", play: true, why: "Aces. If you fold these we can't be friends." },
  { c: [{ r: 7, s: 0 }, { r: 2, s: 1 }], pos: "Any position", play: false, why: "The worst hand in poker. Iconic, but fold." },
  { c: [{ r: 14, s: 2 }, { r: 13, s: 2 }], pos: "Any position", play: true, why: "AK suited — top-5 hand, raise it with a straight face." },
  { c: [{ r: 9, s: 1 }, { r: 4, s: 3 }], pos: "Early position", play: false, why: "9-4 off is a nothing hand. Early position makes it worse." },
  { c: [{ r: 10, s: 0 }, { r: 10, s: 2 }], pos: "Middle position", play: true, why: "Tens are a real pair. Raise, don't limp." },
  { c: [{ r: 11, s: 1 }, { r: 10, s: 1 }], pos: "On the button", play: true, why: "JT suited on the button is a dream — position + playability." },
  { c: [{ r: 13, s: 0 }, { r: 9, s: 3 }], pos: "Early position", play: false, why: "K9 off up front is how you lose to KQ. Fold." },
  { c: [{ r: 8, s: 2 }, { r: 8, s: 3 }], pos: "On the button", play: true, why: "Pair on the button with everyone folded? Raise it." },
  { c: [{ r: 14, s: 3 }, { r: 5, s: 0 }], pos: "Middle position", play: false, why: "Weak ace, no suit, middle seat — the classic trap hand. Fold." },
  { c: [{ r: 12, s: 1 }, { r: 11, s: 1 }], pos: "Middle position", play: true, why: "QJ suited plays great — draws to big straights and flushes." },
  { c: [{ r: 14, s: 0 }, { r: 10, s: 1 }], pos: "Middle position", play: true, why: "AT suited is a strongish ace — playable in most seats, raise in late." },
  { c: [{ r: 6, s: 2 }, { r: 2, s: 3 }], pos: "Any position", play: false, why: "62 off — pure trash. Even on the button this is a fold to a raise." },
  { c: [{ r: 13, s: 0 }, { r: 13, s: 2 }], pos: "Early position", play: true, why: "Pocket kings. Raise. The only thing that beats you preflop is AA." },
  { c: [{ r: 11, s: 0 }, { r: 3, s: 2 }], pos: "Early position", play: false, why: "J3 off is a fold anywhere. Don't fall in love with a face card." },
  { c: [{ r: 9, s: 1 }, { r: 8, s: 1 }], pos: "On the button", play: true, why: "Suited connectors on the button are a goldmine — cheap, position, draws." },
  { c: [{ r: 14, s: 1 }, { r: 9, s: 3 }], pos: "Early position", play: false, why: "A9 off up front = dominated by every AT/AJ/AQ. Fold it." },
  { c: [{ r: 7, s: 0 }, { r: 7, s: 1 }], pos: "Middle position", play: true, why: "Pocket pair, middle position — raise to thin the field or call to set-mine." },
  { c: [{ r: 10, s: 2 }, { r: 5, s: 1 }], pos: "Early position", play: false, why: "T5 offsuit — no straight potential, no suit. Easy fold." },
  { c: [{ r: 12, s: 2 }, { r: 12, s: 3 }], pos: "Early position", play: true, why: "Pocket queens. Raise it. Top-3 hand, fear only KK and AA." },
  { c: [{ r: 14, s: 2 }, { r: 4, s: 2 }], pos: "On the button", play: true, why: "A4 suited on the button — flush potential, wheel straight draw, raise if folded to you." },
];

/** All 10 poker hand category names, best → worst. Used by the Name That Hand drill. */
export const HAND_NAMES: string[] = [
  "Royal Flush", "Straight Flush", "Four of a Kind", "Full House", "Flush",
  "Straight", "Three of a Kind", "Two Pair", "Pair", "High Card",
];

export const CHEAT_RANKS: { n: string; ex: Card[] }[] = [
  { n: "Royal Flush", ex: [{ r: 14, s: 0 }, { r: 13, s: 0 }, { r: 12, s: 0 }, { r: 11, s: 0 }, { r: 10, s: 0 }] },
  { n: "Straight Flush", ex: [{ r: 9, s: 1 }, { r: 8, s: 1 }, { r: 7, s: 1 }, { r: 6, s: 1 }, { r: 5, s: 1 }] },
  { n: "Four of a Kind", ex: [{ r: 8, s: 0 }, { r: 8, s: 1 }, { r: 8, s: 2 }, { r: 8, s: 3 }, { r: 13, s: 0 }] },
  { n: "Full House", ex: [{ r: 11, s: 0 }, { r: 11, s: 1 }, { r: 11, s: 2 }, { r: 4, s: 0 }, { r: 4, s: 1 }] },
  { n: "Flush", ex: [{ r: 13, s: 3 }, { r: 10, s: 3 }, { r: 8, s: 3 }, { r: 6, s: 3 }, { r: 2, s: 3 }] },
  { n: "Straight", ex: [{ r: 10, s: 0 }, { r: 9, s: 1 }, { r: 8, s: 2 }, { r: 7, s: 3 }, { r: 6, s: 0 }] },
  { n: "Three of a Kind", ex: [{ r: 6, s: 0 }, { r: 6, s: 1 }, { r: 6, s: 2 }, { r: 14, s: 3 }, { r: 9, s: 0 }] },
  { n: "Two Pair", ex: [{ r: 12, s: 0 }, { r: 12, s: 1 }, { r: 7, s: 2 }, { r: 7, s: 3 }, { r: 3, s: 0 }] },
  { n: "One Pair", ex: [{ r: 10, s: 1 }, { r: 10, s: 2 }, { r: 14, s: 0 }, { r: 8, s: 3 }, { r: 4, s: 1 }] },
  { n: "High Card", ex: [{ r: 14, s: 0 }, { r: 11, s: 1 }, { r: 8, s: 2 }, { r: 5, s: 3 }, { r: 2, s: 0 }] },
];

export const CHEAT_TERMS: [string, string][] = [
  ["The Nuts", "The best possible hand right now. If you have it, you literally cannot lose the hand."],
  ["Outs", "Cards left in the deck that improve your hand. Flush draw = 9, open-ended straight = 8."],
  ["Pot Odds", "The price of calling vs the pot size. Small bet = you can chase; huge bet = you usually can't."],
  ["On Tilt", "Playing angry after a bad beat. The #1 way people lose their whole buy-in. Breathe."],
  ["Kicker", "Your side card that breaks ties. A-K beats A-Q on an ace-high board because K > Q."],
  ["The Blinds", "Forced bets from the two players left of the dealer. They keep the game moving."],
  ["Limp", "Just calling the big blind instead of raising. Usually weak. Raise or fold, mostly."],
  ["Bad Beat", "Losing when you were a big favorite. It WILL happen tonight. It means the math was on your side."],
];

export const PO_DRAWS: [string, string, string][] = [
  ["Flush draw", "9 outs", "36"],
  ["Open-ended straight", "8 outs", "32"],
  ["Two overcards", "6 outs", "24"],
  ["Gutshot straight", "4 outs", "16"],
  ["Set to full house+", "7 outs", "28"],
];

export const OUTS_REF: [string, string, string, number][] = [
  ["♥", "Flush draw", "4 suited, need the 5th", 9],
  ["📏", "Open-ended straight", "like 9-8 on 7-6-2", 8],
  ["🔀", "Combo draw", "flush + straight draw", 15],
  ["👑", "Two overcards", "AK on a low board", 6],
  ["🕳️", "Gutshot", "inside straight draw", 4],
  ["🎲", "Pocket pair → set", "under the board", 2],
  ["🏠", "Two pair → full house", "4 cards pair the board", 4],
];

export interface SquadMember {
  n: string;
  a: string;
  chips: number;
  st: number;
  me?: boolean;
}

/**
 * Stage 1: The Friends leaderboard is built dynamically from the user's friend list
 * (in GameProvider) plus the user themselves. This interface is kept for type
 * compatibility but SQUAD is now an empty array — real data comes from Supabase
 * in Phase 2.
 */
export const SQUAD: SquadMember[] = [];

/**
 * Seed entries for the Global leaderboard (Stage 1 placeholder — Stage 2 will
 * replace this with a live Supabase query). Bankrolls are staged so a new
 * player with the 5000 starting stack lands around the middle of the board
 * and can climb by earning chips.
 */
export interface GlobalSeed {
  n: string;
  a: string;
  chips: number;
  st: number;
  cc: string; // country flag emoji
}

export const GLOBAL_SEED: GlobalSeed[] = [
  { n: "VegasVic", a: "👑", chips: 184200, st: 47, cc: "🇺🇸" },
  { n: "RiverRat", a: "🐀", chips: 121500, st: 39, cc: "🇨🇦" },
  { n: "AllInAnnie", a: "💥", chips: 98700, st: 33, cc: "🇬🇧" },
  { n: "FlopTurnRiver", a: "🌊", chips: 76300, st: 28, cc: "🇦🇺" },
  { n: "BluffKing", a: "🤡", chips: 54200, st: 22, cc: "🇧🇷" },
  { n: "SetMineSam", a: "⛏️", chips: 38900, st: 19, cc: "🇩🇪" },
  { n: "PocketAces", a: "🃏", chips: 27400, st: 15, cc: "🇸🇪" },
  { n: "TiltTamer", a: "🧘", chips: 18600, st: 12, cc: "🇯🇵" },
  { n: "DonkeyDan", a: "🐴", chips: 9200, st: 8, cc: "🇲🇽" },
  { n: "FishNChips", a: "🐟", chips: 3400, st: 5, cc: "🇮🇪" },
  { n: "NewbieNick", a: "🐣", chips: 1200, st: 2, cc: "🇫🇷" },
];
