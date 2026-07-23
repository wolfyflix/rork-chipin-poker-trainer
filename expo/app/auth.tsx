import React, { useCallback, useState } from "react";
import {
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useRouter } from "expo-router";
import { Mail, Phone, Apple, Chrome, Eye, EyeOff } from "lucide-react-native";

import PressButton from "@/components/PressButton";
import colors from "@/constants/colors";
import { useAuth } from "@/providers/AuthProvider";

type Mode = "signup" | "signin" | "phone";

export default function AuthScreen() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { signUp, signIn, signInWithGoogle, signInWithApple, signInWithPhone, verifyOtp } = useAuth();

  const [mode, setMode] = useState<Mode>("signup");
  const [name, setName] = useState<string>("");
  const [email, setEmail] = useState<string>("");
  const [password, setPassword] = useState<string>("");
  const [phone, setPhone] = useState<string>("");
  const [otp, setOtp] = useState<string>("");
  const [showPw, setShowPw] = useState<boolean>(false);
  const [busy, setBusy] = useState<boolean>(false);
  const [err, setErr] = useState<string | null>(null);
  const [otpSent, setOtpSent] = useState<boolean>(false);
  const [success, setSuccess] = useState<string | null>(null);

  const clearErr = useCallback(() => {
    setErr(null);
    setSuccess(null);
  }, []);

  const handleSignUp = useCallback(async () => {
    clearErr();
    if (!email.trim() || !password.trim() || !name.trim()) {
      setErr("Fill in your name, email, and password.");
      return;
    }
    if (password.length < 6) {
      setErr("Password must be at least 6 characters.");
      return;
    }
    setBusy(true);
    const res = await signUp(email.trim(), password, name.trim());
    setBusy(false);
    if (res.error) {
      setErr(res.error);
    } else {
      setSuccess("Check your email for a confirmation link, then sign in.");
      setMode("signin");
    }
  }, [email, password, name, signUp, clearErr]);

  const handleSignIn = useCallback(async () => {
    clearErr();
    if (!email.trim() || !password.trim()) {
      setErr("Enter your email and password.");
      return;
    }
    setBusy(true);
    const res = await signIn(email.trim(), password);
    setBusy(false);
    if (res.error) {
      setErr(res.error);
    } else {
      router.dismiss();
    }
  }, [email, password, signIn, router, clearErr]);

  const handleGoogle = useCallback(async () => {
    clearErr();
    setBusy(true);
    const res = await signInWithGoogle();
    setBusy(false);
    if (res.error) setErr(res.error);
  }, [signInWithGoogle, clearErr]);

  const handleApple = useCallback(async () => {
    clearErr();
    setBusy(true);
    const res = await signInWithApple();
    setBusy(false);
    if (res.error) setErr(res.error);
  }, [signInWithApple, clearErr]);

  const handleSendOtp = useCallback(async () => {
    clearErr();
    if (!phone.trim()) {
      setErr("Enter your phone number in E.164 format (e.g. +15551234567).");
      return;
    }
    setBusy(true);
    const res = await signInWithPhone(phone.trim());
    setBusy(false);
    if (res.error) {
      setErr(res.error);
    } else {
      setOtpSent(true);
      setSuccess("Code sent — check your texts.");
    }
  }, [phone, signInWithPhone, clearErr]);

  const handleVerifyOtp = useCallback(async () => {
    clearErr();
    if (!otp.trim() || !phone.trim()) {
      setErr("Enter the code we sent you.");
      return;
    }
    setBusy(true);
    const res = await verifyOtp(phone.trim(), otp.trim());
    setBusy(false);
    if (res.error) {
      setErr(res.error);
    } else {
      router.dismiss();
    }
  }, [otp, phone, verifyOtp, router, clearErr]);

  const skipToGuest = useCallback(() => {
    router.dismiss();
  }, [router]);

  const SUITS = ["♠", "♥", "♦", "♣"];

  return (
    <View style={[styles.screen, { paddingTop: insets.top, paddingBottom: insets.bottom }]}>
      <KeyboardAvoidingView behavior={Platform.OS === "ios" ? "padding" : undefined} style={{ flex: 1 }}>
        <ScrollView contentContainerStyle={{ flexGrow: 1, justifyContent: "center" }} keyboardShouldPersistTaps="handled">
          {/* Header */}
          <View style={styles.header}>
            <View style={styles.suitRow}>
              {SUITS.map((s, i) => (
                <Text key={i} style={[styles.suit, s === "♥" || s === "♦" ? styles.suitRed : styles.suitBlack]}>
                  {s}
                </Text>
              ))}
            </View>
            <Text style={styles.logo}>
              <Text style={styles.logoChip}>Chip</Text>
              <Text style={styles.logoIn}>In</Text>
            </Text>
            <Text style={styles.tagline}>
              {mode === "signup" ? "Create your account" : mode === "signin" ? "Welcome back" : "Sign up with phone"}
            </Text>
          </View>

          {/* Card */}
          <View style={styles.card}>
            {/* Mode switcher */}
            <View style={styles.modeBar}>
              <Pressable
                style={[styles.modeTab, mode === "signup" && styles.modeTabActive]}
                onPress={() => { setMode("signup"); clearErr(); }}
              >
                <Text style={[styles.modeTabText, mode === "signup" && styles.modeTabTextActive]}>Sign Up</Text>
              </Pressable>
              <Pressable
                style={[styles.modeTab, mode === "signin" && styles.modeTabActive]}
                onPress={() => { setMode("signin"); clearErr(); }}
              >
                <Text style={[styles.modeTabText, mode === "signin" && styles.modeTabTextActive]}>Sign In</Text>
              </Pressable>
              <Pressable
                style={[styles.modeTab, mode === "phone" && styles.modeTabActive]}
                onPress={() => { setMode("phone"); clearErr(); setOtpSent(false); }}
              >
                <Text style={[styles.modeTabText, mode === "phone" && styles.modeTabTextActive]}>Phone</Text>
              </Pressable>
            </View>

            {/* Email/password fields */}
            {mode !== "phone" && (
              <View style={styles.fields}>
                {mode === "signup" && (
                  <View style={styles.inputWrap}>
                    <TextInput
                      style={styles.input}
                      placeholder="Your name"
                      placeholderTextColor={colors.dim}
                      value={name}
                      onChangeText={(v) => { setName(v); clearErr(); }}
                      autoCapitalize="words"
                      returnKeyType="next"
                    />
                  </View>
                )}
                <View style={styles.inputWrap}>
                  <Mail size={18} color={colors.dim} style={styles.inputIcon} />
                  <TextInput
                    style={styles.input}
                    placeholder="Email"
                    placeholderTextColor={colors.dim}
                    value={email}
                    onChangeText={(v) => { setEmail(v); clearErr(); }}
                    autoCapitalize="none"
                    autoCorrect={false}
                    keyboardType="email-address"
                    returnKeyType="next"
                  />
                </View>
                <View style={styles.inputWrap}>
                  <TextInput
                    style={[styles.input, { flex: 1 }]}
                    placeholder="Password"
                    placeholderTextColor={colors.dim}
                    value={password}
                    onChangeText={(v) => { setPassword(v); clearErr(); }}
                    secureTextEntry={!showPw}
                    autoCapitalize="none"
                    autoCorrect={false}
                    returnKeyType="done"
                    onSubmitEditing={mode === "signup" ? handleSignUp : handleSignIn}
                  />
                  <Pressable onPress={() => setShowPw((s) => !s)} style={styles.eyeBtn}>
                    {showPw ? <EyeOff size={18} color={colors.dim} /> : <Eye size={18} color={colors.dim} />}
                  </Pressable>
                </View>
                <PressButton
                  label={busy ? "Hold up…" : mode === "signup" ? "Create account" : "Sign in"}
                  onPress={mode === "signup" ? handleSignUp : handleSignIn}
                  disabled={busy}
                  style={{ marginTop: 4 }}
                />
              </View>
            )}

            {/* Phone OTP fields */}
            {mode === "phone" && (
              <View style={styles.fields}>
                <View style={styles.inputWrap}>
                  <Phone size={18} color={colors.dim} style={styles.inputIcon} />
                  <TextInput
                    style={styles.input}
                    placeholder="+1 555 123 4567"
                    placeholderTextColor={colors.dim}
                    value={phone}
                    onChangeText={(v) => { setPhone(v); clearErr(); }}
                    autoCapitalize="none"
                    autoCorrect={false}
                    keyboardType="phone-pad"
                    returnKeyType="done"
                    onSubmitEditing={handleSendOtp}
                  />
                </View>
                {otpSent && (
                  <View style={styles.inputWrap}>
                    <TextInput
                      style={styles.input}
                      placeholder="6-digit code"
                      placeholderTextColor={colors.dim}
                      value={otp}
                      onChangeText={(v) => { setOtp(v); clearErr(); }}
                      autoCapitalize="none"
                      autoCorrect={false}
                      keyboardType="number-pad"
                      returnKeyType="done"
                      onSubmitEditing={handleVerifyOtp}
                    />
                  </View>
                )}
                {!otpSent ? (
                  <PressButton label={busy ? "Sending…" : "Send code"} onPress={handleSendOtp} disabled={busy} style={{ marginTop: 4 }} />
                ) : (
                  <PressButton label={busy ? "Verifying…" : "Verify & sign in"} onPress={handleVerifyOtp} disabled={busy} style={{ marginTop: 4 }} />
                )}
              </View>
            )}

            {/* Error / success messages */}
            {err && <Text style={styles.errText}>{err}</Text>}
            {success && <Text style={styles.successText}>{success}</Text>}

            {/* Divider */}
            <View style={styles.divider}>
              <View style={styles.dividerLine} />
              <Text style={styles.dividerText}>OR</Text>
              <View style={styles.dividerLine} />
            </View>

            {/* Social buttons */}
            <Pressable style={[styles.socialBtn, styles.googleBtn]} onPress={handleGoogle} disabled={busy}>
              <Chrome size={20} color="#E9C464" />
              <Text style={styles.socialBtnText}>Continue with Google</Text>
            </Pressable>
            <Pressable style={[styles.socialBtn, styles.appleBtn]} onPress={handleApple} disabled={busy}>
              <Apple size={20} color={colors.cream} />
              <Text style={styles.socialBtnText}>Continue with Apple</Text>
            </Pressable>
          </View>

          {/* Guest mode */}
          <Pressable style={styles.skipBtn} onPress={skipToGuest}>
            <Text style={styles.skipText}>Skip for now — play as guest</Text>
          </Pressable>
          <Text style={styles.skipSub}>
            Your progress saves locally. Create an account later to sync across devices and add friends.
          </Text>
        </ScrollView>
      </KeyboardAvoidingView>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: colors.bg,
  },
  header: {
    alignItems: "center",
    paddingTop: 20,
    paddingBottom: 24,
  },
  suitRow: {
    flexDirection: "row",
    gap: 16,
    marginBottom: 14,
  },
  suit: {
    fontSize: 22,
  },
  suitRed: { color: colors.cardRed },
  suitBlack: { color: colors.mintDeep },
  logo: {
    fontSize: 34,
    fontFamily: "Outfit_900Black",
    letterSpacing: -0.8,
  },
  logoChip: { color: colors.cream },
  logoIn: { color: colors.mint },
  tagline: {
    fontSize: 14,
    color: colors.muted,
    fontFamily: "Outfit_600SemiBold",
    marginTop: 6,
  },
  card: {
    marginHorizontal: 20,
    padding: 22,
    borderRadius: 28,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.line,
  },
  modeBar: {
    flexDirection: "row",
    backgroundColor: colors.bg2,
    borderRadius: 14,
    padding: 4,
    marginBottom: 20,
  },
  modeTab: {
    flex: 1,
    paddingVertical: 10,
    alignItems: "center",
    borderRadius: 10,
  },
  modeTabActive: {
    backgroundColor: colors.mint,
  },
  modeTabText: {
    fontSize: 12.5,
    fontFamily: "Outfit_800ExtraBold",
    color: colors.muted,
    letterSpacing: 0.3,
  },
  modeTabTextActive: {
    color: colors.mintInk,
  },
  fields: {
    gap: 12,
  },
  inputWrap: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: colors.bg2,
    borderWidth: 1,
    borderColor: colors.line,
    borderRadius: 14,
    paddingHorizontal: 14,
    paddingVertical: 2,
  },
  inputIcon: {
    marginRight: 8,
  },
  input: {
    flex: 1,
    color: colors.cream,
    fontFamily: "Outfit_600SemiBold",
    fontSize: 16,
    paddingVertical: 13,
  },
  eyeBtn: {
    padding: 8,
  },
  errText: {
    color: colors.red,
    fontSize: 12.5,
    fontFamily: "Outfit_700Bold",
    marginTop: 12,
    textAlign: "center",
    lineHeight: 18,
  },
  successText: {
    color: colors.good,
    fontSize: 12.5,
    fontFamily: "Outfit_700Bold",
    marginTop: 12,
    textAlign: "center",
    lineHeight: 18,
  },
  divider: {
    flexDirection: "row",
    alignItems: "center",
    marginVertical: 18,
    gap: 12,
  },
  dividerLine: {
    flex: 1,
    height: 1,
    backgroundColor: colors.line,
  },
  dividerText: {
    fontSize: 11,
    fontFamily: "Outfit_800ExtraBold",
    color: colors.dim,
    letterSpacing: 1.5,
  },
  socialBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 10,
    paddingVertical: 15,
    borderRadius: 16,
    marginBottom: 10,
    borderWidth: 1,
  },
  googleBtn: {
    backgroundColor: "rgba(233,196,100,0.08)",
    borderColor: "rgba(233,196,100,0.25)",
  },
  appleBtn: {
    backgroundColor: "rgba(255,255,255,0.05)",
    borderColor: "rgba(255,255,255,0.12)",
  },
  socialBtnText: {
    fontSize: 14.5,
    fontFamily: "Outfit_800ExtraBold",
    color: colors.cream,
    letterSpacing: 0.2,
  },
  skipBtn: {
    alignSelf: "center",
    marginTop: 24,
    paddingVertical: 10,
    paddingHorizontal: 20,
  },
  skipText: {
    fontSize: 14,
    fontFamily: "Outfit_700Bold",
    color: colors.mint,
  },
  skipSub: {
    textAlign: "center",
    fontSize: 11.5,
    color: colors.dim,
    fontFamily: "Outfit_500Medium",
    marginHorizontal: 32,
    lineHeight: 16,
    marginTop: 4,
  },
});
