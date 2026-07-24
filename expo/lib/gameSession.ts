import { supabase } from "@/lib/supabase";

/**
 * Game session module — handles Supabase game_sessions CRUD + Realtime sync.
 * The host is the dealer authority: they write the authoritative game state.
 * Other players subscribe to row changes and render what the host broadcasts.
 */

/** A player seated at a table (stored as JSON in the players array). */
export interface SessionPlayer {
  id: string;
  name: string;
  avatar: string;
  seat: number;
  stack: number;
  folded: boolean;
  bet: number;
  totalCommitted: number;
  hasActed: boolean;
  allIn: boolean;
  revealed: boolean;
  isAI: boolean;
  isHost: boolean;
}

/** Table configuration stored in the config JSON column. */
export interface SessionConfig {
  maxPlayers: number;
  buyIn: number;
  smallBlind: number;
  bigBlind: number;
  startStack: number;
}

/** The full row shape we read/write from game_sessions. */
export interface GameSession {
  id: string;
  host_id: string;
  config: SessionConfig;
  players: SessionPlayer[];
  board: { r: number; s: number }[];
  pot: number;
  current_turn: number;
  dealer_seat: number;
  street: string;
  status: string;
  hole_cards: Record<string, { r: number; s: number }[]>;
  last_action: {
    player_id: string;
    action: "fold" | "check" | "call" | "raise";
    amount?: number;
    timestamp: number;
  } | null;
  created_at: string | null;
  updated_at: string | null;
}

/**
 * Create a new game session. The host is the first player.
 * Returns the session ID so it can be shared via invite links.
 */
export async function createGameSession(
  hostId: string,
  hostName: string,
  hostAvatar: string,
  config: SessionConfig,
): Promise<{ id: string } | { error: string }> {
  try {
    const hostPlayer: SessionPlayer = {
      id: hostId,
      name: hostName,
      avatar: hostAvatar,
      seat: 0,
      stack: config.startStack,
      folded: false,
      bet: 0,
      totalCommitted: 0,
      hasActed: false,
      allIn: false,
      revealed: false,
      isAI: false,
      isHost: true,
    };

    const { data, error } = await supabase
      .from("game_sessions")
      .insert({
        host_id: hostId,
        config,
        players: [hostPlayer],
        board: [],
        pot: 0,
        current_turn: 0,
        dealer_seat: 0,
        street: "waiting",
        status: "waiting",
        hole_cards: {},
        last_action: null,
      })
      .select("id")
      .single();

    if (error) return { error: error.message };
    return { id: data.id };
  } catch {
    return { error: "Couldn't create game session." };
  }
}

/**
 * Join an existing game session. Adds the player to the players array
 * and assigns them the next available seat.
 */
export async function joinGameSession(
  sessionId: string,
  playerId: string,
  playerName: string,
  playerAvatar: string,
  startStack: number,
): Promise<{ ok: boolean; error: string | null }> {
  try {
    // Fetch current session
    const { data: session, error: fetchErr } = await supabase
      .from("game_sessions")
      .select("players, config, status")
      .eq("id", sessionId)
      .single();

    if (fetchErr || !session) return { ok: false, error: "Game not found." };
    if (session.status === "finished" || session.status === "cancelled") {
      return { ok: false, error: "This game has ended." };
    }

    const players = session.players as SessionPlayer[];
    if (players.some((p) => p.id === playerId)) {
      return { ok: false, error: "You're already at this table." };
    }

    const config = session.config as SessionConfig;
    if (players.length >= config.maxPlayers) {
      return { ok: false, error: "Table is full." };
    }

    const newPlayer: SessionPlayer = {
      id: playerId,
      name: playerName,
      avatar: playerAvatar,
      seat: players.length,
      stack: startStack,
      folded: false,
      bet: 0,
      totalCommitted: 0,
      hasActed: false,
      allIn: false,
      revealed: false,
      isAI: false,
      isHost: false,
    };

    const { error: updateErr } = await supabase
      .from("game_sessions")
      .update({ players: [...players, newPlayer] })
      .eq("id", sessionId);

    if (updateErr) return { ok: false, error: updateErr.message };
    return { ok: true, error: null };
  } catch {
    return { ok: false, error: "Couldn't join game." };
  }
}

/**
 * Update the game state. Only the host should call this — they are the
 * dealer authority. Writes the full state atomically.
 */
export async function updateGameState(
  sessionId: string,
  patch: Partial<GameSession>,
): Promise<{ ok: boolean; error: string | null }> {
  try {
    const { error } = await supabase
      .from("game_sessions")
      .update({
        ...patch,
        updated_at: new Date().toISOString(),
      })
      .eq("id", sessionId);

    if (error) return { ok: false, error: error.message };
    return { ok: true, error: null };
  } catch {
    return { ok: false, error: "Couldn't update game state." };
  }
}

/**
 * Subscribe to real-time changes on a game session.
 * Returns an unsubscribe function.
 */
export function subscribeToSession(
  sessionId: string,
  onUpdate: (session: GameSession) => void,
): () => void {
  const channel = supabase
    .channel(`game_session:${sessionId}`)
    .on(
      "postgres_changes",
      {
        event: "*",
        schema: "public",
        table: "game_sessions",
        filter: `id=eq.${sessionId}`,
      },
      (payload) => {
        if (payload.new) {
          onUpdate(payload.new as GameSession);
        }
      },
    )
    .subscribe();

  return () => {
    supabase.removeChannel(channel);
  };
}

/**
 * Track presence on a game session channel — shows who's online at the table.
 * Returns an unsubscribe function.
 */
export function trackPresence(
  sessionId: string,
  playerId: string,
  playerName: string,
  playerAvatar: string,
  onPresenceUpdate: (present: { id: string; name: string; avatar: string }[]) => void,
): () => void {
  const channel = supabase.channel(`presence:${sessionId}`);

  channel
    .on("presence", { event: "sync" }, () => {
      const state = channel.presenceState<{ id: string; name: string; avatar: string }>();
      const present: { id: string; name: string; avatar: string }[] = [];
      for (const key in state) {
        for (const entry of state[key]) {
          present.push({ id: entry.id, name: entry.name, avatar: entry.avatar });
        }
      }
      onPresenceUpdate(present);
    })
    .subscribe(async (status) => {
      if (status === "SUBSCRIBED") {
        await channel.track({ id: playerId, name: playerName, avatar: playerAvatar });
      }
    });

  return () => {
    supabase.removeChannel(channel);
  };
}

/** Leave a game session — remove the player from the players array. */
export async function leaveGameSession(
  sessionId: string,
  playerId: string,
): Promise<{ ok: boolean; error: string | null }> {
  try {
    const { data: session, error: fetchErr } = await supabase
      .from("game_sessions")
      .select("players, host_id, status")
      .eq("id", sessionId)
      .single();

    if (fetchErr || !session) return { ok: false, error: "Game not found." };

    const players = session.players as SessionPlayer[];
    const remaining = players.filter((p) => p.id !== playerId);

    // If the host left, assign host to the next real player or cancel the game
    const newHost = session.host_id === playerId;
    let patch: Record<string, unknown> = { players: remaining };
    if (newHost) {
      const nextReal = remaining.find((p) => !p.isAI);
      if (nextReal) {
        patch = {
          ...patch,
          host_id: nextReal.id,
          players: remaining.map((p) => ({ ...p, isHost: p.id === nextReal.id })),
        };
      } else {
        patch = { ...patch, status: "cancelled" };
      }
    }

    const { error: updateErr } = await supabase
      .from("game_sessions")
      .update(patch)
      .eq("id", sessionId);

    if (updateErr) return { ok: false, error: updateErr.message };
    return { ok: true, error: null };
  } catch {
    return { ok: false, error: "Couldn't leave game." };
  }
}
