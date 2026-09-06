// DETØX Auth — Email + Guest 3-day (offline-first, SecureStore)
// No server bill. Guest = 3 days free. Email = permanent (mock OTP locally, Supabase-ready).
import * as SecureStore from "expo-secure-store";
import AsyncStorage from "@react-native-async-storage/async-storage";

export type User = {
  id: string;
  email: string; // "guest@detox.local" for guest
  isGuest: boolean;
  guestExpiresAt?: number; // ms
  createdAt: number;
};

const KEY_USER = "detox_user_v1";
const KEY_GUEST_START = "detox_guest_start";
const GUEST_DAYS = 3;

export async function getUser(): Promise<User | null> {
  const raw = await SecureStore.getItemAsync(KEY_USER);
  if (!raw) return null;
  try {
    const u: User = JSON.parse(raw);
    // check guest expiry
    if (u.isGuest && u.guestExpiresAt && Date.now() > u.guestExpiresAt) {
      await signOut();
      return null;
    }
    return u;
  } catch {
    return null;
  }
}

export async function signInWithEmail(email: string, otp: string): Promise<User> {
  // Mock OTP = 123456 OR any 6-digit if you want demo. In prod, verify via Supabase:
  // const { error } = await supabase.auth.verifyOtp({ email, token: otp, type: 'email' })
  const clean = email.trim().toLowerCase();
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(clean)) throw new Error("Invalid email");
  if (otp !== "123456" && otp !== "000000") {
    // allow any 6-digit for demo to avoid friction, but show as if verified
    if (!/^\d{6}$/.test(otp)) throw new Error("OTP must be 6 digits (try 123456)");
  }
  const user: User = {
    id: "u_" + clean.replace(/[^a-z0-9]/g, "_") + "_" + Date.now(),
    email: clean,
    isGuest: false,
    createdAt: Date.now(),
  };
  await SecureStore.setItemAsync(KEY_USER, JSON.stringify(user));
  await AsyncStorage.setItem("detox_onboarded", "1"); // keep onboarded flag
  return user;
}

export async function signInAsGuest(): Promise<User> {
  // check if guest already used and expired
  const start = await SecureStore.getItemAsync(KEY_GUEST_START);
  if (start) {
    const startMs = parseInt(start, 10);
    const expiry = startMs + GUEST_DAYS * 24 * 60 * 60 * 1000;
    if (Date.now() > expiry) throw new Error("Guest trial expired (3 days). Please sign in with email.");
    // if still valid, return existing guest
    const existing = await getUser();
    if (existing?.isGuest) return existing;
  }
  const now = Date.now();
  const expires = now + GUEST_DAYS * 24 * 60 * 60 * 1000;
  const user: User = {
    id: "guest_" + now,
    email: "guest@detox.local",
    isGuest: true,
    guestExpiresAt: expires,
    createdAt: now,
  };
  await SecureStore.setItemAsync(KEY_USER, JSON.stringify(user));
  await SecureStore.setItemAsync(KEY_GUEST_START, String(now));
  return user;
}

export async function signOut() {
  await SecureStore.deleteItemAsync(KEY_USER);
}

export function guestDaysLeft(user: User | null): number {
  if (!user?.isGuest || !user.guestExpiresAt) return 0;
  const leftMs = user.guestExpiresAt - Date.now();
  return Math.max(0, Math.ceil(leftMs / (24 * 60 * 60 * 1000)));
}

export function isGuestExpired(user: User | null): boolean {
  return !!user?.isGuest && !!user.guestExpiresAt && Date.now() > user.guestExpiresAt;
}
