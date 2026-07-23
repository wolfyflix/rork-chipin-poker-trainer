import { supabase } from "@/lib/supabase";

/**
 * Friends module — handles Supabase friend operations.
 * Friends are bidirectional: when a request is accepted, both rows are created.
 */

export interface FriendProfile {
  id: string;
  name: string;
  avatar: string;
  chips: number;
  streak: number;
  online: boolean;
}

export interface FriendRequestRow {
  id: string;
  from_user_id: string;
  from_name: string;
  from_avatar: string;
  status: string;
  created_at: string;
}

/**
 * Load the user's accepted friends with their profile data.
 * Queries the friends table joined with profiles.
 */
export async function loadFriends(userId: string): Promise<FriendProfile[]> {
  try {
    // Get accepted friend rows where I am user_id
    const { data: rows1, error: e1 } = await supabase
      .from("friends")
      .select("friend_id")
      .eq("user_id", userId)
      .eq("status", "accepted");

    if (e1 || !rows1) return [];

    // Get accepted friend rows where I am friend_id
    const { data: rows2, error: e2 } = await supabase
      .from("friends")
      .select("user_id")
      .eq("friend_id", userId)
      .eq("status", "accepted");

    if (e2 || !rows2) return [];

    const friendIds = [
      ...rows1.map((r: { friend_id: string }) => r.friend_id),
      ...rows2.map((r: { user_id: string }) => r.user_id),
    ];

    if (friendIds.length === 0) return [];

    // Fetch profiles for all friend IDs
    const { data: profiles, error: pe } = await supabase
      .from("profiles")
      .select("id, name, avatar, chips, streak")
      .in("id", friendIds);

    if (pe || !profiles) return [];

    return profiles.map((p: { id: string; name: string; avatar: string; chips: number; streak: number }) => ({
      id: p.id,
      name: p.name ?? "Player",
      avatar: p.avatar ?? "🦈",
      chips: p.chips ?? 0,
      streak: p.streak ?? 0,
      online: false, // Presence will be handled via Realtime in Phase 6
    }));
  } catch {
    return [];
  }
}

/**
 * Search for a user by handle (username) to send a friend request.
 */
export async function findUserByHandle(handle: string): Promise<{ id: string; name: string } | null> {
  try {
    const clean = handle.trim().replace(/^@/, "").toLowerCase();
    const { data, error } = await supabase
      .from("profiles")
      .select("id, name")
      .ilike("handle", clean)
      .limit(1)
      .single();

    if (error || !data) return null;
    return { id: data.id, name: data.name ?? "Player" };
  } catch {
    return null;
  }
}

/**
 * Send a friend request to another user by their profile ID.
 */
export async function sendRequest(fromId: string, toId: string): Promise<{ error: string | null }> {
  try {
    // Check if already friends
    const { data: existing } = await supabase
      .from("friends")
      .select("id")
      .or(`and(user_id.eq.${fromId},friend_id.eq.${toId}),and(user_id.eq.${toId},friend_id.eq.${fromId})`)
      .limit(1);

    if (existing && existing.length > 0) {
      return { error: "You're already friends." };
    }

    // Check for existing pending request
    const { data: pending } = await supabase
      .from("friend_requests")
      .select("id")
      .eq("from_user_id", fromId)
      .eq("to_user_id", toId)
      .eq("status", "pending")
      .limit(1);

    if (pending && pending.length > 0) {
      return { error: "Request already sent." };
    }

    const { error } = await supabase
      .from("friend_requests")
      .insert({ from_user_id: fromId, to_user_id: toId, status: "pending" });

    if (error) return { error: error.message };
    return { error: null };
  } catch {
    return { error: "Couldn't send request." };
  }
}

/**
 * Load incoming friend requests for a user.
 */
export async function loadIncomingRequests(userId: string): Promise<FriendRequestRow[]> {
  try {
    const { data, error } = await supabase
      .from("friend_requests")
      .select("id, from_user_id, status, created_at")
      .eq("to_user_id", userId)
      .eq("status", "pending")
      .order("created_at", { ascending: false });

    if (error || !data || data.length === 0) return [];

    // Fetch sender profiles
    const senderIds = data.map((r: { from_user_id: string }) => r.from_user_id);
    const { data: profiles, error: pe } = await supabase
      .from("profiles")
      .select("id, name, avatar")
      .in("id", senderIds);

    if (pe || !profiles) return [];

    const profileMap = new Map(profiles.map((p: { id: string; name: string; avatar: string }) => [p.id, p]));

    return data
      .filter((r: { from_user_id: string }) => profileMap.has(r.from_user_id))
      .map((r: { id: string; from_user_id: string; status: string; created_at: string }) => {
        const p = profileMap.get(r.from_user_id);
        return {
          id: r.id,
          from_user_id: r.from_user_id,
          from_name: p?.name ?? "Player",
          from_avatar: p?.avatar ?? "🦈",
          status: r.status,
          created_at: r.created_at,
        };
      });
  } catch {
    return [];
  }
}

/**
 * Accept a friend request — creates bidirectional friend rows and marks the request as accepted.
 */
export async function acceptRequest(requestId: string, fromId: string, toId: string): Promise<{ error: string | null }> {
  try {
    // Create bidirectional friendship
    const { error: e1 } = await supabase
      .from("friends")
      .insert({ user_id: toId, friend_id: fromId, status: "accepted" });

    if (e1) return { error: e1.message };

    const { error: e2 } = await supabase
      .from("friends")
      .insert({ user_id: fromId, friend_id: toId, status: "accepted" });

    if (e2) {
      // Rollback the first insert
      await supabase.from("friends").delete().eq("user_id", toId).eq("friend_id", fromId);
      return { error: e2.message };
    }

    // Mark request as accepted
    await supabase
      .from("friend_requests")
      .update({ status: "accepted" })
      .eq("id", requestId);

    return { error: null };
  } catch {
    return { error: "Couldn't accept request." };
  }
}

/**
 * Decline a friend request.
 */
export async function declineRequest(requestId: string): Promise<{ error: string | null }> {
  try {
    const { error } = await supabase
      .from("friend_requests")
      .update({ status: "declined" })
      .eq("id", requestId);

    if (error) return { error: error.message };
    return { error: null };
  } catch {
    return { error: "Couldn't decline request." };
  }
}

/**
 * Remove a friend (both directions).
 */
export async function removeFriendDb(userId: string, friendId: string): Promise<{ error: string | null }> {
  try {
    await supabase.from("friends").delete().eq("user_id", userId).eq("friend_id", friendId);
    await supabase.from("friends").delete().eq("user_id", friendId).eq("friend_id", userId);
    return { error: null };
  } catch {
    return { error: "Couldn't remove friend." };
  }
}
