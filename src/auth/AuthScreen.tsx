import React, { useState } from "react";
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  Alert,
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
} from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import * as Haptics from "expo-haptics";
import { signUp, signIn, sendPasswordReset, signInAsGuest } from "./auth";

type Mode = "login" | "signup";

export default function AuthScreen({ onAuthed, theme, isDark }: { onAuthed: () => void; theme?: any; isDark?: boolean }) {
  const t = theme || {
    bg: "#06080F",
    bgGrad: ["#06080F", "#0A0E1A"],
    card: "#0F1320",
    card2: "#0A0D18",
    border: "#1A1F2E",
    border2: "#2A3148",
    text: "#fff",
    muted: "#8B93B8",
    subtle: "#5A6378",
    accent: "#60A5FA",
  };
  const dark = isDark ?? true;
  const [mode, setMode] = useState<Mode>("login");
  const [forgot, setForgot] = useState(false);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [showPass, setShowPass] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [info, setInfo] = useState<string | null>(null);

  const clearMsg = () => {
    setError(null);
    setInfo(null);
  };
  const switchMode = (m: Mode) => {
    Haptics.selectionAsync();
    setMode(m);
    clearMsg();
    setForgot(false);
  };

  const handleLogin = async () => {
    clearMsg();
    if (!email.trim() || !password) {
      setError("Enter email and password");
      return;
    }
    setLoading(true);
    try {
      await signIn(email, password);
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      onAuthed();
    } catch (e: any) {
      setError(e.message || "Login failed");
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
    } finally {
      setLoading(false);
    }
  };

  const handleSignup = async () => {
    clearMsg();
    if (!email.trim() || !password || !confirm) {
      setError("Fill all fields");
      return;
    }
    if (password !== confirm) {
      setError("Passwords do not match");
      return;
    }
    setLoading(true);
    try {
      const { needsConfirmation } = await signUp(email, password);
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      if (needsConfirmation) {
        setInfo("Account created. Check your email to confirm — then Log In.");
        Alert.alert("Verify your email", `We sent a confirmation link to ${email.trim().toLowerCase()}. Tap the link, then come back and log in. If you don't see it, check spam.`);
        setMode("login");
        setPassword("");
        setConfirm("");
      } else {
        onAuthed();
      }
    } catch (e: any) {
      setError(e.message || "Signup failed");
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
    } finally {
      setLoading(false);
    }
  };

  const handleForgotSend = async () => {
    clearMsg();
    if (!email.trim()) {
      setError("Enter your email first");
      return;
    }
    setLoading(true);
    try {
      await sendPasswordReset(email);
      setInfo(`Reset link sent to ${email.trim().toLowerCase()} — check inbox and spam.`);
      Alert.alert("Check your email", "Password reset link sent. Open it to set a new password, then log in here.");
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    } catch (e: any) {
      setError(e.message || "Could not send reset email");
    } finally {
      setLoading(false);
    }
  };

  const handleGuest = async () => {
    clearMsg();
    setLoading(true);
    try {
      await signInAsGuest();
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
      onAuthed();
    } catch (e: any) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  };

  const bgGrad: any = dark ? ["#06080F", "#0A0E1A"] : ["#F8FAFC", "#FFFFFF"];
  const cardBg = t.card;
  const cardStyle: any = [styles.card, { backgroundColor: cardBg, borderColor: t.border }];
  const inputStyle: any = [styles.input, { backgroundColor: t.card2, borderColor: t.border, color: t.text }];
  const primaryStyle: any = [styles.primary, { backgroundColor: dark ? "#fff" : t.text }];
  const primaryTxtStyle: any = [styles.primaryTxt, { color: dark ? "#06080F" : t.bg }];

  if (forgot) {
    return (
      <KeyboardAvoidingView behavior={Platform.OS === "ios" ? "padding" : undefined} style={[styles.root, { backgroundColor: t.bg }]}>
        <LinearGradient colors={bgGrad} style={StyleSheet.absoluteFill} />
        <ScrollView contentContainerStyle={styles.scroll} keyboardShouldPersistTaps="handled">
          <View style={cardStyle}>
            <Text style={[styles.mono, { color: t.muted }]}>DON'T • RESET PASSWORD</Text>
            <Text style={[styles.title, { color: t.text }]}>Forgot password?</Text>
            <Text style={[styles.sub, { color: t.muted }]}>Enter your real email — we'll send a secure reset link via Supabase.</Text>
            <View style={[styles.divider, { backgroundColor: t.border }]} />
            <Text style={[styles.label, { color: t.text }]}>Email</Text>
            <TextInput
              value={email}
              onChangeText={(t2) => { setEmail(t2); clearMsg(); }}
              placeholder="you@example.com"
              placeholderTextColor={t.subtle}
              autoCapitalize="none"
              keyboardType="email-address"
              autoCorrect={false}
              style={inputStyle}
            />
            {error && <Text style={styles.error}>{error}</Text>}
            {info && <Text style={styles.info}>{info}</Text>}
            <TouchableOpacity onPress={handleForgotSend} disabled={loading} style={[primaryStyle, loading && { opacity: 0.6 }]}>
              {loading ? <ActivityIndicator color={dark ? "#06080F" : "#fff"} /> : <Text style={primaryTxtStyle}>Send Reset Link →</Text>}
            </TouchableOpacity>
            <TouchableOpacity onPress={() => setForgot(false)} style={styles.linkBtn}>
              <Text style={[styles.linkTxt, { color: t.accent }]}>← Back to Log In</Text>
            </TouchableOpacity>
            <Text style={[styles.hint, { color: t.subtle }]}>Disposable / temp-mail addresses are blocked.</Text>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    );
  }

  return (
    <KeyboardAvoidingView behavior={Platform.OS === "ios" ? "padding" : undefined} style={[styles.root, { backgroundColor: t.bg }]}>
      <LinearGradient colors={bgGrad} style={StyleSheet.absoluteFill} />
      <ScrollView contentContainerStyle={styles.scroll} keyboardShouldPersistTaps="handled">
        <View style={cardStyle}>
          <Text style={[styles.mono, { color: t.muted }]}>DON'T • AUTH • EMAIL + PASSWORD</Text>
          <Text style={[styles.title, { color: t.text }]}>Welcome to DON'T</Text>
          <Text style={[styles.sub, { color: t.muted }]}>Create an account with your real email or log in. Guest = 3 days free, then email required.</Text>
          <View style={[styles.segment, { backgroundColor: t.card2, borderColor: t.border }]}>
            <TouchableOpacity onPress={() => switchMode("login")} style={[styles.segBtn, mode === "login" && { backgroundColor: t.border, borderColor: t.border2, borderWidth: 1 }]}>
              <Text style={[styles.segTxt, { color: t.muted }, mode === "login" && { color: t.text, fontWeight: "800" }]}>Log In</Text>
            </TouchableOpacity>
            <TouchableOpacity onPress={() => switchMode("signup")} style={[styles.segBtn, mode === "signup" && { backgroundColor: t.border, borderColor: t.border2, borderWidth: 1 }]}>
              <Text style={[styles.segTxt, { color: t.muted }, mode === "signup" && { color: t.text, fontWeight: "800" }]}>Create Account</Text>
            </TouchableOpacity>
          </View>
          <View style={[styles.divider, { backgroundColor: t.border }]} />
          <Text style={[styles.label, { color: t.text }]}>Email</Text>
          <TextInput
            value={email}
            onChangeText={(t2) => { setEmail(t2); clearMsg(); }}
            placeholder="you@example.com"
            placeholderTextColor={t.subtle}
            autoCapitalize="none"
            keyboardType="email-address"
            autoCorrect={false}
            style={inputStyle}
          />
          <Text style={[styles.fieldHint, { color: t.subtle }]}>Real email only — temp-mail / disposable is blocked</Text>
          <Text style={[styles.label, { color: t.text, marginTop: 12 }]}>Password</Text>
          <View style={[styles.passWrap, { backgroundColor: t.card2, borderColor: t.border }]}>
            <TextInput
              value={password}
              onChangeText={(t2) => { setPassword(t2); clearMsg(); }}
              placeholder={mode === "signup" ? "Min 8 chars, letters + numbers" : "Your password"}
              placeholderTextColor={t.subtle}
              secureTextEntry={!showPass}
              autoCapitalize="none"
              style={[styles.input, { flex: 1, marginTop: 0, borderWidth: 0, paddingVertical: 14, backgroundColor: "transparent", color: t.text }]}
            />
            <TouchableOpacity onPress={() => setShowPass((s) => !s)} style={[styles.eyeBtn, { backgroundColor: t.card, borderColor: t.border }]}>
              <Text style={[styles.eyeTxt, { color: t.muted }]}>{showPass ? "Hide" : "Show"}</Text>
            </TouchableOpacity>
          </View>
          {mode === "login" && (
            <TouchableOpacity onPress={() => setForgot(true)} style={{ alignSelf: "flex-end", marginTop: 8 }}>
              <Text style={[styles.linkTxtSmall, { color: t.accent }]}>Forgot password?</Text>
            </TouchableOpacity>
          )}
          {mode === "signup" && (
            <>
              <Text style={[styles.label, { color: t.text, marginTop: 12 }]}>Confirm Password</Text>
              <TextInput
                value={confirm}
                onChangeText={(t2) => { setConfirm(t2); clearMsg(); }}
                placeholder="Repeat password"
                placeholderTextColor={t.subtle}
                secureTextEntry={!showPass}
                autoCapitalize="none"
                style={inputStyle}
              />
              <Text style={[styles.hint, { color: t.subtle }]}>8+ characters, at least one letter and one number. No temp-mail.</Text>
            </>
          )}
          {error && <Text style={styles.error}>{error}</Text>}
          {info && <Text style={styles.info}>{info}</Text>}
          <TouchableOpacity onPress={mode === "login" ? handleLogin : handleSignup} disabled={loading} style={[primaryStyle, loading && { opacity: 0.6 }]}>
            {loading ? <ActivityIndicator color={dark ? "#06080F" : "#fff"} /> : <Text style={primaryTxtStyle}>{mode === "login" ? "Log In →" : "Create Account →"}</Text>}
          </TouchableOpacity>
          {mode === "login" ? (
            <TouchableOpacity onPress={() => switchMode("signup")} style={styles.linkBtn}>
              <Text style={[styles.linkTxt, { color: t.accent }]}>Don't have an account? <Text style={{ color: t.text, fontWeight: "800" }}>Create one</Text></Text>
            </TouchableOpacity>
          ) : (
            <TouchableOpacity onPress={() => switchMode("login")} style={styles.linkBtn}>
              <Text style={[styles.linkTxt, { color: t.accent }]}>Already have an account? <Text style={{ color: t.text, fontWeight: "800" }}>Log In</Text></Text>
            </TouchableOpacity>
          )}
          <View style={styles.orRow}>
            <View style={[styles.orLine, { backgroundColor: t.border }]} />
            <Text style={[styles.orTxt, { color: t.subtle }]}>OR</Text>
            <View style={[styles.orLine, { backgroundColor: t.border }]} />
          </View>
          <TouchableOpacity onPress={handleGuest} disabled={loading} style={[styles.guestBtn, { backgroundColor: t.card2, borderColor: t.border }]}>
            <Text style={styles.guestIcon}>⬢</Text>
            <View style={{ flex: 1 }}>
              <Text style={[styles.guestTitle, { color: t.text }]}>Continue as Guest — 3 days free</Text>
              <Text style={[styles.guestSub, { color: t.muted }]}>No email. Full app. Expires in 3 days → then create account.</Text>
            </View>
            <Text style={[styles.guestArrow, { color: t.subtle }]}>→</Text>
          </TouchableOpacity>
          <Text style={[styles.foot, { color: t.subtle }]}>Supabase Auth • SecureStore • Real accounts • com.dont.jail</Text>
          <Text style={[styles.footSmall, { color: t.subtle, opacity: 0.7 }]}>Disposable emails blocked • Password reset via email • Supabase free 50k MAU</Text>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: "#06080F" },
  scroll: { flexGrow: 1, justifyContent: "center", padding: 20 },
  card: { backgroundColor: "#0F1320", borderWidth: 1, borderColor: "#1A1F2E", borderRadius: 16, padding: 18, gap: 10 },
  mono: { fontFamily: "IBMPlexMono_500Medium", fontSize: 10, color: "#8B93B8", letterSpacing: 1.2, textAlign: "center" },
  title: { fontFamily: "SpaceGrotesk_700Bold", fontSize: 22, color: "#fff", textAlign: "center", marginTop: 4 },
  sub: { fontFamily: "IBMPlexMono_400Regular", fontSize: 12, color: "#AAB2D6", textAlign: "center", lineHeight: 18 },
  divider: { height: 1, backgroundColor: "#1A1F2E", marginVertical: 6 },
  segment: { flexDirection: "row", backgroundColor: "#0A0D18", borderRadius: 10, borderWidth: 1, borderColor: "#1A1F2E", padding: 4, gap: 4, marginTop: 6 },
  segBtn: { flex: 1, paddingVertical: 10, borderRadius: 8, alignItems: "center" },
  segActive: { backgroundColor: "#1A1F2E", borderWidth: 1, borderColor: "#2A3148" },
  segTxt: { color: "#8B93B8", fontSize: 12, fontWeight: "700", letterSpacing: 0.4 },
  segTxtActive: { color: "#fff", fontWeight: "800" },
  label: { fontFamily: "SpaceGrotesk_600SemiBold", fontSize: 12, color: "#fff", marginTop: 6 },
  input: { backgroundColor: "#0A0D18", borderWidth: 1, borderColor: "#1A1F2E", borderRadius: 10, padding: 14, color: "#fff", fontSize: 15, marginTop: 6 },
  passWrap: { flexDirection: "row", alignItems: "center", backgroundColor: "#0A0D18", borderWidth: 1, borderColor: "#1A1F2E", borderRadius: 10, marginTop: 6, paddingRight: 8 },
  eyeBtn: { paddingHorizontal: 12, paddingVertical: 8, borderRadius: 8, backgroundColor: "#0F1320", borderWidth: 1, borderColor: "#1A1F2E" },
  eyeTxt: { color: "#8B93B8", fontSize: 11, fontWeight: "700" },
  fieldHint: { fontFamily: "IBMPlexMono_400Regular", fontSize: 10, color: "#5A6378", marginTop: 4 },
  primary: { backgroundColor: "#fff", padding: 14, borderRadius: 12, alignItems: "center", marginTop: 12 },
  primaryTxt: { color: "#06080F", fontWeight: "900", fontSize: 13 },
  hint: { fontFamily: "IBMPlexMono_400Regular", fontSize: 10, color: "#5A6378", marginTop: 6, textAlign: "center" },
  linkBtn: { alignItems: "center", marginTop: 8 },
  linkTxt: { color: "#60A5FA", fontSize: 12, fontWeight: "600" },
  linkTxtSmall: { color: "#60A5FA", fontSize: 11, fontWeight: "700" },
  error: { backgroundColor: "#2A0F14", borderWidth: 1, borderColor: "#7F1D1D", color: "#FECACA", padding: 10, borderRadius: 10, fontSize: 12, textAlign: "center", marginTop: 4 },
  info: { backgroundColor: "#0F1F12", borderWidth: 1, borderColor: "#15803D", color: "#BBF7D0", padding: 10, borderRadius: 10, fontSize: 12, textAlign: "center", marginTop: 4 },
  orRow: { flexDirection: "row", alignItems: "center", gap: 12, marginVertical: 10 },
  orLine: { flex: 1, height: 1, backgroundColor: "#1A1F2E" },
  orTxt: { color: "#5A6378", fontSize: 11, fontWeight: "800", letterSpacing: 1 },
  guestBtn: { flexDirection: "row", alignItems: "center", gap: 12, backgroundColor: "#0A0D18", borderWidth: 1, borderColor: "#1A1F2E", borderRadius: 12, padding: 14 },
  guestIcon: { color: "#22C55E", fontSize: 18, fontWeight: "900" },
  guestTitle: { color: "#fff", fontWeight: "800", fontSize: 13 },
  guestSub: { color: "#8B93B8", fontSize: 11, marginTop: 2 },
  guestArrow: { color: "#5A6378", fontWeight: "900" },
  foot: { fontFamily: "IBMPlexMono_400Regular", fontSize: 10, color: "#5A6378", textAlign: "center", marginTop: 10 },
  footSmall: { fontFamily: "IBMPlexMono_400Regular", fontSize: 9, color: "#3A4158", textAlign: "center" },
});
