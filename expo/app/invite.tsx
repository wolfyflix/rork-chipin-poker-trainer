import React, { useCallback, useEffect, useState } from "react";
import { Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useLocalSearchParams, useRouter } from "expo-router";

import ChipIcon from "@/components/ChipIcon";
import PressButton from "@/components/PressButton";
import colors from "@/constants/colors";
import { findUserByHandle, sendRequest } from "@/lib/friends";
import { supabase } from "@/lib/supabase";
import { useAuth } from "@/providers/AuthProvider";

/**
 * Invite screen — opened when someone taps a ChipIn invite deep link.
 * URL format: rork-app://invite?ref=<user_id>
 *
 * If the user isn't signed in, they're prompted to sign up first.
 * If they are signed in, they see who invited them and can accept.
 */
export default function InviteScreen() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const params = useLocalSearchParams<{ ref?: string }>();
  const { user } = useAuth();

  const [inviter, setInviter] = useState<{ name: string; avatar: string } | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [status, setStatus] = useState<"loading" | "ready" | "sent" | "error" | "self">("loading");
  const [errorMsg, setErrorMsg] = useState<string>("");

  const refId = params.ref;

  useEffect(() => {
    if (!refId) {
      setStatus("error");
      setErrorMsg("Invalid invite link.");
      setLoading(false);
      return;
    }

    if (refId === user?.id) {
      setStatus("self");
      setLoading(false);
      return;
    }

    let cancelled = false;
    (async () => {
      try {
        const { data, error } = await supabase
          .from("profiles")
          .select("name, avatar")
          .eq("id", refId)
          .single();

        if (cancelled) return;

        if (error || !data) {
          setStatus("error");
          setErrorMsg("Couldn't find who invited you.");
          setLoading(false);
          return;
        }

        setInviter({ name: data.name ?? "Player", avatar: data.avatar ?? "🦈" });
        setStatus("ready");
        setLoading(false);
      } catch {
        if (!cancelled) {
          setStatus("error");
          setErrorMsg("Something went wrong.");
          setLoading(false);
        }
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [refId, user?.id]);

  const handleAccept = useCallback(async () => {
    if (!user?.id || !refId) return;
    setStatus("loading");

    const res = await sendRequest(user.id, refId);
    if (res.error) {
      setStatus("error");
      setErrorMsg(res.error);
    } else {
      setStatus("sent");
    }
  }, [user?.id, refId]);

  const goHome = useCallback(() => {
    router.replace("/(tabs)/squad");
  }, [router]);

  const goAuth = useCallback(() => {
    router.replace("/auth");
  }, [router]);

  return (
    <View style={[styles.screen, { paddingTop: insets.top, paddingBottom: insets.bottom }]}>
      <ScrollView contentContainerStyle={{ flexGrow: 1, justifyContent: "center" }} showsVerticalScrollIndicator={false}>
        <View style={styles.card}>
          {/* Loading */}
          {loading && <Text style={styles.statusText}>Loading invite…</Text>}

          {/* Error */}
          {status === "error" && (
            <>
              <Text style={styles.emoji}>🤷</Text>
              <Text style={styles.title}>Hmm, that didn't work</Text>
              <Text style={styles.copy}>{errorMsg}</Text>
              <PressButton label="Back to the app" onPress={goHome} style={{ marginTop: 16 }} />
            </>
          )}

          {/* Self-invite */}
          {status === "self" && (
            <>
              <Text style={styles.emoji}>😂</Text>
              <Text style={styles.title}>That's your own link!</Text>
              <Text style={styles.copy}>Share it with friends, not yourself.</Text>
              <PressButton label="Back to the app" onPress={goHome} style={{ marginTop: 16 }} />
            </>
          )}

          {/* Not signed in */}
          {status === "ready" && !user && (
            <>
              <Text style={styles.emoji}>{inviter?.avatar ?? "🦈"}</Text>
              <Text style={styles.title}>{inviter?.name ?? "Someone"} invited you</Text>
              <Text style={styles.copy}>
                Create an account to accept the friend request and start playing poker together.
              </Text>
              <PressButton label="Sign up to accept" onPress={goAuth} style={{ marginTop: 16 }} />
              <PressButton label="Maybe later" variant="ghost" onPress={goHome} />
            </>
          )}

          {/* Ready to accept */}
          {status === "ready" && user && (
            <>
              <Text style={styles.emoji}>{inviter?.avatar ?? "🦈"}</Text>
              <Text style={styles.title}>{inviter?.name ?? "Someone"} invited you</Text>
              <Text style={styles.copy}>
                Accept to add them to your friends list. Then you can invite them to poker games and compete on the friends leaderboard.
              </Text>
              <PressButton label="Accept friend request" onPress={handleAccept} style={{ marginTop: 16 }} />
              <PressButton label="Not now" variant="ghost" onPress={goHome} />
            </>
          )}

          {/* Sent */}
          {status === "sent" && (
            <>
              <Text style={styles.emoji}>🤝</Text>
              <Text style={styles.title}>Request sent!</Text>
              <Text style={styles.copy}>
                Friend request sent to {inviter?.name ?? "them"}. You'll be friends once they accept.
              </Text>
              <PressButton label="Back to Squad" onPress={goHome} style={{ marginTop: 16 }} />
            </>
          )}
        </View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: colors.bg,
  },
  card: {
    marginHorizontal: 20,
    padding: 28,
    borderRadius: 28,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.line,
    alignItems: "center",
  },
  statusText: {
    fontSize: 14,
    color: colors.muted,
    fontFamily: "Outfit_600SemiBold",
  },
  emoji: {
    fontSize: 56,
    marginBottom: 12,
  },
  title: {
    fontSize: 22,
    fontFamily: "Outfit_900Black",
    color: colors.cream,
    textAlign: "center",
    marginBottom: 8,
    letterSpacing: -0.4,
  },
  copy: {
    fontSize: 14,
    color: colors.muted,
    fontFamily: "Outfit_600SemiBold",
    textAlign: "center",
    lineHeight: 20,
  },
});
