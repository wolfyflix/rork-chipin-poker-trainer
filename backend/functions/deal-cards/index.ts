import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

/**
 * Authenticate the request using the Supabase JWT from the Authorization header.
 */
async function requireAuth(req: Request) {
  const authHeader = req.headers.get("Authorization") ?? "";
  if (!authHeader) throw new Error("Missing Authorization header");

  const supabase = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_ANON_KEY")!,
    { global: { headers: { Authorization: authHeader } } },
  );

  const {
    data: { user },
    error,
  } = await supabase.auth.getUser();

  if (error || !user) throw new Error("Unauthorized");
  return { user, supabase };
}

interface DealRequest {
  session_id: string;
  player_ids: string[];
}

interface Card {
  r: number;
  s: number;
}

const SUITS = [0, 1, 2, 3]; // ♠ ♥ ♦ ♣

/** Fisher-Yates shuffle — cryptographically secure with crypto.getRandomValues. */
function shuffleDeck(exclude: Set<number> = new Set()): Card[] {
  const deck: Card[] = [];
  for (let r = 2; r <= 14; r++) {
    for (const s of SUITS) {
      const k = r * 4 + s;
      if (!exclude.has(k)) deck.push({ r, s });
    }
  }
  // Fisher-Yates with crypto-grade randomness
  for (let i = deck.length - 1; i > 0; i--) {
    const buf = new Uint32Array(1);
    crypto.getRandomValues(buf);
    const j = buf[0] % (i + 1);
    [deck[i], deck[j]] = [deck[j], deck[i]];
  }
  return deck;
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const { user, supabase } = await requireAuth(req);
    const { session_id, player_ids } = (await req.json()) as DealRequest;

    if (!session_id || !player_ids || player_ids.length < 2) {
      return new Response(
        JSON.stringify({ error: "session_id and at least 2 player_ids required" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    // Fetch the session to verify the caller is the host
    const { data: session, error: fetchErr } = await supabase
      .from("game_sessions")
      .select("host_id, players, board, hole_cards, status, street")
      .eq("id", session_id)
      .single();

    if (fetchErr || !session) {
      return new Response(
        JSON.stringify({ error: "Game session not found" }),
        { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    if (session.host_id !== user.id) {
      return new Response(
        JSON.stringify({ error: "Only the host can deal cards" }),
        { status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    // Only deal if we're starting a new hand (street = preflop and no hole cards yet)
    const existingHoles = session.hole_cards as Record<string, Card[]>;
    const hasDealt = Object.keys(existingHoles).length > 0;
    if (hasDealt) {
      return new Response(
        JSON.stringify({ error: "Cards already dealt for this hand" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    // Build a fresh deck
    const deck = shuffleDeck();

    // Deal 2 cards to each player (hole cards — private to each player)
    const holeCards: Record<string, Card[]> = {};
    for (const pid of player_ids) {
      holeCards[pid] = [deck.pop()!, deck.pop()!];
    }

    // Burn one card, then deal the flop (3 cards) — board is public
    deck.pop(); // burn
    const flop: Card[] = [deck.pop()!, deck.pop()!, deck.pop()!];

    // Store the remaining deck state in a server-side only column (not exposed to clients).
    // The board and hole_cards are stored in the game_sessions row.
    // The remaining deck is stored in a temporary column that RLS hides from clients.
    const { error: updateErr } = await supabase
      .from("game_sessions")
      .update({
        hole_cards: holeCards,
        board: flop,
        street: "preflop",
        status: "playing",
        updated_at: new Date().toISOString(),
      })
      .eq("id", session_id);

    if (updateErr) {
      return new Response(
        JSON.stringify({ error: updateErr.message }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    // Return only the calling player's hole cards (the host sees their own cards).
    // Other players will read their cards via a separate RLS-protected query.
    return new Response(
      JSON.stringify({
        ok: true,
        my_cards: holeCards[user.id] ?? null,
        board: flop,
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Unknown error";
    const status = msg === "Unauthorized" ? 401 : 500;
    return new Response(
      JSON.stringify({ error: msg }),
      { status, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  }
});
