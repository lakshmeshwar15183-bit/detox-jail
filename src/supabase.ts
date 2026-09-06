import { createClient } from "@supabase/supabase-js";
import Constants from "expo-constants";
import * as SecureStore from "expo-secure-store";
import { Platform } from "react-native";

const extra = Constants.expoConfig?.extra ?? {};

// For DETØX we reuse your existing Supabase project (0 cost).
// Create a new project if you want isolation: set EXPO_PUBLIC_SUPABASE_URL/ANON_KEY in .env
export const supabaseUrl =
  (extra.supabaseUrl as string) ||
  process.env.EXPO_PUBLIC_SUPABASE_URL ||
  "https://toscljrivrawvlfebdzz.supabase.co";

export const supabaseAnonKey =
  (extra.supabaseAnonKey as string) ||
  process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY ||
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InRvc2NsanJpdnJhd3ZsZmViZHp6Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODI2MDc1MzUsImV4cCI6MjA5ODE4MzUzNX0.XnQrgOSKbXaUag58E05tjXh8cS05eIv38RXaMrZG_LU";

const ExpoSecureStoreAdapter = {
  getItem: (key: string) => {
    if (Platform.OS === "web") {
      try {
        return Promise.resolve(typeof localStorage !== "undefined" ? localStorage.getItem(key) : null);
      } catch {
        return Promise.resolve(null);
      }
    }
    return SecureStore.getItemAsync(key);
  },
  setItem: (key: string, value: string) => {
    if (Platform.OS === "web") {
      try {
        if (typeof localStorage !== "undefined") localStorage.setItem(key, value);
      } catch {}
      return Promise.resolve();
    }
    return SecureStore.setItemAsync(key, value);
  },
  removeItem: (key: string) => {
    if (Platform.OS === "web") {
      try {
        if (typeof localStorage !== "undefined") localStorage.removeItem(key);
      } catch {}
      return Promise.resolve();
    }
    return SecureStore.deleteItemAsync(key);
  },
};

export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  auth: {
    storage: ExpoSecureStoreAdapter,
    autoRefreshToken: true,
    persistSession: true,
    detectSessionInUrl: false,
  },
});
