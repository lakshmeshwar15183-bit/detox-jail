import React, { useState } from "react";
import { View, Text, TextInput, TouchableOpacity, StyleSheet, Alert, ActivityIndicator } from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import * as Haptics from "expo-haptics";
import { signUp, signIn, resetPassword, signInAsGuest } from "./auth";

export default function AuthScreen({ onAuthed }: { onAuthed: () => void }) {
  const [mode, setMode] = useState<"login" | "signup" | "forgot">("login");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [loading, setLoading] = useState(false);

  const handleAuth = async () => {
    if (!email.includes("@")) return Alert.alert("Enter valid email");
    if (mode !== "forgot" && password.length < 6) return Alert.alert("Password 6+ chars");
    if (mode === "signup" && password !== confirm) return Alert.alert("Passwords don't match");
    setLoading(true);
    try {
      if (mode === "signup") {
        await signUp(email, password);
        Alert.alert("Account created", "You can now login. Check email if confirmation required.");
        setMode("login");
      } else if (mode === "login") {
        await signIn(email, password);
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
        onAuthed();
      } else if (mode === "forgot") {
        await resetPassword(email);
        Alert.alert("Reset sent", "Check your email for reset link.");
        setMode("login");
      }
    } catch (e: any) {
      Alert.alert(mode === "signup" ? "Sign up failed" : mode === "login" ? "Login failed" : "Reset failed", e.message);
    } finally {
      setLoading(false);
    }
  };

  const guest = async () => {
    try {
      setLoading(true);
      await signInAsGuest();
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
      onAuthed();
    } catch (e: any) {
      Alert.alert("Guest expired", e.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <View style={styles.root}>
      <LinearGradient colors={["#06080F", "#0A0E1A"]} style={StyleSheet.absoluteFill} />
      <View style={styles.card}>
        <Text style={styles.mono}>DETØX • REAL AUTH • SUPABASE</Text>
        <Text style={styles.title}>{mode === "signup" ? "Create account" : mode === "forgot" ? "Reset password" : "Welcome back"}</Text>
        <Text style={styles.sub}>Email + password • Secure • Guest 3 days free → then account required.</Text>

        <View style={styles.divider} />

        <Text style={styles.label}>Email</Text>
        <TextInput value={email} onChangeText={setEmail} placeholder="you@example.com" placeholderTextColor="#5A6378" autoCapitalize="none" keyboardType="email-address" style={styles.input} />

        {mode !== "forgot" && (
          <>
            <Text style={styles.label}>Password</Text>
            <TextInput value={password} onChangeText={setPassword} placeholder="••••••••" placeholderTextColor="#5A6378" secureTextEntry style={styles.input} />
          </>
        )}
        {mode === "signup" && (
          <>
            <Text style={styles.label}>Confirm Password</Text>
            <TextInput value={confirm} onChangeText={setConfirm} placeholder="••••••••" placeholderTextColor="#5A6378" secureTextEntry style={styles.input} />
          </>
        )}

        <TouchableOpacity onPress={handleAuth} disabled={loading} style={[styles.primary, loading && { opacity: 0.6 }]}>
          {loading ? <ActivityIndicator color="#06080F" /> : <Text style={styles.primaryTxt}>{mode === "signup" ? "Create Account →" : mode === "forgot" ? "Send Reset Link →" : "Login →"}</Text>}
        </TouchableOpacity>

        <View style={styles.row}>
          {mode !== "login" && (
            <TouchableOpacity onPress={() => setMode("login")}>
              <Text style={styles.link}>Login</Text>
            </TouchableOpacity>
          )}
          {mode !== "signup" && (
            <TouchableOpacity onPress={() => setMode("signup")}>
              <Text style={styles.link}>Create account</Text>
            </TouchableOpacity>
          )}
          {mode !== "forgot" && (
            <TouchableOpacity onPress={() => setMode("forgot")}>
              <Text style={styles.link}>Forgot password?</Text>
            </TouchableOpacity>
          )}
        </View>

        <View style={styles.orRow}>
          <View style={styles.orLine} />
          <Text style={styles.orTxt}>OR</Text>
          <View style={styles.orLine} />
        </View>

        <TouchableOpacity onPress={guest} disabled={loading} style={styles.guestBtn}>
          <Text style={styles.guestIcon}>⬢</Text>
          <View style={{ flex: 1 }}>
            <Text style={styles.guestTitle}>Continue as Guest — 3 days free</Text>
            <Text style={styles.guestSub}>No email. Expires in 3 days → create account to keep streak.</Text>
          </View>
          <Text style={styles.guestArrow}>→</Text>
        </TouchableOpacity>

        <Text style={styles.foot}>Supabase Auth • SecureStore • com.detox.jail • 0 dummy</Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: "#06080F", justifyContent: "center", padding: 20 },
  card: { backgroundColor: "#0F1320", borderWidth: 1, borderColor: "#1A1F2E", borderRadius: 16, padding: 18, gap: 10 },
  mono: { fontFamily: "IBMPlexMono_500Medium", fontSize: 10, color: "#8B93B8", letterSpacing: 1.2, textAlign: "center" },
  title: { fontFamily: "SpaceGrotesk_700Bold", fontSize: 22, color: "#fff", textAlign: "center", marginTop: 4 },
  sub: { fontFamily: "IBMPlexMono_400Regular", fontSize: 12, color: "#AAB2D6", textAlign: "center", lineHeight: 18 },
  divider: { height: 1, backgroundColor: "#1A1F2E", marginVertical: 6 },
  label: { fontFamily: "SpaceGrotesk_600SemiBold", fontSize: 12, color: "#fff", marginTop: 6 },
  input: { backgroundColor: "#0A0D18", borderWidth: 1, borderColor: "#1A1F2E", borderRadius: 10, padding: 14, color: "#fff", fontSize: 15, marginTop: 6 },
  primary: { backgroundColor: "#fff", padding: 14, borderRadius: 12, alignItems: "center", marginTop: 12 },
  primaryTxt: { color: "#06080F", fontWeight: "900", fontSize: 13 },
  row: { flexDirection: "row", justifyContent: "space-between", marginTop: 8 },
  link: { color: "#60A5FA", fontSize: 12, fontWeight: "600" },
  orRow: { flexDirection: "row", alignItems: "center", gap: 12, marginVertical: 10 },
  orLine: { flex: 1, height: 1, backgroundColor: "#1A1F2E" },
  orTxt: { color: "#5A6378", fontSize: 11, fontWeight: "800", letterSpacing: 1 },
  guestBtn: { flexDirection: "row", alignItems: "center", gap: 12, backgroundColor: "#0A0D18", borderWidth: 1, borderColor: "#1A1F2E", borderRadius: 12, padding: 14 },
  guestIcon: { color: "#22C55E", fontSize: 18, fontWeight: "900" },
  guestTitle: { color: "#fff", fontWeight: "800", fontSize: 13 },
  guestSub: { color: "#8B93B8", fontSize: 11, marginTop: 2 },
  guestArrow: { color: "#5A6378", fontWeight: "900" },
  foot: { fontFamily: "IBMPlexMono_400Regular", fontSize: 10, color: "#5A6378", textAlign: "center", marginTop: 10 },
});
