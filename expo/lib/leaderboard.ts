import { supabase } from "./supabase";

/**
 * Leaderboard module — fetches real player rankings from Supabase.
 * Falls back to mock data if the user isn't authed or the query fails.
 */

export interface LeaderEntry {
  id: string;
  name: string;
  avatar: string;
  chips: number;
  streak: number;
  isMe?: boolean;
}

/**
 * Fetch the global leaderboard — top players by chips.
 * Optionally includes the current user's entry even if outside the top N.
 */
export async function fetchGlobalLeaderboard(
  userId: string | null,
  limit: number = 50,
): Promise<LeaderEntry[]> {
  try {
    const { data, error } = await supabase
      .from("profiles")
      .select("id, name, avatar, chips, streak")
      .order("chips", { ascending: false })
      .limit(limit);

    if (error || !data) return [];

    return data.map((p: { id: string; name: string; avatar: string; chips: number; streak: number }) => ({
      id: p.id,
      name: p.name ?? "Player",
      avatar: p.avatar ?? "🦈",
      chips: p.chips ?? 0,
      streak: p.streak ?? 0,
      isMe: p.id === userId,
    }));
  } catch {
    return [];
  }
}

/**
 * Fetch the friends leaderboard — the user + their friends, sorted by chips.
 */
export async function fetchFriendsLeaderboard(
  userId: string,
  myName: string,
  myAvatar: string,
  myChips: number,
  myStreak: number,
  friendIds: string[],
): Promise<LeaderEntry[]> {
  const me: LeaderEntry = {
    id: userId,
    name: myName,
    avatar: myAvatar,
    chips: myChips,
    streak: myStreak,
    isMe: true,
  };

  if (friendIds.length === 0) return [me];

  try {
    const { data, error } = await supabase
      .from("profiles")
      .select("id, name, avatar, chips, streak")
      .in("id", friendIds);

    if (error || !data) return [me];

    const friends: LeaderEntry[] = data.map((p: { id: string; name: string; avatar: string; chips: number; streak: number }) => ({
      id: p.id,
      name: p.name ?? "Player",
      avatar: p.avatar ?? "🦈",
      chips: p.chips ?? 0,
      streak: p.streak ?? 0,
    }));

    return [...friends, me].sort((a, b) => b.chips - a.chips);
  } catch {
    return [me];
  }
}
