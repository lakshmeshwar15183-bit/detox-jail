import React, { useState } from "react";
import { View, Text, TextInput, TouchableOpacity, StyleSheet, Alert, ActivityIndicator } from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import * as Haptics from "expo-haptics";
import { sendEmailOtp, signInWithEmail, signInAsGuest } from "./auth";

export default function AuthScreen({ onAuthed }: { onAuthed: () => void }) {
  const [email, setEmail] = useState("");
  const [otp, setOtp] = useState("");
  const [step, setStep] = useState<"email" | "otp">("email");
  const [loading, setLoading] = useState(false);

  const sendOtp = async () => {
    if (!email.includes("@")) return Alert.alert("Enter valid email");
    setLoading(true);
    try {
      await sendEmailOtp(email);
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      setStep("otp");
      Alert.alert("OTP sent", `Code sent to ${email.trim().toLowerCase()} via Supabase. Check inbox (and spam). Demo fallback: 123456 works offline.`);
    } catch (e: any) {
      Alert.alert("Could not send OTP", e.message);
    } finally {
      setLoading(false);
    }
  };

  const verify = async () => {
    try {
      setLoading(true);
      await signInWithEmail(email, otp);
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      onAuthed();
    } catch (e: any) {
      Alert.alert("Auth failed", e.message);
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
        <Text style={styles.mono}>DETØX • AUTH • SUPABASE + GUEST 3D</Text>
        <Text style={styles.title}>Welcome to DETØX</Text>
        <Text style={styles.sub}>Your apps go to jail so you can go free. Email = permanent. Guest = 3 days free, then sign in.</Text>

        <View style={styles.divider} />

        {step === "email" ? (
          <>
            <Text style={styles.label}>Email (Supabase OTP)</Text>
            <TextInput
              value={email}
              onChangeText={setEmail}
              placeholder="you@example.com"
              placeholderTextColor="#5A6378"
              autoCapitalize="none"
              keyboardType="email-address"
              style={styles.input}
            />
            <TouchableOpacity onPress={sendOtp} disabled={loading} style={[styles.primary, loading && { opacity: 0.6 }]}>
              {loading ? <ActivityIndicator color="#06080F" /> : <Text style={styles.primaryTxt}>Send OTP →</Text>}
            </TouchableOpacity>
            <Text style={styles.hint}>We send 6-digit code via Supabase. Real email, $0 on free tier.</Text>
          </>
        ) : (
          <>
            <Text style={styles.label}>OTP for {email.trim().toLowerCase()}</Text>
            <TextInput
              value={otp}
              onChangeText={setOtp}
              placeholder="123456"
              placeholderTextColor="#5A6378"
              keyboardType="number-pad"
              maxLength={6}
              style={[styles.input, { letterSpacing: 8, fontSize: 20, textAlign: "center" }]}
            />
            <TouchableOpacity onPress={verify} disabled={loading} style={[styles.primary, loading && { opacity: 0.6 }]}>
              {loading ? <ActivityIndicator color="#06080F" /> : <Text style={styles.primaryTxt}>Verify & Enter →</Text>}
            </TouchableOpacity>
            <TouchableOpacity onPress={() => setStep("email")} style={styles.linkBtn}>
              <Text style={styles.linkTxt}>← Change email / Resend</Text>
            </TouchableOpacity>
            <Text style={styles.hint}>Demo offline: 123456 / 000000 always works.</Text>
          </>
        )}

        <View style={styles.orRow}>
          <View style={styles.orLine} />
          <Text style={styles.orTxt}>OR</Text>
          <View style={styles.orLine} />
        </View>

        <TouchableOpacity onPress={guest} disabled={loading} style={styles.guestBtn}>
          <Text style={styles.guestIcon}>⬢</Text>
          <View style={{ flex: 1 }}>
            <Text style={styles.guestTitle}>Continue as Guest — 3 days free</Text>
            <Text style={styles.guestSub}>No email. Full app. Expires in 3 days → then email required.</Text>
          </View>
          <Text style={styles.guestArrow}>→</Text>
        </TouchableOpacity>

        <Text style={styles.foot}>Supabase Auth • SecureStore • Offline guest • com.detox.jail</Text>
        <Text style={styles.footSmall}>Supabase free: 50k MAU, OTP via email, secure session.</Text>
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
  hint: { fontFamily: "IBMPlexMono_400Regular", fontSize: 10, color: "#5A6378", marginTop: 6, textAlign: "center" },
  linkBtn: { alignItems: "center", marginTop: 8 },
  linkTxt: { color: "#60A5FA", fontSize: 12, fontWeight: "600" },
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
