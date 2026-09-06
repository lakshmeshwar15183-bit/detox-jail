// DON'T Auth — Real email+password via Supabase + Guest 3-day (SecureStore)
// No OTP, no mock. Disposable / temp-mail blocked. Forgot password supported.
import * as SecureStore from "expo-secure-store";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { supabase } from "../supabase";

export type User = {
  id: string;
  email: string; // "guest@dont.local" for guest
  isGuest: boolean;
  guestExpiresAt?: number;
  createdAt: number;
};

const KEY_USER = "dont_user_v1";
const KEY_GUEST_START = "dont_guest_start";
const GUEST_DAYS = 3;

// ── Disposable / temp-mail blocklist ──
const DISPOSABLE_DOMAINS = new Set<string>([
  "tempmail.com",
  "temp-mail.org",
  "temp-mail.io",
  "tempmailo.com",
  "tempmailaddress.com",
  "tempmail.net",
  "tempail.com",
  "tempmail.plus",
  "trashmail.com",
  "trashmail.me",
  "trashmail.net",
  "trashmail.org",
  "disposable.com",
  "dispostable.com",
  "throwawaymail.com",
  "throwawayemail.com",
  "mailinator.com",
  "mailinator.net",
  "mailinator.org",
  "yopmail.com",
  "yopmail.fr",
  "yopmail.net",
  "yoopmail.com",
  "guerrillamail.com",
  "guerrillamail.org",
  "guerrillamail.net",
  "guerrillamailblock.com",
  "10minutemail.com",
  "10minutemail.net",
  "10minutemail.org",
  "10minmail.com",
  "getnada.com",
  "getairmail.com",
  "getnada.net",
  "jetable.org",
  "jetable.com",
  "fakemail.net",
  "fakeinbox.com",
  "fakeinbox.org",
  "maildrop.cc",
  "maildrop.cf",
  "mailnesia.com",
  "mintemail.com",
  "mytemp.email",
  "moakt.com",
  "shmvel.com",
  "harakirimail.com",
  "disposableemailaddresses.com",
  "tempemail.com",
  "tempemail.net",
  "tempe-mail.com",
  "0815.ru",
  "0-mail.com",
  "mail-temporaire.fr",
  "tempmailer.com",
  "tmpmail.org",
  "tmpmail.net",
  "tmpeml.com",
  "emltmp.com",
  "disposablemail.com",
  "anonbox.net",
  "anonymbox.com",
  "burnermail.io",
  "getburnermail.com",
  "mailcatch.com",
  "mailsac.com",
  "mailforspam.com",
  "spamgourmet.com",
  "spambox.us",
  "tempinbox.com",
  "tmail.com",
  "e4ward.com",
  "gishpuppy.com",
  "wegwerfemail.de",
  "wegwerfmail.de",
  "wegwerfemail.net",
  "wegwerfadresse.de",
  "sharklasers.com",
  "grr.la",
  "guerrillamail.de",
  "pokemail.net",
  "bugmenot.com",
  "binkmail.com",
  "bobmail.info",
  "chacuo.net",
  "disposable.io",
  "drdrb.com",
  "filzmail.com",
  "fux0ringduh.com",
  "getonemail.com",
  "hatespam.org",
  "hidemail.de",
  "jourrapide.com",
  "kasmail.com",
  "kulturbetrieb.info",
  "mailzilla.com",
  "mailzilla.org",
  "mailme.lv",
  "mailmetrash.com",
  "mohmal.com",
  "mytrashmail.com",
  "nabuma.com",
  "nwldx.com",
  "objectmail.com",
  "proxymail.eu",
  "rcpt.at",
  "safe-mail.net",
  "safetymail.info",
  "selfdestructingmail.com",
  "sendspamhere.com",
  "spam4.me",
  "spamcowboy.com",
  "spamfree24.org",
  "superrito.com",
  "teewars.org",
  "twinmail.de",
  "owlpic.com",
]);

const DISPOSABLE_SUBSTRINGS = [
  "tempmail",
  "temp-mail",
  "tempemail",
  "throwaway",
  "disposable",
  "trashmail",
  "10min",
  "guerrilla",
  "yopmail",
  "mailinator",
  "getnada",
  "burnermail",
  "harakiri",
  "maildrop",
  "mintemail",
  "tmpmail",
  "sharklaser",
  "spam",
  "wegwerf",
];

function normalizeEmail(email: string): string {
  return email.trim().toLowerCase();
}
function extractDomain(email: string): string {
  const at = email.lastIndexOf("@");
  return at >= 0 ? email.slice(at + 1).toLowerCase() : "";
}
export function isDisposableEmail(email: string): boolean {
  const domain = extractDomain(normalizeEmail(email));
  if (!domain) return false;
  if (DISPOSABLE_DOMAINS.has(domain)) return true;
  for (const sub of DISPOSABLE_SUBSTRINGS) if (domain.includes(sub)) return true;
  return false;
}
export function validateEmail(email: string): string | null {
  const clean = normalizeEmail(email);
  if (!clean) return "Email is required";
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(clean)) return "Enter a valid email";
  if (clean.length > 254) return "Email too long";
  if (isDisposableEmail(clean)) return "Disposable / temporary emails are not allowed — use your real email";
  return null;
}
export function validatePassword(password: string): string | null {
  if (!password) return "Password is required";
  if (password.length < 8) return "Password must be at least 8 characters";
  if (password.length > 128) return "Password too long (max 128)";
  if (!/[A-Za-z]/.test(password) || !/[0-9]/.test(password)) return "Password must contain at least one letter and one number";
  return null;
}

// ── Guest helpers ──
export function guestDaysLeft(user: User | null): number {
  if (!user?.isGuest || !user.guestExpiresAt) return 0;
  const leftMs = user.guestExpiresAt - Date.now();
  return Math.max(0, Math.ceil(leftMs / (24 * 60 * 60 * 1000)));
}
export function isGuestExpired(user: User | null): boolean {
  return !!user?.isGuest && !!user.guestExpiresAt && Date.now() > user.guestExpiresAt;
}

// ── Get current user (Supabase session first, then SecureStore guest) ──
export async function getUser(): Promise<User | null> {
  try {
    const { data } = await supabase.auth.getSession();
    if (data.session?.user?.email) {
      const u: User = {
        id: data.session.user.id,
        email: data.session.user.email!,
        isGuest: false,
        createdAt: new Date(data.session.user.created_at || Date.now()).getTime(),
      };
      return u;
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

// ── Real auth: Email + Password ──
export async function signUp(email: string, password: string): Promise<{ user: User | null; needsConfirmation: boolean }> {
  const clean = normalizeEmail(email);
  const emailErr = validateEmail(clean);
  if (emailErr) throw new Error(emailErr);
  const passErr = validatePassword(password);
  if (passErr) throw new Error(passErr);
  const { data, error } = await supabase.auth.signUp({ email: clean, password });
  if (error) throw new Error(error.message);
  if (!data.session && data.user) return { user: null, needsConfirmation: true };
  if (data.session?.user?.email) {
    const u: User = { id: data.session.user.id, email: data.session.user.email!, isGuest: false, createdAt: Date.now() };
    await SecureStore.setItemAsync(KEY_USER, JSON.stringify(u));
    await AsyncStorage.setItem("dont_onboarded", "1");
    return { user: u, needsConfirmation: false };
  }
  return { user: null, needsConfirmation: true };
}

export async function signIn(email: string, password: string): Promise<User> {
  const clean = normalizeEmail(email);
  const emailErr = validateEmail(clean);
  if (emailErr) throw new Error(emailErr);
  if (!password) throw new Error("Password is required");
  const { data, error } = await supabase.auth.signInWithPassword({ email: clean, password });
  if (error) {
    if (error.message.toLowerCase().includes("invalid login")) throw new Error("Invalid email or password");
    if (error.message.toLowerCase().includes("email not confirmed")) throw new Error("Email not confirmed — check your inbox for the verification link");
    throw new Error(error.message);
  }
  if (!data.user?.email || !data.session) throw new Error("Sign in failed — try again");
  const u: User = { id: data.user.id, email: data.user.email!, isGuest: false, createdAt: Date.now() };
  await SecureStore.setItemAsync(KEY_USER, JSON.stringify(u));
  await AsyncStorage.setItem("dont_onboarded", "1");
  return u;
}

export async function sendPasswordReset(email: string): Promise<void> {
  const clean = normalizeEmail(email);
  const emailErr = validateEmail(clean);
  if (emailErr) throw new Error(emailErr);
  const { error } = await supabase.auth.resetPasswordForEmail(clean, { redirectTo: "dont://reset-password" });
  if (error) throw new Error(error.message);
}
// alias for old name
export const resetPassword = sendPasswordReset;

// ── Guest ──
export async function signInAsGuest(): Promise<User> {
  const start = await SecureStore.getItemAsync(KEY_GUEST_START);
  if (start) {
    const startMs = parseInt(start, 10);
    const expiry = startMs + GUEST_DAYS * 24 * 60 * 60 * 1000;
    if (Date.now() > expiry) throw new Error("Guest trial expired (3 days). Please create an account with your real email.");
    const existing = await getUser();
    if (existing?.isGuest) return existing;
  }
  const now = Date.now();
  const expires = now + GUEST_DAYS * 24 * 60 * 60 * 1000;
  const user: User = { id: "guest_" + now, email: "guest@dont.local", isGuest: true, guestExpiresAt: expires, createdAt: now };
  await SecureStore.setItemAsync(KEY_USER, JSON.stringify(user));
  await SecureStore.setItemAsync(KEY_GUEST_START, String(now));
  return user;
}

export async function signOut() {
  try { await supabase.auth.signOut(); } catch {}
  await SecureStore.deleteItemAsync(KEY_USER);
}
