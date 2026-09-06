// DETØX Auth — REAL: Email+Password (Supabase) + Guest 3-day (SecureStore)
// No dummy OTP. Supabase email/password with reset.
import * as SecureStore from "expo-secure-store";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { supabase } from "../supabase";

export type User = {
  id: string;
  email: string;
  isGuest: boolean;
  guestExpiresAt?: number;
  createdAt: number;
};

const KEY_USER = "detox_user_v1";
const KEY_GUEST_START = "detox_guest_start";
const GUEST_DAYS = 3;

export function guestDaysLeft(user: User | null): number {
  if (!user?.isGuest || !user.guestExpiresAt) return 0;
  return Math.max(0, Math.ceil((user.guestExpiresAt - Date.now()) / (24 * 60 * 60 * 1000)));
}

// Get current user: Supabase session first, then guest
export async function getUser(): Promise<User | null> {
  try {
    const { data } = await supabase.auth.getSession();
    if (data.session?.user?.email) {
      return {
        id: data.session.user.id,
        email: data.session.user.email!,
        isGuest: false,
        createdAt: new Date(data.session.user.created_at || Date.now()).getTime(),
      };
    }
  } catch {}
  const raw = await SecureStore.getItemAsync(KEY_USER);
  if (!raw) return null;
  try {
    const u: User = JSON.parse(raw);
    if (u.isGuest && u.guestExpiresAt && Date.now() > u.guestExpiresAt) {
      await signOut();
      return null;
    }
    return u;
  } catch {
    return null;
  }
}

// Real Sign Up
export async function signUp(email: string, password: string): Promise<User> {
  const clean = email.trim().toLowerCase();
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(clean)) throw new Error("Invalid email");
  if (password.length < 6) throw new Error("Password must be 6+ characters");
  const { data, error } = await supabase.auth.signUp({ email: clean, password });
  if (error) throw new Error(error.message);
  if (!data.user) throw new Error("Sign up failed");
  // Supabase may require email confirmation — check
  if (!data.session) {
    throw new Error("Check your email to confirm account, then login.");
  }
  const u: User = { id: data.user.id, email: data.user.email!, isGuest: false, createdAt: Date.now() };
  await SecureStore.setItemAsync(KEY_USER, JSON.stringify(u));
  await AsyncStorage.setItem("detox_onboarded", "1");
  return u;
}

// Real Sign In
export async function signIn(email: string, password: string): Promise<User> {
  const clean = email.trim().toLowerCase();
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+\.[^\s@]+$/.test(clean) && !clean.includes("@")) throw new Error("Invalid email");
  const { data, error } = await supabase.auth.signInWithPassword({ email: clean, password });
  if (error) throw new Error(error.message);
  if (!data.user) throw new Error("Login failed");
  const u: User = { id: data.user.id, email: data.user.email!, isGuest: false, createdAt: Date.now() };
  await SecureStore.setItemAsync(KEY_USER, JSON.stringify(u));
  await AsyncStorage.setItem("detox_onboarded", "1");
  return u;
}

// Reset password
export async function resetPassword(email: string): Promise<void> {
  const clean = email.trim().toLowerCase();
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(clean)) throw new Error("Invalid email");
  const { error } = await supabase.auth.resetPasswordForEmail(clean, {
    redirectTo: "detox://reset-password",
  });
  if (error) throw new Error(error.message);
}

// Guest 3-day
export async function signInAsGuest(): Promise<User> {
  const start = await SecureStore.getItemAsync(KEY_GUEST_START);
  if (start) {
    const expiry = parseInt(start, 10) + GUEST_DAYS * 24 * 60 * 60 * 1000;
    if (Date.now() > expiry) throw new Error("Guest trial expired (3 days). Please create account.");
    const existing = await getUser();
    if (existing?.isGuest) return existing;
  }
  const now = Date.now();
  const u: User = { id: "guest_" + now, email: "guest@detox.local", isGuest: true, guestExpiresAt: now + GUEST_DAYS * 24 * 60 * 60 * 1000, createdAt: now };
  await SecureStore.setItemAsync(KEY_USER, JSON.stringify(u));
  await SecureStore.setItemAsync(KEY_GUEST_START, String(now));
  return u;
}

export async function signOut() {
  try { await supabase.auth.signOut(); } catch {}
  await SecureStore.deleteItemAsync(KEY_USER);
}
