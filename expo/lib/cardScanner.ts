/**
 * AI-powered playing card recognition via the Rork Toolkit vision proxy.
 * Sends a photo of a poker table to Google Gemini 3.5 Flash (strong vision model),
 * asks it to identify each visible card (rank + suit), and returns parsed Card objects.
 *
 * Card = { r: 2..14, s: 0..3 } — same shape as the poker engine.
 * s: 0=♠ 1=♥ 2=♦ 3=♣
 */
import { Card } from "./poker";
import { resizeForUpload } from "./resize-for-upload";

const TOOLKIT_URL = process.env.EXPO_PUBLIC_TOOLKIT_URL;
const SECRET_KEY = process.env.EXPO_PUBLIC_RORK_TOOLKIT_SECRET_KEY;

/**
 * Google Gemini 3.5 Flash — excellent vision/OCR capabilities,
 * very affordable ($1.5/M input tokens). Much more accurate than
 * free flash-tier models for reading small text/symbols on cards.
 */
const MODEL_ID = "google/gemini-3.5-flash";

const RANK_MAP: Record<string, number> = {
  "2": 2, "3": 3, "4": 4, "5": 5, "6": 6, "7": 7, "8": 8, "9": 9,
  "10": 10, t: 10,
  j: 11, jack: 11,
  q: 12, queen: 12,
  k: 13, king: 13,
  a: 14, ace: 14,
};

const SUIT_MAP: Record<string, number> = {
  s: 0, spades: 0, spade: 0, "♠": 0,
  h: 1, hearts: 1, heart: 1, "♥": 1,
  d: 2, diamonds: 2, diamond: 2, "♦": 2,
  c: 3, clubs: 3, club: 3, "♣": 3,
};

export interface ScanResult {
  board: (Card | null)[];
  hero: (Card | null)[];
  opponent: (Card | null)[];
  rawText: string;
  confidence: "high" | "partial" | "low";
}

/**
 * Parse a card token like "AH", "10S", "Kd", "Q♣", "ace of spades" into a Card.
 * Returns null if it can't be parsed.
 */
function parseCardToken(token: string): Card | null {
  const clean = token.trim().toLowerCase().replace(/[^a-z0-9♠♥♦♣]/g, "");
  if (!clean) return null;

  // Try symbol-first format like "♠A"
  const symbolMatch = clean.match(/^([♠♥♦♣])([a-z0-9]+)$/);
  if (symbolMatch) {
    const s = SUIT_MAP[symbolMatch[1]];
    const r = RANK_MAP[symbolMatch[2]];
    if (s != null && r != null) return { r, s };
  }

  // Try letter/digit-first format like "AH", "10S", "KD"
  const m = clean.match(/^([a-z]?|10)([shdc♠♥♦♣])$/);
  if (m) {
    const r = RANK_MAP[m[1]];
    const s = SUIT_MAP[m[2]];
    if (r != null && s != null) return { r, s };
  }

  // Try longer formats: "aceofspades", "kingofhearts"
  const longMatch = clean.match(/^([2-9]|10|[ajqk])(?:of)?([shdc]|spades?|hearts?|diamonds?|clubs?|♠♥♦♣])$/);
  if (longMatch) {
    const r = RANK_MAP[longMatch[1]];
    const s = SUIT_MAP[longMatch[2]];
    if (r != null && s != null) return { r, s };
  }

  return null;
}

/**
 * Extract cards from the LLM's text response.
 * Expected format: JSON like {"board": ["AH","KS","2D",...], "hero": ["QC","7S"], "opponent": ["...","..."]}
 * Falls back to parsing line-based formats.
 */
function parseScanResponse(text: string): ScanResult {
  const board: (Card | null)[] = [null, null, null, null, null];
  const hero: (Card | null)[] = [null, null];
  const opponent: (Card | null)[] = [null, null];

  // Try JSON extraction first
  const jsonMatch = text.match(/\{[\s\S]*\}/);
  if (jsonMatch) {
    try {
      const obj = JSON.parse(jsonMatch[0]);
      if (Array.isArray(obj.board)) {
        obj.board.slice(0, 5).forEach((t: unknown, i: number) => {
          const c = parseCardToken(String(t));
          if (c) board[i] = c;
        });
      }
      if (Array.isArray(obj.hero)) {
        obj.hero.slice(0, 2).forEach((t: unknown, i: number) => {
          const c = parseCardToken(String(t));
          if (c) hero[i] = c;
        });
      }
      if (Array.isArray(obj.opponent)) {
        obj.opponent.slice(0, 2).forEach((t: unknown, i: number) => {
          const c = parseCardToken(String(t));
          if (c) opponent[i] = c;
        });
      }
    } catch {
      // fall through to line-based parsing
    }
  }

  // If JSON didn't yield anything, try line-based parsing
  const boardCount = board.filter(Boolean).length;
  if (boardCount === 0 && hero.every((c) => c === null)) {
    const lines = text.split("\n").map((l) => l.trim()).filter(Boolean);
    let section: "board" | "hero" | "opponent" | null = null;
    for (const line of lines) {
      const lower = line.toLowerCase();
      if (lower.includes("board") || lower.includes("community") || lower.includes("table")) {
        section = "board";
        continue;
      }
      if (lower.includes("hero") || lower.includes("your hand") || lower.includes("my hand") || lower.includes("player 1")) {
        section = "hero";
        continue;
      }
      if (lower.includes("opponent") || lower.includes("villain") || lower.includes("player 2") || lower.includes("their hand")) {
        section = "opponent";
        continue;
      }
      if (!section) continue;

      // Extract card-like tokens from the line
      const tokens = line.match(/[2-9TJQKA][SHDC♠♥♦♣]|10[SHDC♠♥♦♣]|[♠♥♦♣][2-9TJQKA]/gi) || [];
      for (const tok of tokens) {
        const c = parseCardToken(tok);
        if (!c) continue;
        const targetArr: (Card | null)[] =
          section === "board" ? board : section === "hero" ? hero : opponent;
        const idx = targetArr.findIndex((x) => x === null);
        if (idx >= 0) targetArr[idx] = c;
      }
    }
  }

  const totalFound =
    board.filter(Boolean).length +
    hero.filter(Boolean).length +
    opponent.filter(Boolean).length;

  const confidence: "high" | "partial" | "low" =
    totalFound >= 7 ? "high" : totalFound >= 4 ? "partial" : "low";

  return { board, hero, opponent, rawText: text, confidence };
}

/**
 * Scan a photo of a poker table and recognize the cards.
 * Uses Google Gemini 3.5 Flash — strong vision/OCR model — via the Rork Toolkit proxy.
 *
 * @param imageUri - local URI from expo-image-picker
 * @returns parsed cards for board, hero, and opponent
 */
export async function scanCards(imageUri: string): Promise<ScanResult> {
  if (!TOOLKIT_URL || !SECRET_KEY) {
    throw new Error("AI scanner not configured — missing toolkit credentials.");
  }

  const { base64 } = await resizeForUpload(imageUri, 4_000_000);

  const prompt = `You are an expert at reading playing cards from photos. You are looking at a photo of a poker table.

TASK: Identify every visible playing card in the photo. For each card, determine its RANK and SUIT.

RANKS: 2, 3, 4, 5, 6, 7, 8, 9, 10, J (Jack), Q (Queen), K (King), A (Ace)
SUITS: S (Spades ♠), H (Hearts ♥), D (Diamonds ♦), C (Clubs ♣)

CARDS ARE ORGANIZED IN THREE GROUPS:
1. "board" — community cards in the CENTER of the table (0 to 5 cards). These may be in a row or fanned out.
2. "hero" — the cards belonging to the person whose perspective the photo is from, usually at the BOTTOM of the image, closest to the camera. Exactly 2 cards if visible.
3. "opponent" — the other player's cards, if they are visible/shown (up to 2 cards). Often NOT visible unless it's a showdown.

HOW TO READ A CARD:
- Look at the rank number/letter printed in the corner(s) of the card.
- Look at the suit symbol (♠ ♥ ♦ ♣) printed next to the rank.
- Hearts and Diamonds are RED. Spades and Clubs are BLACK.
- "10" may appear as "10" or sometimes just "T".
- If a card is face-down or you cannot clearly see it, DO NOT include it.

OUTPUT FORMAT — respond with ONLY a JSON object, no other text:
{"board": ["AH","KS","2D","5C","9H"], "hero": ["QC","7S"], "opponent": ["JS","3D"]}

Rules:
- Use the format RankSuit with no space (e.g. "AH", "10S", "KD", "2C").
- Use empty arrays for any group where no cards are visible.
- Only include cards you can clearly identify. Do not guess.
- Do not include face-down cards.
- If the same card appears multiple times, include it only once.`;

  const body = {
    model: MODEL_ID,
    messages: [
      {
        role: "user",
        content: [
          { type: "text", text: prompt },
          {
            type: "image_url",
            image_url: {
              url: `data:image/jpeg;base64,${base64}`,
            },
          },
        ],
      },
    ],
    max_tokens: 800,
    temperature: 0.1,
  };

  const response = await fetch(`${TOOLKIT_URL}/v2/vercel/v1/chat/completions`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${SECRET_KEY}`,
    },
    body: JSON.stringify(body),
  });

  if (!response.ok) {
    const errText = await response.text().catch(() => "");
    throw new Error(`Scan failed (${response.status}): ${errText.slice(0, 200)}`);
  }

  const data = await response.json();
  const text: string = data?.choices?.[0]?.message?.content ?? "";

  if (!text) {
    throw new Error("AI returned no response — try again or enter cards manually.");
  }

  return parseScanResponse(text);
}
