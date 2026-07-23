import React, { useCallback, useMemo, useRef, useState } from "react";
import {
  Animated,
  LayoutAnimation,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  UIManager,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useRouter } from "expo-router";
import { UserPlus, Wifi, WifiOff, Trash2, Spade, Send } from "lucide-react-native";

import ChipIcon from "@/components/ChipIcon";
import PressButton from "@/components/PressButton";
import TopBar from "@/components/TopBar";
import colors from "@/constants/colors";
import { GLOBAL_SEED, SQUAD } from "@/lib/curriculum";
import { useGame } from "@/providers/GameProvider";

const MEDALS = ["\u{1F947}", "\u{1F948}", "\u{1F949}"];

type Tab = "friends" | "global" | "list";

if (Platform.OS === "android" && UIManager.setLayoutAnimationEnabledExperimental) {
  UIManager.setLayoutAnimationEnabledExperimental(true);
}

interface LeaderRow {
  n: string;
  a: string;
  chips: number;
  st: number;
  me?: boolean;
  country?: string;
}

export default function SquadScreen() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { chips, streak, friends, addFriend, removeFriend, sendFriendRequest, invitedToTable, toggleInviteFriend } = useGame();
  const [tab, setTab] = useState<Tab>("friends");
  const [notice, setNotice] = useState<string | null>(null);
  const [addOpen, setAddOpen] = useState<boolean>(false);
  const [handle, setHandle] = useState<string>("");
  const [inviteMode, setInviteMode] = useState<boolean>(false);
  const noticeTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const friendsRows = useMemo<LeaderRow[]>(() => {
    const rows = SQUAD.map((m) => (m.me ? { ...m, chips, st: streak } : m));
    return rows.sort((a, b) => b.chips - a.chips);
  }, [chips, streak]);

  const globalRows = useMemo<LeaderRow[]>(() => {
    const me: LeaderRow = { n: "you", a: "\u{1F99B}", chips, st: streak, me: true, country: "\u{1F1FA}\u{1F1F8}" };
    const seeded: LeaderRow[] = GLOBAL_SEED.map((g) => ({
      n: g.n,
      a: g.a,
      chips: g.chips,
      st: g.st,
      country: g.cc,
    }));
    const all = [...seeded, me].sort((a, b) => b.chips - a.chips);
    return all;
  }, [chips, streak]);

  const rows = tab === "friends" ? friendsRows : tab === "global" ? globalRows : [];
  const myRank = rows.findIndex((r) => r.me) + 1;

  const switchTab = useCallback((t: Tab) => {
    if (t === tab) return;
    LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
    setTab(t);
    setInviteMode(false);
  }, [tab]);

  const flash = useCallback((msg: string) => {
    setNotice(msg);
    if (noticeTimer.current) clearTimeout(noticeTimer.current);
    noticeTimer.current = setTimeout(() => setNotice(null), 2300);
  }, []);

  const invite = useCallback(() => {
    flash("Invite link copied — send it to the gc \u{1F517}");
  }, [flash]);

  const sendRequest = useCallback(() => {
    const clean = handle.trim().replace(/^@/, "");
    if (!clean) {
      flash("Drop a username first \u270B");
      return;
    }
    const added = addFriend(clean);
    if (added) {
      flash(`@${clean} added to your friends! \u{1F91D}`);
    } else {
      flash(`You're already friends with @${clean}`);
    }
    setAddOpen(false);
    setHandle("");
  }, [handle, flash, addFriend]);

  const handleRemoveFriend = useCallback((id: string, name: string) => {
    removeFriend(id);
    flash(`Removed ${name} from friends`);
  }, [removeFriend, flash]);

  const handleInviteToGame = useCallback((friendId: string, friendName: string) => {
    toggleInviteFriend(friendId);
    const isInvited = invitedToTable.has(friendId);
    if (!isInvited) {
      flash(`Invited ${friendName} to your next game! \u{1F3B2}`);
    } else {
      flash(`Uninvited ${friendName}`);
    }
  }, [toggleInviteFriend, invitedToTable, flash]);

  const goToTable = useCallback(() => {
    router.push("/(tabs)/table");
  }, [router]);

  const podium = rows.slice(0, 3);
  const rest = rows.slice(3);
  const onlineFriends = friends.filter((f) => f.online);
  const offlineFriends = friends.filter((f) => !f.online);

  return (
    <View style={[styles.screen, { paddingTop: insets.top }]}>
      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: 32 }}>
        <TopBar title="Squad" showChips={false} />

        {/* Tab switcher — now 3 tabs */}
        <View style={styles.tabBar}>
          <Pressable
            style={[styles.tab, tab === "friends" && styles.tabActive]}
            onPress={() => switchTab("friends")}
          >
            <Text style={[styles.tabText, tab === "friends" && styles.tabTextActive]}>{"\u{1F3C6}"} Friends</Text>
          </Pressable>
          <Pressable
            style={[styles.tab, tab === "global" && styles.tabActive]}
            onPress={() => switchTab("global")}
          >
            <Text style={[styles.tabText, tab === "global" && styles.tabTextActive]}>{"\u{1F30D}"} Global</Text>
          </Pressable>
          <Pressable
            style={[styles.tab, tab === "list" && styles.tabActive]}
            onPress={() => switchTab("list")}
          >
            <Text style={[styles.tabText, tab === "list" && styles.tabTextActive]}>{"\u{1F465}"} List</Text>
          </Pressable>
        </View>

        {/* ===== FRIENDS LIST TAB ===== */}
        {tab === "list" && (
          <View style={{ marginTop: 4 }}>
            {/* Action bar */}
            <View style={styles.listActionBar}>
              <Pressable style={styles.addFriendBtn} onPress={() => setAddOpen(true)}>
                <UserPlus size={16} color={colors.mint} />
                <Text style={styles.addFriendBtnText}>Add Friend</Text>
              </Pressable>
              <Pressable
                style={[styles.startGameBtn, invitedToTable.size === 0 && styles.startGameBtnDim]}
                onPress={goToTable}
              >
                <Spade size={16} color={colors.mintInk} />
                <Text style={styles.startGameBtnText}>
                  {invitedToTable.size > 0 ? `Start Game (${invitedToTable.size})` : "New Game"}
                </Text>
              </Pressable>
            </View>

            {/* Invited to game banner */}
            {invitedToTable.size > 0 && (
              <View style={styles.invitedBanner}>
                <Text style={styles.invitedBannerText}>
                  {"\u{1F3B2}"} {invitedToTable.size} friend{invitedToTable.size > 1 ? "s" : ""} invited to your next game
                </Text>
                <Pressable onPress={goToTable}>
                  <Text style={styles.invitedBannerLink}>Go to Table {"\u2192"}</Text>
                </Pressable>
              </View>
            )}

            {/* Online friends */}
            <Text style={styles.sectionLabel}>
              <Wifi size={12} color={colors.good} />  ONLINE ({onlineFriends.length})
            </Text>
            {onlineFriends.length === 0 ? (
              <View style={styles.emptyState}>
                <Text style={styles.emptyStateText}>No friends online right now</Text>
              </View>
            ) : (
              onlineFriends.map((f) => {
                const isInvited = invitedToTable.has(f.id);
                return (
                  <View key={f.id} style={styles.friendCard}>
                    <View style={styles.friendAvatar}>
                      <Text style={styles.friendAvatarText}>{f.avatar}</Text>
                      <View style={styles.onlineDot} />
                    </View>
                    <View style={{ flex: 1 }}>
                      <Text style={styles.friendName}>{f.name}</Text>
                      <Text style={styles.friendMeta}>
                        <ChipIcon size={9} /> {f.chips.toLocaleString()} {" \u00b7 "} {"\u{1F7E2}"} Online
                      </Text>
                    </View>
                    <Pressable
                      style={[styles.inviteGameBtn, isInvited && styles.inviteGameBtnActive]}
                      onPress={() => handleInviteToGame(f.id, f.name)}
                    >
                      <Text style={styles.inviteGameBtnText}>
                        {isInvited ? "\u2713" : "+"}
                      </Text>
                    </Pressable>
                    <Pressable style={styles.removeBtn} onPress={() => handleRemoveFriend(f.id, f.name)}>
                      <Trash2 size={14} color={colors.dim} />
                    </Pressable>
                  </View>
                );
              })
            )}

            {/* Offline friends */}
            {offlineFriends.length > 0 && (
              <>
                <Text style={[styles.sectionLabel, { marginTop: 16 }]}>
                  <WifiOff size={12} color={colors.dim} />  OFFLINE ({offlineFriends.length})
                </Text>
                {offlineFriends.map((f) => {
                  const isInvited = invitedToTable.has(f.id);
                  return (
                    <View key={f.id} style={[styles.friendCard, styles.friendCardOffline]}>
                      <View style={styles.friendAvatar}>
                        <Text style={styles.friendAvatarText}>{f.avatar}</Text>
                        <View style={styles.offlineDot} />
                      </View>
                      <View style={{ flex: 1 }}>
                        <Text style={[styles.friendName, { opacity: 0.6 }]}>{f.name}</Text>
                        <Text style={styles.friendMeta}>
                          <ChipIcon size={9} /> {f.chips.toLocaleString()} {" \u00b7 "} {"\u26AA"} Offline
                        </Text>
                      </View>
                      <Pressable
                        style={[styles.inviteGameBtn, isInvited && styles.inviteGameBtnActive]}
                        onPress={() => handleInviteToGame(f.id, f.name)}
                      >
                        <Text style={styles.inviteGameBtnText}>
                          {isInvited ? "\u2713" : "+"}
                        </Text>
                      </Pressable>
                      <Pressable style={styles.removeBtn} onPress={() => handleRemoveFriend(f.id, f.name)}>
                        <Trash2 size={14} color={colors.dim} />
                      </Pressable>
                    </View>
                  );
                })}
              </>
            )}

            {friends.length === 0 && (
              <View style={styles.emptyState2}>
                <Text style={styles.emptyState2Emoji}>{"\u{1F91D}"}</Text>
                <Text style={styles.emptyState2Title}>No friends yet</Text>
                <Text style={styles.emptyState2Text}>
                  Add friends to invite them to poker games and compete on the friends leaderboard.
                </Text>
                <PressButton label="Add your first friend" onPress={() => setAddOpen(true)} style={{ marginTop: 16 }} />
              </View>
            )}
          </View>
        )}

        {/* ===== FRIENDS LEADERBOARD TAB ===== */}
        {tab === "friends" && (
          <>
            <View style={styles.leagueBand}>
              <Text style={styles.cup}>{"\u{1F3C6}"}</Text>
              <View style={{ flex: 1 }}>
                <Text style={styles.leagueTitle}>The Basement Boys</Text>
                <Text style={styles.leagueSub}>
                  Biggest bankroll Sunday night takes the crown {" \u00b7 "} {SQUAD.length} members
                </Text>
              </View>
            </View>

            <View style={styles.podiumRow}>
              {podium.map((m, i) => (
                <View
                  key={`${m.n}-${i}`}
                  style={[styles.podium, i === 0 && styles.podiumFirst, m.me && styles.podiumMe]}
                >
                  <Text style={styles.podiumMedal}>{MEDALS[i]}</Text>
                  <View style={[styles.podiumAva, i === 0 && styles.podiumAvaFirst]}>
                    <Text style={styles.podiumAvaText}>{m.a}</Text>
                  </View>
                  <Text style={styles.podiumName} numberOfLines={1}>{m.me ? "you" : m.n}</Text>
                  <View style={styles.podiumChips}>
                    <ChipIcon size={9} />
                    <Text style={styles.podiumChipsNum}>{shortChips(m.chips)}</Text>
                  </View>
                  <Text style={styles.podiumStreak}>{"\u{1F525}"} {m.st}</Text>
                </View>
              ))}
            </View>

            {rest.map((m, i) => {
              const rank = i + 4;
              return (
                <View key={`${m.n}-${i}`} style={[styles.row, m.me && styles.rowMe]}>
                  <Text style={styles.rank}>#{rank}</Text>
                  <View style={styles.ava}>
                    <Text style={styles.avaText}>{m.a}</Text>
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.name} numberOfLines={1}>{m.me ? "you" : m.n}</Text>
                    <Text style={styles.st}>{"\u{1F525}"} {m.st} day streak</Text>
                  </View>
                  <View style={styles.bankroll}>
                    <View style={styles.bankrollRow}>
                      <ChipIcon size={11} />
                      <Text style={styles.bankrollNum}>{m.chips.toLocaleString()}</Text>
                    </View>
                    <Text style={styles.bankrollK}>BANKROLL</Text>
                  </View>
                </View>
              );
            })}

            <PressButton label="\u2795 Add a friend" variant="ghost" onPress={() => setAddOpen(true)} style={styles.addBtn} />
            <PressButton label="Invite the group chat \u{1F517}" onPress={invite} style={styles.inviteBtn} />
            <Text style={styles.footer}>Screenshot this when you hit #1. You know you want to.</Text>
          </>
        )}

        {/* ===== GLOBAL LEADERBOARD TAB ===== */}
        {tab === "global" && (
          <>
            <View style={styles.leagueBand}>
              <Text style={styles.cup}>{"\u{1F310}"}</Text>
              <View style={{ flex: 1 }}>
                <Text style={styles.leagueTitle}>ChipIn Global</Text>
                <Text style={styles.leagueSub}>
                  Top players this week {" \u00b7 "} you're #{myRank || "\u2014"} of {globalRows.length}
                </Text>
              </View>
            </View>

            <View style={styles.podiumRow}>
              {podium.map((m, i) => (
                <View
                  key={`${m.n}-${i}`}
                  style={[styles.podium, i === 0 && styles.podiumFirst, m.me && styles.podiumMe]}
                >
                  <Text style={styles.podiumMedal}>{MEDALS[i]}</Text>
                  <View style={[styles.podiumAva, i === 0 && styles.podiumAvaFirst]}>
                    <Text style={styles.podiumAvaText}>{m.a}</Text>
                  </View>
                  <Text style={styles.podiumName} numberOfLines={1}>{m.me ? "you" : m.n}</Text>
                  <View style={styles.podiumChips}>
                    <ChipIcon size={9} />
                    <Text style={styles.podiumChipsNum}>{shortChips(m.chips)}</Text>
                  </View>
                  {m.country ? (
                    <Text style={styles.podiumCountry}>{m.country}</Text>
                  ) : (
                    <Text style={styles.podiumStreak}>{"\u{1F525}"} {m.st}</Text>
                  )}
                </View>
              ))}
            </View>

            <View style={styles.myRankPill}>
              <Text style={styles.myRankLabel}>YOUR RANK</Text>
              <Text style={styles.myRankNum}>#{myRank || "\u2014"}</Text>
              <View style={styles.myRankChips}>
                <ChipIcon size={10} />
                <Text style={styles.myRankChipsNum}>{chips.toLocaleString()}</Text>
              </View>
            </View>

            {rest.map((m, i) => {
              const rank = i + 4;
              return (
                <View key={`${m.n}-${i}`} style={[styles.row, m.me && styles.rowMe]}>
                  <Text style={styles.rank}>#{rank}</Text>
                  <View style={styles.ava}>
                    <Text style={styles.avaText}>{m.a}</Text>
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.name} numberOfLines={1}>{m.me ? "you" : m.n}</Text>
                    <Text style={styles.st}>
                      {m.country ? `${m.country} {" \u00b7 "}` : ""}{"\u{1F525}"} {m.st} day streak
                    </Text>
                  </View>
                  <View style={styles.bankroll}>
                    <View style={styles.bankrollRow}>
                      <ChipIcon size={11} />
                      <Text style={styles.bankrollNum}>{m.chips.toLocaleString()}</Text>
                    </View>
                    <Text style={styles.bankrollK}>BANKROLL</Text>
                  </View>
                </View>
              );
            })}

            <Text style={styles.footer}>
              Global ranks update every Monday {" \u00b7 "} climb by stacking chips in The Table and Arena
            </Text>
          </>
        )}
      </ScrollView>

      {/* Add friend sheet */}
      {addOpen && (
        <View style={styles.promptWrap}>
          <Pressable style={styles.backdrop} onPress={() => setAddOpen(false)} />
          <View style={styles.sheet}>
            <Text style={styles.sheetEmoji}>{"\u{1F91D}"}</Text>
            <Text style={styles.sheetTitle}>Add a friend</Text>
            <Text style={styles.sheetCopy}>
              Drop their ChipIn username and we'll add them to your friends list. Then you can invite them to poker games.
            </Text>
            <View style={styles.inputWrap}>
              <Text style={styles.inputPrefix}>@</Text>
              <TextInput
                style={styles.input}
                placeholder="username"
                placeholderTextColor={colors.dim}
                value={handle}
                onChangeText={setHandle}
                autoCapitalize="none"
                autoCorrect={false}
                returnKeyType="send"
                onSubmitEditing={sendRequest}
              />
            </View>
            <PressButton label="Add friend" onPress={sendRequest} />
            <PressButton label="Cancel" variant="ghost" onPress={() => setAddOpen(false)} />
          </View>
        </View>
      )}

      {notice && (
        <View style={[styles.toast, { top: insets.top + 56 }]}>
          <Text style={styles.toastText}>{notice}</Text>
        </View>
      )}
    </View>
  );
}

function shortChips(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1).replace(/\.0$/, "")}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(1).replace(/\.0$/, "")}K`;
  return String(n);
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.bg },
  tabBar: {
    flexDirection: "row",
    marginHorizontal: 16,
    marginTop: 4,
    marginBottom: 12,
    backgroundColor: colors.surface,
    borderRadius: 14,
    padding: 4,
    borderWidth: 1,
    borderColor: colors.line,
  },
  tab: { flex: 1, paddingVertical: 10, alignItems: "center", borderRadius: 10 },
  tabActive: { backgroundColor: colors.mint },
  tabText: { fontSize: 12, fontFamily: "Outfit_800ExtraBold", color: colors.muted, letterSpacing: 0.2 },
  tabTextActive: { color: colors.mintInk },

  // ---- Friends List tab ----
  listActionBar: {
    flexDirection: "row",
    gap: 8,
    marginHorizontal: 16,
    marginBottom: 12,
  },
  addFriendBtn: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
    backgroundColor: "rgba(198,238,199,0.1)",
    borderWidth: 1,
    borderColor: colors.mintDeep,
    borderRadius: 14,
    paddingVertical: 12,
  },
  addFriendBtnText: { fontSize: 13, fontFamily: "Outfit_800ExtraBold", color: colors.mint },
  startGameBtn: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
    backgroundColor: colors.mint,
    borderRadius: 14,
    paddingVertical: 12,
  },
  startGameBtnDim: { opacity: 0.5 },
  startGameBtnText: { fontSize: 13, fontFamily: "Outfit_900Black", color: colors.mintInk },

  invitedBanner: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginHorizontal: 16,
    marginBottom: 14,
    padding: 12,
    paddingHorizontal: 16,
    borderRadius: 14,
    backgroundColor: "rgba(198,238,199,0.08)",
    borderWidth: 1,
    borderColor: colors.mintDeep,
  },
  invitedBannerText: { fontSize: 12.5, fontFamily: "Outfit_700Bold", color: colors.mint, flex: 1 },
  invitedBannerLink: { fontSize: 13, fontFamily: "Outfit_900Black", color: colors.mint, marginLeft: 8 },

  sectionLabel: {
    fontSize: 11,
    fontFamily: "Outfit_900Black",
    color: colors.dim,
    letterSpacing: 1,
    marginHorizontal: 20,
    marginBottom: 8,
    textTransform: "uppercase",
  },

  emptyState: {
    marginHorizontal: 16,
    padding: 20,
    alignItems: "center",
    backgroundColor: colors.surface,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: colors.line,
  },
  emptyStateText: { fontSize: 13, color: colors.dim, fontFamily: "Outfit_600SemiBold" },

  friendCard: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    padding: 13,
    paddingHorizontal: 16,
    marginHorizontal: 16,
    marginVertical: 3,
    borderRadius: 18,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.line,
  },
  friendCardOffline: { opacity: 0.7 },

  friendAvatar: {
    width: 46,
    height: 46,
    borderRadius: 15,
    backgroundColor: colors.bg2,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
    borderColor: colors.line,
    position: "relative",
  },
  friendAvatarText: { fontSize: 22 },
  onlineDot: {
    position: "absolute",
    bottom: -1,
    right: -1,
    width: 12,
    height: 12,
    borderRadius: 6,
    backgroundColor: colors.good,
    borderWidth: 2,
    borderColor: colors.surface,
  },
  offlineDot: {
    position: "absolute",
    bottom: -1,
    right: -1,
    width: 12,
    height: 12,
    borderRadius: 6,
    backgroundColor: colors.dim,
    borderWidth: 2,
    borderColor: colors.surface,
  },
  friendName: { fontFamily: "Outfit_800ExtraBold", fontSize: 15, color: colors.cream },
  friendMeta: { fontSize: 12, color: colors.muted, fontFamily: "Outfit_600SemiBold", marginTop: 2 },

  inviteGameBtn: {
    width: 36,
    height: 36,
    borderRadius: 12,
    backgroundColor: "rgba(198,238,199,0.1)",
    borderWidth: 1.5,
    borderColor: colors.mintDeep,
    alignItems: "center",
    justifyContent: "center",
  },
  inviteGameBtnActive: {
    backgroundColor: colors.mint,
    borderColor: colors.mint,
  },
  inviteGameBtnText: { fontSize: 18, fontFamily: "Outfit_900Black", color: colors.mint },
  removeBtn: {
    width: 30,
    height: 30,
    borderRadius: 10,
    backgroundColor: "rgba(228,87,61,0.08)",
    alignItems: "center",
    justifyContent: "center",
  },

  emptyState2: {
    marginHorizontal: 16,
    marginTop: 20,
    padding: 28,
    alignItems: "center",
    backgroundColor: colors.surface,
    borderRadius: 24,
    borderWidth: 1,
    borderColor: colors.line,
  },
  emptyState2Emoji: { fontSize: 44, marginBottom: 8 },
  emptyState2Title: { fontSize: 18, fontFamily: "Outfit_900Black", color: colors.cream, marginBottom: 6 },
  emptyState2Text: { fontSize: 13, color: colors.muted, fontFamily: "Outfit_600SemiBold", textAlign: "center", lineHeight: 19 },

  // ---- Leaderboard shared ----
  leagueBand: {
    marginHorizontal: 16,
    marginBottom: 14,
    padding: 16,
    paddingHorizontal: 18,
    borderRadius: 24,
    flexDirection: "row",
    alignItems: "center",
    gap: 14,
    backgroundColor: "rgba(233,196,100,0.09)",
    borderWidth: 1,
    borderColor: "rgba(233,196,100,0.25)",
  },
  cup: { fontSize: 32 },
  leagueTitle: { fontSize: 16, fontFamily: "Outfit_900Black", color: colors.gold2 },
  leagueSub: { fontSize: 12.5, color: colors.muted, fontFamily: "Outfit_600SemiBold", lineHeight: 17 },

  podiumRow: {
    flexDirection: "row",
    justifyContent: "center",
    alignItems: "flex-end",
    gap: 10,
    marginHorizontal: 16,
    marginBottom: 14,
  },
  podium: {
    flex: 1,
    alignItems: "center",
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.line,
    borderRadius: 18,
    paddingVertical: 14,
    paddingHorizontal: 6,
    gap: 4,
  },
  podiumFirst: {
    borderColor: "rgba(233,196,100,0.45)",
    backgroundColor: "rgba(233,196,100,0.07)",
    paddingVertical: 18,
  },
  podiumMe: { borderColor: colors.mintDeep, backgroundColor: "rgba(198,238,199,0.08)" },
  podiumMedal: { fontSize: 22 },
  podiumAva: {
    width: 42,
    height: 42,
    borderRadius: 14,
    backgroundColor: colors.bg2,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
    borderColor: colors.line,
  },
  podiumAvaFirst: { width: 52, height: 52, borderRadius: 16, borderColor: "rgba(233,196,100,0.4)" },
  podiumAvaText: { fontSize: 22 },
  podiumName: {
    fontSize: 12.5,
    fontFamily: "Outfit_800ExtraBold",
    color: colors.cream,
    maxWidth: 90,
    textAlign: "center",
  },
  podiumChips: { flexDirection: "row", alignItems: "center", gap: 4 },
  podiumChipsNum: { fontFamily: "Outfit_900Black", color: colors.gold2, fontSize: 13 },
  podiumStreak: { fontSize: 11, color: colors.muted, fontFamily: "Outfit_700Bold" },
  podiumCountry: { fontSize: 13 },

  myRankPill: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginHorizontal: 16,
    marginBottom: 12,
    padding: 14,
    paddingHorizontal: 16,
    borderRadius: 16,
    backgroundColor: "rgba(198,238,199,0.08)",
    borderWidth: 1,
    borderColor: colors.mintDeep,
  },
  myRankLabel: { fontSize: 10.5, fontFamily: "Outfit_900Black", color: colors.mint, letterSpacing: 1.1 },
  myRankNum: { fontSize: 20, fontFamily: "Outfit_900Black", color: colors.cream },
  myRankChips: { flexDirection: "row", alignItems: "center", gap: 5 },
  myRankChipsNum: { fontFamily: "Outfit_800ExtraBold", color: colors.chipText, fontSize: 14 },

  row: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    padding: 13,
    paddingHorizontal: 16,
    marginHorizontal: 16,
    marginVertical: 4,
    borderRadius: 18,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.line,
  },
  rowMe: { borderColor: colors.mintDeep, backgroundColor: "rgba(198,238,199,0.07)" },
  rank: { fontFamily: "Outfit_900Black", fontSize: 15, width: 34, color: colors.dim },
  ava: {
    width: 44,
    height: 44,
    borderRadius: 14,
    backgroundColor: colors.bg2,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
    borderColor: colors.line,
  },
  avaText: { fontSize: 22 },
  name: { fontFamily: "Outfit_800ExtraBold", fontSize: 15, color: colors.cream },
  st: { fontSize: 12, color: colors.muted, fontFamily: "Outfit_600SemiBold" },
  bankroll: { alignItems: "flex-end" },
  bankrollRow: { flexDirection: "row", alignItems: "center", gap: 5 },
  bankrollNum: { fontFamily: "Outfit_900Black", color: colors.gold2, fontSize: 15 },
  bankrollK: { fontSize: 10, color: colors.dim, fontFamily: "Outfit_700Bold", letterSpacing: 1 },

  addBtn: { marginHorizontal: 16, marginTop: 12 },
  inviteBtn: { marginHorizontal: 16, marginTop: 10 },
  footer: {
    textAlign: "center",
    color: colors.dim,
    fontSize: 12,
    fontFamily: "Outfit_600SemiBold",
    marginTop: 12,
    marginHorizontal: 24,
  },

  toast: {
    position: "absolute",
    alignSelf: "center",
    backgroundColor: "#16281C",
    borderWidth: 1,
    borderColor: colors.lineStrong,
    paddingVertical: 11,
    paddingHorizontal: 18,
    borderRadius: 14,
    zIndex: 60,
  },
  toastText: { color: colors.cream, fontFamily: "Outfit_700Bold", fontSize: 13.5 },

  promptWrap: { position: "absolute", top: 0, bottom: 0, left: 0, right: 0, justifyContent: "flex-end", zIndex: 80 },
  backdrop: { flex: 1, backgroundColor: "rgba(3,8,5,0.6)" },
  sheet: {
    backgroundColor: "#101A13",
    borderTopLeftRadius: 26,
    borderTopRightRadius: 26,
    borderTopWidth: 1,
    borderColor: colors.lineStrong,
    padding: 20,
    paddingBottom: 36,
    alignItems: "stretch",
  },
  sheetEmoji: { fontSize: 44, textAlign: "center", marginBottom: 6 },
  sheetTitle: {
    fontFamily: "Outfit_900Black",
    fontSize: 20,
    textAlign: "center",
    color: colors.cream,
    marginBottom: 8,
  },
  sheetCopy: {
    color: colors.muted,
    fontSize: 13.5,
    fontFamily: "Outfit_600SemiBold",
    lineHeight: 20,
    textAlign: "center",
    marginBottom: 18,
  },
  inputWrap: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: colors.bg2,
    borderWidth: 1,
    borderColor: colors.line,
    borderRadius: 14,
    paddingHorizontal: 14,
    paddingVertical: 4,
    marginBottom: 16,
  },
  inputPrefix: { fontSize: 18, fontFamily: "Outfit_800ExtraBold", color: colors.muted, marginRight: 4 },
  input: {
    flex: 1,
    color: colors.cream,
    fontFamily: "Outfit_700Bold",
    fontSize: 16,
    paddingVertical: 12,
  },
});
