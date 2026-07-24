import { supabase } from "./supabase";
import { Card } from "./poker";

/**
 * Hand History module — saves every Who Won result to Supabase.
 * Stored in a `hand_history` table (needs migration).
 */

export interface HandHistoryEntry {
  id: string;
  user_id: string;
  players: { name: string; hand: string }[];
  board: { r: number; s: number }[];
  winners: string[];
  winning_hand: string;
  tie: boolean;
  created_at: string;
}

/**
 * Save a Who Won result to the cloud.
 * Silently fails — the tool still works offline.
 */
export async function saveHandHistory(
  userId: string,
  evals: { name: string; hand: string }[],
  board: Card[],
  winners: string[],
  winningHand: string,
  tie: boolean,
): Promise<void> {
  try {
    await supabase.from("hand_history").insert({
      user_id: userId,
      players: evals,
      board: board.map((c) => ({ r: c.r, s: c.s })),
      winners,
      winning_hand: winningHand,
      tie,
    });
  } catch {
    /* fail soft — local result is still shown */
  }
}

/**
 * Load recent hand history for the user.
 */
export async function loadHandHistory(userId: string, limit: number = 20): Promise<HandHistoryEntry[]> {
  try {
    const { data, error } = await supabase
      .from("hand_history")
      .select("*")
      .eq("user_id", userId)
      .order("created_at", { ascending: false })
      .limit(limit);

    if (error || !data) return [];
    return data as HandHistoryEntry[];
  } catch {
    return [];
  }
}
