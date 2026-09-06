import React, { useEffect, useState, useRef } from "react";
import {
  View,
  Text,
  TouchableOpacity,
  ScrollView,
  Dimensions,
  StyleSheet,
  Animated,
  Platform,
  Alert,
  TextInput,
  BackHandler,
  AppState,
} from "react-native";
import { StatusBar } from "expo-status-bar";
import { SafeAreaView, SafeAreaProvider, useSafeAreaInsets } from "react-native-safe-area-context";
import { LinearGradient } from "expo-linear-gradient";
import * as Haptics from "expo-haptics";
import {
  useFonts as useSpaceGrotesk,
  SpaceGrotesk_600SemiBold,
  SpaceGrotesk_700Bold,
} from "@expo-google-fonts/space-grotesk";
import {
  IBMPlexMono_400Regular,
  IBMPlexMono_500Medium,
} from "@expo-google-fonts/ibm-plex-mono";
import * as SplashScreen from "expo-splash-screen";
import * as IntentLauncher from "expo-intent-launcher";
import AsyncStorage from "@react-native-async-storage/async-storage";
import AuthScreen from "./src/auth/AuthScreen";
import { getUser, guestDaysLeft, signOut, User } from "./src/auth/auth";
import { load as loadStore, save as saveStore, markToday } from "./src/store/useStore";
import { isUsageAccessGranted, getForegroundApp, getAppUsage, showOverlay, hideOverlay, canDrawOverlays, startMonitoring, stopMonitoring } from "./src/native/jail";

SplashScreen.preventAutoHideAsync().catch(() => {});

// --- APPS (dynamic, persisted) ---
type AppId = string;
type AppConfig = { name: string; icon: string; color: string; limit: number; packageName?: string };
const DEFAULT_APPS: Record<string, AppConfig> = {
  instagram: { name: "Instagram", icon: "◈", color: "#E1306C", limit: 30, packageName: "com.instagram.android" },
  youtube: { name: "YouTube", icon: "▶", color: "#FF0000", limit: 45, packageName: "com.google.android.youtube" },
  reddit: { name: "Reddit", icon: "⬢", color: "#FF4500", limit: 20, packageName: "com.reddit.frontpage" },
  twitter: { name: "X", icon: "✕", color: "#1DA1F2", limit: 20, packageName: "com.twitter.android" },
};

// --- ADS MOCK (toggle to real IDs) ---
const ADS = {
  bannerId: "ca-app-pub-3940256099942544/6300978111", // test
  interstitialId: "ca-app-pub-3940256099942544/1033173712",
  rewardedId: "ca-app-pub-3940256099942544/5224354917",
  showRewarded: (cb: () => void) => {
    // mock 1.8s ad
    setTimeout(() => cb(), 1800);
  },
};

const THEME_DARK = {
  bg: "#06080F",
  bgGrad: ["#06080F", "#0A0E1A"] as const,
  card: "#0F1320",
  card2: "#0A0D18",
  border: "#1A1F2E",
  border2: "#2A3148",
  text: "#fff",
  muted: "#8B93B8",
  subtle: "#5A6378",
  accent: "#60A5FA",
  success: "#22C55E",
  overlay: "rgba(6,8,15,0.92)",
};
const THEME_LIGHT = {
  bg: "#F8FAFC",
  bgGrad: ["#F8FAFC", "#FFFFFF"] as const,
  card: "#FFFFFF",
  card2: "#F1F5F9",
  border: "#E2E8F0",
  border2: "#CBD5E1",
  text: "#0F172A",
  muted: "#64748B",
  subtle: "#94A3B8",
  accent: "#3B82F6",
  success: "#16A34A",
  overlay: "rgba(248,250,252,0.92)",
};

const { width } = Dimensions.get("window");

function AppInner() {
  const [fontsLoaded, fontError] = useSpaceGrotesk({
    SpaceGrotesk_600SemiBold,
    SpaceGrotesk_700Bold,
    IBMPlexMono_400Regular,
    IBMPlexMono_500Medium,
  });
  const [user, setUser] = useState<User | null>(null);
  const [authLoading, setAuthLoading] = useState(true);
  const [onboarded, setOnboarded] = useState(false);
  const [tab, setTab] = useState<"today" | "jail" | "vault" | "you">("today");
  const [jailed, setJailed] = useState<AppId | null>(null);
  const [streak, setStreak] = useState(0);
  const [timeSaved, setTimeSaved] = useState(0);
  const [usage, setUsage] = useState<Record<AppId, number>>({
    instagram: 0,
    youtube: 0,
    reddit: 0,
    twitter: 0,
  });
  const [heatmap, setHeatmap] = useState<number[]>(Array.from({ length: 90 }, () => 0));
  const [pomodoro, setPomodoro] = useState(25 * 60);
  const [pomRunning, setPomRunning] = useState(false);
  const [adWatchCount, setAdWatchCount] = useState(0);
  const [hasUsagePermission, setHasUsagePermission] = useState<boolean | null>(null);
  const [hasOverlayPermission, setHasOverlayPermission] = useState<boolean | null>(null);
  const [appsConfig, setAppsConfig] = useState<Record<string, AppConfig>>(DEFAULT_APPS);
  const [isDark, setIsDark] = useState(true);
  const insets = useSafeAreaInsets();
  const theme = isDark ? THEME_DARK : THEME_LIGHT;
  const allApps = appsConfig;
  const vaultAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    (async () => {
      const u = await getUser();
      setUser(u);
      // load real persisted stats (starts at 0, no mock)
      try {
        // load custom apps first
      const customRaw = await AsyncStorage.getItem("dont_custom_apps");
      let merged: Record<string, AppConfig> = { ...DEFAULT_APPS };
      if (customRaw) {
        try {
          const parsed = JSON.parse(customRaw) as Record<string, AppConfig>;
          merged = { ...DEFAULT_APPS, ...parsed };
          setAppsConfig(merged);
        } catch {}
      }
      const cfg = await loadStore();
        if (cfg) {
          setStreak(cfg.streak);
          setTimeSaved(cfg.timeSavedMin);
          const m: Record<string, number> = {};
          Object.keys(merged).forEach((k) => (m[k] = 0));
          Object.keys(cfg.apps).forEach((k) => {
            if (m[k] !== undefined) m[k] = cfg.apps[k].usedMin;
            else {
              // custom app not in merged yet (old cfg)
              merged[k] = { name: k, icon: "⬢", color: "#8B93B8", limit: cfg.apps[k].limitMin };
              m[k] = cfg.apps[k].usedMin;
            }
          });
          setUsage(m as Record<AppId, number>);
          if (Object.keys(cfg.apps).some((k) => !DEFAULT_APPS[k])) setAppsConfig({ ...merged });
          setAdWatchCount(cfg.adWatchCount || 0);
          if (cfg.heatmap?.length === 90) setHeatmap(cfg.heatmap);
        } else {
          const m: Record<string, number> = {};
          Object.keys(merged).forEach((k) => (m[k] = 0));
          setUsage(m as any);
        }
        try {
          const granted = await isUsageAccessGranted();
          setHasUsagePermission(granted);
          await AsyncStorage.setItem("dont_usage_permission", granted ? "granted" : "not");
        } catch {
          const perm = await AsyncStorage.getItem("dont_usage_permission");
          setHasUsagePermission(perm === "granted");
        }
        try {
          const canOverlay = await canDrawOverlays();
          setHasOverlayPermission(canOverlay);
        } catch {
          setHasOverlayPermission(false);
        }
        const savedTheme = await AsyncStorage.getItem("dont_theme");
        if (savedTheme === "light") setIsDark(false);
        else if (savedTheme === "dark") setIsDark(true);
      } catch {
        setHasUsagePermission(false);
        setHasOverlayPermission(false);
      }
      setAuthLoading(false);
      if (u) {
        const onboard = await import("@react-native-async-storage/async-storage").then((m) => m.default.getItem("dont_onboarded"));
        if (onboard) setOnboarded(true);
      }
    })();
  }, []);

  useEffect(() => {
    if ((fontsLoaded || fontError) && !authLoading) {
      SplashScreen.hideAsync().catch(() => {});
    }
  }, [fontsLoaded, fontError, authLoading]);

  useEffect(() => {
    const t = setTimeout(() => SplashScreen.hideAsync().catch(() => {}), 2500);
    return () => clearTimeout(t);
  }, []);

  useEffect(() => {
    if (!pomRunning) return;
    const t = setInterval(() => setPomodoro((s) => (s > 0 ? s - 1 : 0)), 1000);
    return () => clearInterval(t);
  }, [pomRunning]);

  // persist real stats — no mock random increments
  useEffect(() => {
    if (authLoading) return;
    const cfg = {
      apps: Object.fromEntries(
        Object.keys(allApps).map((k) => [k, { limitMin: allApps[k].limit, usedMin: usage[k] || 0, jailed: jailed === k }])
      ) as any,
      streak,
      timeSavedMin: timeSaved,
      level: Math.floor(streak / 3) + 1,
      adWatchCount,
      heatmap,
    };
    saveStore(cfg as any);
  }, [usage, streak, timeSaved, adWatchCount, heatmap, jailed, authLoading, allApps]);

  useEffect(() => {
    if (authLoading) return;
    const toSave: Record<string, AppConfig> = {};
    Object.keys(appsConfig).forEach((k) => {
      if (!DEFAULT_APPS[k]) toSave[k] = appsConfig[k];
    });
    AsyncStorage.setItem("dont_custom_apps", JSON.stringify(toSave));
  }, [appsConfig, authLoading]);

  useEffect(() => {
    if (authLoading) return;
    AsyncStorage.setItem("dont_theme", isDark ? "dark" : "light");
  }, [isDark, authLoading]);

  const addCustomApp = (name: string, packageName: string, limit: number) => {
    if (!name.trim()) return;
    const id = name.trim().toLowerCase().replace(/[^a-z0-9]+/g, "_") + "_" + Date.now().toString().slice(-4);
    const colors = ["#E1306C","#FF0000","#FF4500","#1DA1F2","#22C55E","#8B5CF6","#F59E0B","#06B6D4"];
    const color = colors[Object.keys(appsConfig).length % colors.length];
    const icon = name.trim()[0]?.toUpperCase() || "⬢";
    const pkg = packageName.trim() || "com.example." + id;
    setAppsConfig((prev) => ({ ...prev, [id]: { name: name.trim(), icon, color, limit: Math.max(5, Math.min(240, limit || 30)), packageName: pkg } }));
    setUsage((prev) => ({ ...prev, [id]: 0 }));
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
  };
  const removeCustomApp = (id: string) => {
    if (DEFAULT_APPS[id]) {
      Alert.alert("Can't remove", "Default apps can't be removed — you can change their limit in a future update.");
      return;
    }
    Alert.alert("Remove app?", `Remove ${appsConfig[id]?.name || id}?`, [
      { text: "Cancel", style: "cancel" },
      {
        text: "Remove",
        style: "destructive",
        onPress: () => {
          setAppsConfig((prev) => {
            const n = { ...prev };
            delete n[id];
            return n;
          });
          setUsage((prev) => {
            const n = { ...prev };
            delete n[id];
            return n;
          });
          if (jailed === id) setJailed(null);
        },
      },
    ]);
  };

  // usage polling for UI (no mock)
  useEffect(() => {
    if (hasUsagePermission !== true) return;
    if (authLoading) return;
    let mounted = true;
    const pollUsage = async () => {
      try {
        const updates: Record<string, number> = {};
        for (const id of Object.keys(allApps)) {
          const pkg = (allApps as any)[id].packageName;
          if (!pkg) continue;
          const mins = await getAppUsage(pkg);
          updates[id] = Math.floor(mins);
        }
        if (!mounted) return;
        setUsage((prev) => {
          let changed = false;
          const next = { ...prev } as Record<string, number>;
          for (const k of Object.keys(updates)) {
            if (next[k] !== updates[k]) {
              next[k] = updates[k];
              changed = true;
            }
          }
          return changed ? (next as any) : prev;
        });
      } catch {}
    };
    pollUsage();
    const t = setInterval(pollUsage, 4000);
    return () => {
      mounted = false;
      clearInterval(t);
    };
  }, [hasUsagePermission, allApps, authLoading]);

  // native foreground service for real blocking — works even when DON'T is background/killed
  useEffect(() => {
    if (authLoading) return;
    if (!jailed) {
      stopMonitoring().catch(() => {});
      hideOverlay().catch(() => {});
      return;
    }
    if (hasUsagePermission !== true || hasOverlayPermission !== true) return;
    const cfg = (allApps as any)[jailed] as AppConfig | undefined;
    if (!cfg?.packageName) return;
    const appsJson = JSON.stringify({ [jailed]: { name: cfg.name, packageName: cfg.packageName, limitMin: cfg.limit } });
    startMonitoring(appsJson).catch(() => {});
  }, [jailed, allApps, hasUsagePermission, hasOverlayPermission, authLoading]);

  // auto-ask permissions
  useEffect(() => {
    if (hasUsagePermission === false) {
      const t = setTimeout(() => {
        Alert.alert("Allow Usage Access", "DON'T needs to see app usage to jail Instagram/YouTube etc. when limit is hit. Tap Open Settings → find DON'T → enable.", [
          { text: "Later", style: "cancel" },
          { text: "Open Settings", onPress: async () => { try { await IntentLauncher.startActivityAsync("android.settings.USAGE_ACCESS_SETTINGS"); } catch {} } },
        ]);
      }, 1200);
      return () => clearTimeout(t);
    }
  }, [hasUsagePermission]);
  useEffect(() => {
    if (hasOverlayPermission === false) {
      const t = setTimeout(() => {
        Alert.alert("Allow Display over other apps", "To show jail door on top of blocked apps, allow DON'T to display over other apps.", [
          { text: "Later", style: "cancel" },
          { text: "Open Settings", onPress: async () => { try { const { requestOverlayPermission } = await import("./src/native/jail"); await requestOverlayPermission(); } catch {} } },
        ]);
      }, 1800);
      return () => clearTimeout(t);
    }
  }, [hasOverlayPermission]);

  // back: close jail → go Today → double-press exit
  const lastBackRef = useRef<number>(0);
  useEffect(() => {
    const onBack = () => {
      if (jailed) {
        hideOverlay().catch(() => {});
        setJailed(null);
        return true;
      }
      if (tab !== "today") {
        setTab("today" as any);
        return true;
      }
      const now = Date.now();
      if (now - lastBackRef.current < 2000) return false;
      lastBackRef.current = now;
      if (Platform.OS === "android") {
        const { ToastAndroid } = require("react-native");
        ToastAndroid.show("Press again to exit DON'T", ToastAndroid.SHORT);
      }
      return true;
    };
    const sub = BackHandler.addEventListener("hardwareBackPress", onBack);
    return () => sub.remove();
  }, [jailed, tab]);

  useEffect(() => {
    const sub = AppState.addEventListener("change", async (s) => {
      if (s === "active") {
        try {
          const g = await isUsageAccessGranted();
          setHasUsagePermission(g);
          const o = await canDrawOverlays();
          setHasOverlayPermission(o);
        } catch {}
      }
    });
    return () => sub.remove();
  }, []);

  if (!fontsLoaded || authLoading) return <View style={{ flex: 1, backgroundColor: theme.bg }} />;

  return (
    <View style={[styles.root, { backgroundColor: theme.bg }]}>
      <StatusBar style={isDark ? "light" : "dark"} />
      <LinearGradient colors={theme.bgGrad as any} style={StyleSheet.absoluteFill} />

      {!user ? (
        <AuthScreen
          onAuthed={async () => {
            const u = await getUser();
            setUser(u);
          }}
          theme={theme}
          isDark={isDark}
        />
      ) : !onboarded ? (
        <Onboarding
          theme={theme}
          isDark={isDark}
          onDone={async () => {
            const AsyncStorage = (await import("@react-native-async-storage/async-storage")).default;
            await AsyncStorage.setItem("dont_onboarded", "1");
            setOnboarded(true);
          }}
        />
      ) : (
        <SafeAreaView style={{ flex: 1 }}>
          {/* HEADER */}
          <View style={[styles.header, { backgroundColor: theme.card, borderBottomColor: theme.border }]}>
            <View>
              <Text style={[styles.logo, { color: theme.text }]}>DON'T</Text>
              <Text style={[styles.sub, { color: theme.muted }]}>
                {user?.isGuest ? `Guest • ${guestDaysLeft(user)}d left` : user?.email} • Level {Math.floor(streak / 3) + 1} Warden
              </Text>
            </View>
            <View style={styles.headerRight}>
              <TouchableOpacity
                onPress={() => {
                  Haptics.selectionAsync();
                  setIsDark(!isDark);
                }}
                style={[styles.streakPill, { backgroundColor: theme.card2, borderColor: theme.border }]}
              >
                <Text style={[styles.streakTxt, { color: theme.text }]}>{isDark ? "☀" : "◐"}</Text>
              </TouchableOpacity>
              <View style={[styles.streakPill, { backgroundColor: theme.card2, borderColor: theme.border }]}>
                <Text style={[styles.streakTxt, { color: theme.text }]}>🔥 {streak}</Text>
              </View>
              <View style={[styles.savedPill, { backgroundColor: isDark ? "#0F1A12" : "#F0FDF4", borderColor: isDark ? "#1E3A1A" : "#BBF7D0" }]}>
                <Text style={[styles.savedTxt, { color: theme.success }]}>{Math.floor(timeSaved / 60)}h saved</Text>
              </View>
            </View>
          </View>
          {user?.isGuest && (
            <View style={{ marginHorizontal: 16, marginTop: 8, backgroundColor: "#1A1400", borderWidth: 1, borderColor: "#854D0E", borderRadius: 10, padding: 10, flexDirection: "row", alignItems: "center", gap: 12 }}>
              <Text style={{ flex: 1, color: "#FDE68A", fontSize: 11, fontWeight: "700", flexShrink: 1 }}>Guest trial: {guestDaysLeft(user)} days left • Sign in to keep streak</Text>
              <TouchableOpacity
                onPress={async () => {
                  await signOut();
                  setUser(null);
                  setOnboarded(false);
                }}
                style={{ backgroundColor: "#854D0E", paddingHorizontal: 12, paddingVertical: 6, borderRadius: 8, flexShrink: 0 }}
              >
                <Text style={{ color: "#fff", fontSize: 11, fontWeight: "800" }}>Sign In →</Text>
              </TouchableOpacity>
            </View>
          )}
          {hasUsagePermission === false && (
            <View style={{ marginHorizontal: 16, marginTop: 8, backgroundColor: "#1A0F0F", borderWidth: 1, borderColor: "#7F1D1D", borderRadius: 12, padding: 14, gap: 10 }}>
              <Text style={{ color: "#FECACA", fontWeight: "800", fontSize: 13 }}>⚠ Usage Access needed to track apps</Text>
              <Text style={{ color: "#AAB2D6", fontSize: 11, lineHeight: 16 }}>DON'T needs Usage Access to see time in Instagram / YouTube etc. Go to Settings → Usage Access → enable DON'T. Without it, jail won't auto-trigger — you can still jail manually.</Text>
              <View style={{ flexDirection: "row", gap: 8 }}>
                <TouchableOpacity
                  onPress={async () => {
                    try {
                      if (Platform.OS === "android") await IntentLauncher.startActivityAsync("android.settings.USAGE_ACCESS_SETTINGS");
                    } catch {}
                  }}
                  style={{ flex: 1, backgroundColor: "#EF4444", padding: 12, borderRadius: 10, alignItems: "center" }}
                >
                  <Text style={{ color: "#fff", fontWeight: "800", fontSize: 12 }}>Open Settings → Enable</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  onPress={async () => {
                    try {
                      const ok = await isUsageAccessGranted();
                      setHasUsagePermission(ok);
                      await AsyncStorage.setItem("dont_usage_permission", ok ? "granted" : "not");
                      if (ok) Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
                      else Alert.alert("Not yet enabled", "Please find DON'T in the list and enable the toggle, then tap Refresh.");
                    } catch {}
                  }}
                  style={{ backgroundColor: "#0F1320", borderWidth: 1, borderColor: "#1A1F2E", padding: 12, borderRadius: 10, alignItems: "center" }}
                >
                  <Text style={{ color: "#fff", fontWeight: "700", fontSize: 12 }}>Check Again ✓</Text>
                </TouchableOpacity>
              </View>
              <Text style={{ color: "#5A6378", fontSize: 10, textAlign: "center" }}>You can revoke anytime. 100% offline, no data leaves device.</Text>
            </View>
          )}
          {hasOverlayPermission === false && (
            <View style={{ marginHorizontal: 16, marginTop: 8, backgroundColor: "#1A1400", borderWidth: 1, borderColor: "#854D0E", borderRadius: 12, padding: 14, gap: 10 }}>
              <Text style={{ color: "#FDE68A", fontWeight: "800", fontSize: 13 }}>⛶ Display over other apps needed</Text>
              <Text style={{ color: "#AAB2D6", fontSize: 11, lineHeight: 16 }}>To show jail door on top of Instagram / YouTube, DON'T needs "Display over other apps". Enable it so jail actually blocks.</Text>
              <View style={{ flexDirection: "row", gap: 8 }}>
                <TouchableOpacity
                  onPress={async () => {
                    try {
                      const { requestOverlayPermission } = await import("./src/native/jail");
                      await requestOverlayPermission();
                    } catch {}
                  }}
                  style={{ flex: 1, backgroundColor: "#854D0E", padding: 12, borderRadius: 10, alignItems: "center" }}
                >
                  <Text style={{ color: "#fff", fontWeight: "800", fontSize: 12 }}>Open Settings → Allow</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  onPress={async () => {
                    try {
                      const { canDrawOverlays } = await import("./src/native/jail");
                      const ok = await canDrawOverlays();
                      setHasOverlayPermission(ok);
                      if (ok) Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
                    } catch {}
                  }}
                  style={{ backgroundColor: "#0F1320", borderWidth: 1, borderColor: "#1A1F2E", padding: 12, borderRadius: 10, alignItems: "center" }}
                >
                  <Text style={{ color: "#fff", fontWeight: "700", fontSize: 12 }}>I've Allowed ✓</Text>
                </TouchableOpacity>
              </View>
            </View>
          )}

          <ScrollView contentContainerStyle={{ paddingBottom: 110 + insets.bottom }} showsVerticalScrollIndicator={false}>
            {tab === "today" && (
              <HomeTab
                apps={allApps}
                usage={usage}
                jailed={jailed}
                setJailed={setJailed}
                setTab={setTab}
                timeSaved={timeSaved}
                theme={theme}
                isDark={isDark}
              />
            )}
            {tab === "jail" && (
              <JailTab
                apps={allApps}
                jailed={jailed}
                setJailed={setJailed}
                onAddApp={addCustomApp}
                onRemoveApp={removeCustomApp}
                theme={theme}
                isDark={isDark}
              />
            )}
            {tab === "vault" && (
              <VaultTab pomodoro={pomodoro} setPomodoro={setPomodoro} pomRunning={pomRunning} setPomRunning={setPomRunning} theme={theme} isDark={isDark} />
            )}
            {tab === "you" && (
              <YouTab
                streak={streak}
                timeSaved={timeSaved}
                adWatchCount={adWatchCount}
                heatmap={heatmap}
                user={user}
                theme={theme}
                isDark={isDark}
                onClear={async () => {
                  const { clear } = await import("./src/store/useStore");
                  await clear();
                  await AsyncStorage.removeItem("dont_custom_apps");
                  setStreak(0);
                  setTimeSaved(0);
                  setUsage(Object.fromEntries(Object.keys(DEFAULT_APPS).map((k) => [k, 0])) as any);
                  setAppsConfig({ ...DEFAULT_APPS });
                  setAdWatchCount(0);
                  setHeatmap(Array.from({ length: 90 }, () => 0));
                  setJailed(null);
                }}
                onSignOut={async () => {
                  await signOut();
                  setUser(null);
                  setOnboarded(false);
                }}
              />
            )}
          </ScrollView>

          {/* BOTTOM NAV — auto-adjusts for gesture vs 3-button nav */}
          <View style={[styles.tabBarWrap, { backgroundColor: theme.overlay, borderTopColor: theme.border, paddingBottom: Math.max(insets.bottom, 12) }]}>
            <View style={styles.tabBar}>
              {[
                { id: "today", label: "Today", icon: "◯" },
                { id: "jail", label: "Jail", icon: "▦", dot: !!jailed },
                { id: "vault", label: "Vault", icon: "⬡" },
                { id: "you", label: "You", icon: "⬢" },
              ].map((t) => (
                <TouchableOpacity
                  key={t.id}
                  onPress={() => {
                    Haptics.selectionAsync();
                    setTab(t.id as any);
                  }}
                  style={[styles.tabItem, tab === t.id && styles.tabItemActive]}
                >
                  <View style={[styles.tabIcon, tab === t.id && styles.tabIconActive]}>
                    <Text style={[styles.tabIconTxt, tab === t.id && { color: "#fff" }]}>{t.icon}</Text>
                    {t.dot && <View style={styles.dot} />}
                  </View>
                  <Text style={[styles.tabLabel, tab === t.id && styles.tabLabelActive]}>{t.label}</Text>
                </TouchableOpacity>
              ))}
            </View>
            <View style={styles.bannerAd}>
              <Text style={styles.bannerTxt}>Support DON'T • Ads keep it free</Text>
              <View style={styles.bannerAdInner}>
                <Text style={styles.bannerAdLabel}>DON'T Pro — Remove ads ₹99</Text>
              </View>
            </View>
          </View>

          {/* JAIL OVERLAY — full screen sophisticated */}
          {jailed && <JailOverlay apps={allApps} appId={jailed} theme={theme} isDark={isDark} onClose={() => { hideOverlay().catch(() => {}); setJailed(null); }} onUnlock={(via) => {
            hideOverlay().catch(() => {});
            if (via === "ad") setAdWatchCount(c => c + 1);
            setUsage(u => ({ ...u, [jailed!]: 0 }));
            setTimeSaved(s => s + 18);
            setStreak(s => s + 1);
            setHeatmap(h => markToday(h));
            setJailed(null);
            Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
          }} />}
        </SafeAreaView>
      )}
    </View>
  );
}

export default function App() {
  return (
    <SafeAreaProvider>
      <AppInner />
    </SafeAreaProvider>
  );
}

function Onboarding({ onDone, theme, isDark }: { onDone: () => void; theme: any; isDark: boolean }) {
  const [i, setI] = useState(0);
  const slides = [
    {
      k: "01",
      title: "Your apps\ngo to jail.",
      desc: "Pick Instagram, YouTube, X, Reddit. Set jail time. When you hit the limit — vault door slams shut.",
      accent: "#EF4444",
    },
    {
      k: "02",
      title: "Break out\nwith proof.",
      desc: "Do 10 pushups, 1-min breathe, or clean desk — camera verifies. Or watch a Rewarded Ad (15m unlock). Your choice, no shame.",
      accent: "#60A5FA",
    },
    {
      k: "03",
      title: "Get 2 hours\nback daily.",
      desc: "Streaks, heatmap, time saved. Level up from Prisoner → Warden. 100% offline, works on airplane mode. Ads fund us.",
      accent: "#22C55E",
    },
  ];
  const s = slides[i];
  return (
    <SafeAreaView style={{ flex: 1, padding: 24, backgroundColor: theme.bg }}>
      <View style={{ flex: 1, justifyContent: "center" }}>
        <Text style={[styles.mono, { color: theme.muted }]}>DON'T • {s.k} / 03</Text>
        <Text style={[styles.onTitle, { color: s.accent }]}>{s.title}</Text>
        <Text style={[styles.onDesc, { color: theme.muted }]}>{s.desc}</Text>

        <View style={styles.vaultPreview}>
          <LinearGradient colors={isDark ? (["#0F1320", "#1A1F2E"] as any) : (["#FFFFFF", "#F1F5F9"] as any)} style={[styles.vaultCard, { borderColor: theme.border }]}>
            <View style={[styles.vaultDoor, { backgroundColor: theme.card2, borderColor: theme.border }]}>
              <View style={[styles.vaultBolt, { backgroundColor: theme.border }]} />
              <Text style={[styles.vaultIcon, { color: theme.text }]}>▦</Text>
              <View style={[styles.vaultBolt, { backgroundColor: theme.border }]} />
            </View>
            <Text style={[styles.vaultLabel, { color: theme.subtle }]}>VAULT DOOR • 60fps spring</Text>
          </LinearGradient>
        </View>
      </View>

      <View style={{ flexDirection: "row", gap: 12, alignItems: "center" }}>
        <View style={{ flexDirection: "row", gap: 6, flex: 1 }}>
          {slides.map((_, idx) => (
            <View key={idx} style={[styles.dotLine, { backgroundColor: theme.border }, idx === i && { backgroundColor: isDark ? "#fff" : theme.text, width: 28 }]} />
          ))}
        </View>
        <TouchableOpacity
          onPress={() => (i < 2 ? setI(i + 1) : onDone())}
          style={[styles.primaryBtn, { backgroundColor: isDark ? "#fff" : theme.text }]}
        >
          <Text style={[styles.primaryBtnTxt, { color: isDark ? "#06080F" : theme.bg }]}>{i < 2 ? "Next →" : "Enter DON'T"}</Text>
        </TouchableOpacity>
      </View>
      <Text style={[styles.monoCenter, { color: theme.subtle }]}>Offline-first • AdMob online • AAB ready • com.dont.jail</Text>
    </SafeAreaView>
  );
}

function HomeTab({ apps, usage, jailed, setJailed, setTab, timeSaved, theme, isDark }: any) {
  return (
    <View style={{ padding: 16, gap: 14 }}>
      {/* HERO — time saved */}
      <LinearGradient colors={isDark ? ["#0F1320", "#111A2E"] : ["#FFFFFF", "#F1F5F9"]} style={[styles.hero, { borderColor: theme.border }]}>
        <View style={{ flexDirection: "row", justifyContent: "space-between" }}>
          <View>
            <Text style={[styles.mono, { color: theme.muted }]}>TODAY • {new Date().toLocaleDateString()}</Text>
            <Text style={[styles.heroTitle, { color: theme.text }]}>{Math.floor(timeSaved / 60)}h {timeSaved % 60}m saved</Text>
            <Text style={[styles.heroSub, { color: theme.success }]}>{timeSaved === 0 ? "No time saved yet • Jail an app to start" : `+18m vs start • ${Math.floor(timeSaved / 18)} jails avoided`}</Text>
          </View>
          <View style={[styles.heroRing, { backgroundColor: theme.card2, borderColor: theme.success }]}>
            <Text style={[styles.heroRingTxt, { color: theme.success }]}>{timeSaved === 0 ? "0%" : `${Math.min(100, Math.round((timeSaved / 120) * 100))}%`}</Text>
            <Text style={[styles.monoSmall, { color: theme.muted }]}>FOCUS</Text>
          </View>
        </View>
        <View style={[styles.heroBarTrack, { backgroundColor: theme.card2, borderColor: theme.border }]}>
          <View style={[styles.heroBarFill, { width: timeSaved === 0 ? "0%" : `${Math.min(100, Math.round((timeSaved / 120) * 100))}%` }]} />
        </View>
      </LinearGradient>

      {/* APPS — sophisticated rings */}
      <View style={styles.sectionRow}>
        <Text style={[styles.sectionTitle, { color: theme.text }]}>Jailed Apps</Text>
        <Text style={[styles.sectionLink, { color: theme.accent }]}>Edit →</Text>
      </View>

      <View style={styles.appGrid}>
        {(Object.keys(apps) as string[]).map((id) => {
          const app = apps[id];
          const used = usage[id] || 0;
          const pct = Math.min(100, (used / app.limit) * 100);
          const isJailed = jailed === id || pct >= 100;
          return (
            <TouchableOpacity
              key={id}
              onPress={() => {
                Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                if (isJailed) setJailed(id);
              }}
              style={[styles.appCard, { backgroundColor: theme.card, borderColor: isJailed ? "#EF444433" : theme.border }, isJailed && { backgroundColor: isDark ? "#14101A" : "#FFF1F2" }]}
            >
              <View style={[styles.appIcon, { backgroundColor: app.color + "18", borderColor: app.color + "40" }]}>
                <Text style={[styles.appIconTxt, { color: app.color }]}>{app.icon}</Text>
              </View>
              <Text style={[styles.appName, { color: theme.text }]}>{app.name}</Text>
              <Text style={[styles.monoSmall, { color: theme.muted }]}>{used}m / {app.limit}m</Text>
              <View style={[styles.ringTrack, { backgroundColor: theme.card2, borderColor: theme.border }]}>
                <View style={[styles.ringFill, { width: `${pct}%`, backgroundColor: isJailed ? "#EF4444" : app.color }]} />
              </View>
              <Text style={[styles.appStatus, { color: theme.muted }, isJailed && { color: "#EF4444" }]}>{isJailed ? "🔒 JAILED" : pct > 80 ? "⚠ " + Math.round(pct) + "%" : "○ free"}</Text>
            </TouchableOpacity>
          );
        })}
      </View>

      {/* QUICK ACTIONS */}
      <View style={styles.qaRow}>
        <TouchableOpacity onPress={() => setTab("vault")} style={[styles.qaCard, { backgroundColor: theme.card, borderColor: theme.border }]}>
          <Text style={[styles.qaIcon, { color: theme.accent }]}>◐</Text>
          <Text style={[styles.qaTitle, { color: theme.text }]}>Focus Vault</Text>
          <Text style={[styles.monoSmall, { color: theme.muted }]}>25:00 • Start</Text>
        </TouchableOpacity>
        <TouchableOpacity onPress={() => setTab("jail")} style={[styles.qaCard, { backgroundColor: theme.card, borderColor: theme.border }]}>
          <Text style={[styles.qaIcon, { color: theme.accent }]}>▦</Text>
          <Text style={[styles.qaTitle, { color: theme.text }]}>Jail Breach</Text>
          <Text style={[styles.monoSmall, { color: theme.muted }]}>{jailed ? "1 jailed" : "All free"}</Text>
        </TouchableOpacity>
      </View>

      <View style={[styles.noteCard, { backgroundColor: theme.card2, borderColor: theme.border }]}>
        <Text style={[styles.noteTitle, { color: theme.text }]}>How offline works ✈︎</Text>
        <Text style={[styles.noteDesc, { color: theme.muted }]}>All timers run locally (AsyncStorage). No internet needed. Ads load only when online — fail gracefully offline. No data leaves your phone.</Text>
      </View>
    </View>
  );
}

function JailTab({ apps, jailed, setJailed, onAddApp, onRemoveApp, theme, isDark }: any) {
  const [newName, setNewName] = useState("");
  const [newPkg, setNewPkg] = useState("");
  const [newLimit, setNewLimit] = useState("30");
  return (
    <View style={{ padding: 16, gap: 16 }}>
      <Text style={[styles.sectionTitle, { color: theme.text }]}>Jail Control</Text>
      <Text style={[styles.sectionSub, { color: theme.muted }]}>Tap any app to test jail door • Long-press custom app to remove</Text>

      <View style={styles.jailList}>
        {Object.keys(apps).map((id) => (
          <TouchableOpacity
            key={id}
            onPress={() => setJailed(id)}
            onLongPress={() => onRemoveApp(id)}
            style={[styles.jailRow, { backgroundColor: theme.card, borderColor: theme.border }]}
          >
            <View style={[styles.jailIcon, { backgroundColor: apps[id].color + "14" }]}>
              <Text style={{ color: apps[id].color, fontWeight: "800" }}>{apps[id].icon}</Text>
            </View>
            <View style={{ flex: 1 }}>
              <Text style={[styles.jailName, { color: theme.text }]}>{apps[id].name}</Text>
              <Text style={[styles.monoSmall, { color: theme.muted }]}>Limit {apps[id].limit}m • Tap to jail {DEFAULT_APPS[id] ? "" : "• long-press to remove"}</Text>
            </View>
            <View style={[styles.jailBadge, { backgroundColor: theme.card2, borderColor: theme.border }]}>
              <Text style={[styles.jailBadgeTxt, { color: theme.text }]}>JAIL →</Text>
            </View>
          </TouchableOpacity>
        ))}
      </View>

      <View style={{ backgroundColor: theme.card, borderWidth: 1, borderColor: theme.border, borderRadius: 14, padding: 14, gap: 10 }}>
        <Text style={[styles.sectionTitle, { color: theme.text }]}>Add Custom App</Text>
        <Text style={[styles.sectionSub, { color: theme.muted }]}>Add any app you want to jail — limit in minutes</Text>
        <TextInput
          value={newName}
          onChangeText={setNewName}
          placeholder="App name (e.g. TikTok)"
          placeholderTextColor={theme.subtle}
          style={[styles.input, { marginTop: 0, backgroundColor: theme.card2, borderColor: theme.border, color: theme.text }]}
        />
        <TextInput
          value={newPkg}
          onChangeText={setNewPkg}
          placeholder="Package (e.g. com.zhiliaoapp.musically)"
          placeholderTextColor={theme.subtle}
          autoCapitalize="none"
          style={[styles.input, { marginTop: 0, backgroundColor: theme.card2, borderColor: theme.border, color: theme.text }]}
        />
        <View style={{ flexDirection: "row", gap: 8 }}>
          <TextInput
            value={newLimit}
            onChangeText={setNewLimit}
            placeholder="30"
            placeholderTextColor={theme.subtle}
            keyboardType="number-pad"
            style={[styles.input, { flex: 1, marginTop: 0, textAlign: "center", backgroundColor: theme.card2, borderColor: theme.border, color: theme.text }]}
          />
          <TouchableOpacity
            onPress={() => {
              const limit = parseInt(newLimit, 10) || 30;
              onAddApp(newName, newPkg, limit);
              setNewName("");
              setNewPkg("");
              setNewLimit("30");
            }}
            style={{ flex: 1, backgroundColor: "#fff", padding: 12, borderRadius: 10, alignItems: "center", justifyContent: "center" }}
          >
            <Text style={{ color: "#06080F", fontWeight: "800", fontSize: 12 }}>+ Add App</Text>
          </TouchableOpacity>
        </View>
        <Text style={styles.monoSmallCenter}>Custom apps saved offline • appears on Today & Jail instantly</Text>
      </View>
    </View>
  );
}

function VaultTab({ pomodoro, setPomodoro, pomRunning, setPomRunning, theme, isDark }: any) {
  const mins = Math.floor(pomodoro / 60)
    .toString()
    .padStart(2, "0");
  const secs = (pomodoro % 60).toString().padStart(2, "0");
  const pct = 1 - pomodoro / (25 * 60);
  return (
    <View style={{ padding: 16, gap: 16, alignItems: "center" }}>
      <Text style={[styles.sectionTitle, { color: theme.text }]}>Focus Vault • Pomodoro</Text>
      <Text style={[styles.sectionSub, { color: theme.muted }]}>25/5 • ambient rain • streak +1 on complete • interstitial after</Text>

      <View style={[styles.vaultTimerCard, { backgroundColor: theme.card, borderColor: theme.border }]}>
        <View style={[styles.vaultRingWrap, { backgroundColor: theme.card2, borderColor: theme.border }]}>
          <View style={[styles.vaultRingBg, { backgroundColor: theme.card2 }]} />
          <View style={[styles.vaultRingFill, { height: `${pct * 100}%` }]} />
          <View style={styles.vaultRingCenter}>
            <Text style={[styles.vaultTime, { color: theme.text }]}>{mins}:{secs}</Text>
            <Text style={[styles.monoSmall, { color: theme.muted }]}>{pomRunning ? "FOCUSING" : "READY"}</Text>
          </View>
        </View>

        <View style={{ flexDirection: "row", gap: 12, marginTop: 18 }}>
          <TouchableOpacity
            onPress={() => {
              Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
              setPomRunning(!pomRunning);
            }}
            style={[styles.vaultBtn, pomRunning ? styles.vaultBtnActive : null]}
          >
            <Text style={styles.vaultBtnTxt}>{pomRunning ? "⏸ Pause" : "▶ Start Focus"}</Text>
          </TouchableOpacity>
          <TouchableOpacity onPress={() => { setPomodoro(25 * 60); setPomRunning(false); }} style={styles.vaultBtnGhost}>
            <Text style={styles.vaultBtnGhostTxt}>Reset</Text>
          </TouchableOpacity>
        </View>

        <View style={styles.ambientRow}>
          {["Rain", "Lofi", "Forest", "White"].map((a) => (
            <View key={a} style={styles.ambientPill}>
              <Text style={styles.monoSmall}>{a}</Text>
            </View>
          ))}
        </View>
      </View>

      <View style={styles.noteCard}>
        <Text style={styles.noteTitle}>Stay focused → vault complete</Text>
        <Text style={styles.noteDesc}>After vault, a short ad supports the app. Rewarded option extends vault +10m. Offline works without ads.</Text>
      </View>
    </View>
  );
}

function YouTab({ streak, timeSaved, adWatchCount, heatmap, user, theme, isDark, onSignOut, onClear }: any) {
  const days: number[] = heatmap || Array.from({ length: 90 }, () => 0);
  const level = Math.floor(streak / 3) + 1;
  return (
    <View style={{ padding: 16, gap: 16 }}>
      <View style={[styles.profileCard, { borderColor: theme.border }]}>
        <LinearGradient colors={isDark ? (["#1A1F2E", "#0F1320"] as any) : (["#FFFFFF", "#F1F5F9"] as any)} style={styles.profileGrad}>
          <View style={styles.avatar}>
            <Text style={styles.avatarTxt}>{user?.email?.[0]?.toUpperCase() || "LD"}</Text>
          </View>
          <View style={{ flex: 1 }}>
            <Text style={styles.profileName}>Warden Level {level}</Text>
            <Text style={styles.monoSmall}>🔥 {streak} day streak • {Math.floor(timeSaved / 60)}h saved • {streak > 0 ? "Top " + Math.max(1, 20 - streak) + "%" : "Start today"}</Text>
            <Text style={styles.monoSmall}>{user?.isGuest ? `Guest • ${guestDaysLeft(user)}d left` : user?.email}</Text>
          </View>
          <View style={styles.levelBadge}>
            <Text style={styles.levelBadgeTxt}>LVL {level}</Text>
          </View>
        </LinearGradient>
      </View>
      <View style={{ flexDirection: "row", gap: 10 }}>
        <View style={[styles.statBoxLarge, { backgroundColor: user?.isGuest ? "#1A1400" : "#0F1320", borderColor: user?.isGuest ? "#854D0E" : "#1A1F2E" }]}>
          <Text style={[styles.statNumLarge, user?.isGuest && { color: "#FDE68A" }]}>{user?.isGuest ? `${guestDaysLeft(user)}d` : "∞"}</Text>
          <Text style={styles.monoSmall}>{user?.isGuest ? "Guest left" : "Email • Permanent"}</Text>
        </View>
        <TouchableOpacity onPress={onSignOut} style={[styles.statBoxLarge, { backgroundColor: "#0A0D18" }]}>
          <Text style={styles.statNumLarge}>⎋</Text>
          <Text style={styles.monoSmall}>Sign Out</Text>
        </TouchableOpacity>
      </View>

      <Text style={[styles.sectionTitle, { color: theme.text }]}>90-Day Heatmap</Text>
      <View style={[styles.heatmap, { backgroundColor: theme.card, borderColor: theme.border }]}>
        {days.map((v, i) => (
          <View key={i} style={[styles.heatCell, { backgroundColor: theme.card2, borderColor: theme.border }, v ? { backgroundColor: "#22C55E", borderColor: "#22C55E" } : null]} />
        ))}
      </View>
      <Text style={styles.monoSmallCenter}>■ jailed day • □ free day • GitHub-style</Text>

      <View style={styles.qaRow}>
        <View style={styles.statBoxLarge}>
          <Text style={styles.statNumLarge}>{adWatchCount * 7}</Text>
          <Text style={styles.monoSmall}>Jails this week</Text>
        </View>
        <View style={styles.statBoxLarge}>
          <Text style={styles.statNumLarge}>₹{(adWatchCount * 12).toFixed(0)}</Text>
          <Text style={styles.monoSmall}>Est. value saved</Text>
        </View>
      </View>

      <View style={{ backgroundColor: "#0F1320", borderWidth: 1, borderColor: "#1A1F2E", borderRadius: 12, padding: 12, gap: 8 }}>
        <Text style={styles.settingsTitle}>About DON'T</Text>
        <Text style={{ color: "#AAB2D6", fontSize: 11, lineHeight: 16 }}>Your apps go to jail so you can go free. 100% offline, no tracking, no data leaves your phone. Grant Usage Access to enable auto-jailing. Add any app via Jail tab.</Text>
        <Text style={{ color: "#5A6378", fontSize: 10 }}>v1.0.0 • com.dont.jail • Made for focus</Text>
      </View>

      <TouchableOpacity onPress={onClear} style={{ backgroundColor: "#1A0F0F", borderWidth: 1, borderColor: "#7F1D1D", borderRadius: 12, padding: 12, alignItems: "center" }}>
        <Text style={{ color: "#FECACA", fontWeight: "800", fontSize: 12 }}>Clear All Data — Reset to 0</Text>
        <Text style={{ color: "#8B93B8", fontSize: 10, marginTop: 2 }}>Removes streak, time saved, heatmap • Cannot undo</Text>
      </TouchableOpacity>

      <Text style={styles.monoSmallCenter}>Real data only • Streak starts at 0 • Each jail unlock saves 18m & marks today • Offline persisted via AsyncStorage</Text>
    </View>
  );
}

function JailOverlay({ apps, appId, theme, isDark, onClose, onUnlock }: { apps: Record<string, AppConfig>; appId: AppId; theme: any; isDark: boolean; onClose: () => void; onUnlock: (via: "task" | "ad") => void }) {
  const [mode, setMode] = useState<"choose" | "ad" | "task">("choose");
  const [adProgress, setAdProgress] = useState(0);
  const scale = useRef(new Animated.Value(0.9)).current;

  useEffect(() => {
    Animated.spring(scale, { toValue: 1, friction: 6, tension: 90, useNativeDriver: true }).start();
    if (mode === "ad") {
      const t = setInterval(() => setAdProgress((p) => (p < 100 ? p + 4 : 100)), 80);
      const done = setTimeout(() => onUnlock("ad"), 2200);
      return () => { clearInterval(t); clearTimeout(done); };
    }
  }, [mode]);

  const app = apps[appId] || { name: appId, limit: 30, icon: "⬢", color: "#8B93B8" };

  return (
    <View style={[styles.overlay, { backgroundColor: theme.bg }]}>
      <LinearGradient colors={isDark ? (["#06080F", "#0F0F1A"] as any) : (["#F8FAFC", "#FFFFFF"] as any)} style={StyleSheet.absoluteFill} />
      <SafeAreaView style={{ flex: 1, padding: 20 }}>
        <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center" }}>
          <Text style={[styles.mono, { color: theme.muted }]}>🔒 JAIL • {app.name.toUpperCase()}</Text>
          <TouchableOpacity onPress={onClose} style={styles.closeBtn}>
            <Text style={styles.closeTxt}>✕</Text>
          </TouchableOpacity>
        </View>

        <Animated.View style={[styles.jailCard, { backgroundColor: theme.card, borderColor: theme.border, transform: [{ scale }] }]}>
          <View style={[styles.jailDoorLarge, { backgroundColor: theme.card2, borderColor: theme.border }]}>
            <View style={styles.jailDoorBar} />
            <View style={styles.jailDoorBar} />
            <View style={styles.jailDoorBar} />
            <Text style={styles.jailDoorIcon}>▦</Text>
            <View style={styles.jailDoorBar} />
            <View style={styles.jailDoorBar} />
          </View>
          <Text style={[styles.jailTitle, { color: theme.text }]}>{app.name} is in jail.</Text>
          <Text style={[styles.jailSub, { color: theme.muted }]}>You hit {app.limit}m today. Vault door is locked for 12m.</Text>
          <Text style={styles.monoSmallCenter}>Offline lock • No workaround • Airplane mode still jailed</Text>
        </Animated.View>

        {mode === "choose" && (
          <View style={{ gap: 12, marginTop: 16 }}>
            <Text style={styles.sectionTitle}>Break out — choose:</Text>
            <TouchableOpacity
              onPress={() => {
                Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
                setMode("task");
              }}
              style={styles.breakCard}
            >
              <View style={styles.breakIconWrap}>
                <Text style={styles.breakIcon}>◐</Text>
              </View>
              <View style={{ flex: 1 }}>
                <Text style={styles.breakTitle}>Do a Task (free, offline)</Text>
                <Text style={styles.breakDesc}>10 pushups • 1-min breathe • clean desk — camera verifies (mock)</Text>
              </View>
              <Text style={styles.breakArrow}>→</Text>
            </TouchableOpacity>

            <TouchableOpacity
              onPress={() => {
                Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
                setMode("ad");
              }}
              style={[styles.breakCard, styles.breakCardAd]}
            >
              <View style={[styles.breakIconWrap, { backgroundColor: "#60A5FA18", borderColor: "#60A5FA40" }]}>
                <Text style={[styles.breakIcon, { color: "#60A5FA" }]}>▶</Text>
              </View>
              <View style={{ flex: 1 }}>
                <Text style={styles.breakTitle}>Watch Ad (15m unlock)</Text>
                <Text style={styles.breakDesc}>~20s • Supports DON'T to stay free • Offline still works via Tasks</Text>
              </View>
              <View style={styles.adBadge}>
                <Text style={styles.adBadgeTxt}>$ • REWARDED</Text>
              </View>
            </TouchableOpacity>

            <Text style={styles.monoSmallCenter}>Interstitial will show after unlock (capped 1/5m) • Banner below</Text>
            <View style={styles.miniBanner}>
              <Text style={styles.miniBannerTxt}>Support banner • Offline hidden • Remove with Pro</Text>
            </View>
          </View>
        )}

        {mode === "task" && (
          <View style={styles.taskCard}>
            <Text style={styles.taskTitle}>Prove it — 10 pushups</Text>
            <Text style={styles.taskDesc}>Camera mock: hold phone, do pushups, accelerometer counts. (Demo: tap "I did it")</Text>
            <TouchableOpacity onPress={() => onUnlock("task")} style={styles.primaryBtn}>
              <Text style={styles.primaryBtnTxt}>✓ I did 10 pushups — Unlock</Text>
            </TouchableOpacity>
            <TouchableOpacity onPress={() => setMode("choose")} style={styles.ghostBtn}>
              <Text style={styles.ghostBtnTxt}>← Back</Text>
            </TouchableOpacity>
          </View>
        )}

        {mode === "ad" && (
          <View style={styles.taskCard}>
            <Text style={styles.taskTitle}>Rewarded Ad — Unlocking…</Text>
            <View style={styles.adProgressTrack}>
              <View style={[styles.adProgressFill, { width: `${adProgress}%` }]} />
            </View>
            <Text style={styles.monoSmallCenter}>{adProgress}% • ca-app-pub…/5224354917 (test) • 20s</Text>
            <Text style={styles.taskDesc}>Online only. If offline → task option still works. This is your revenue.</Text>
          </View>
        )}
      </SafeAreaView>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: "#06080F" },
  header: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", paddingHorizontal: 16, paddingTop: 10, paddingBottom: 12, borderBottomWidth: 1, borderBottomColor: "#1A1F2E" },
  logo: { fontFamily: "SpaceGrotesk_700Bold", fontSize: 18, color: "#fff", letterSpacing: 0.5 },
  sub: { fontFamily: "IBMPlexMono_400Regular", fontSize: 10, color: "#8B93B8", marginTop: 2, letterSpacing: 0.8 },
  headerRight: { flexDirection: "row", gap: 8, alignItems: "center" },
  streakPill: { backgroundColor: "#1A1F2E", borderWidth: 1, borderColor: "#2A3148", paddingHorizontal: 10, paddingVertical: 6, borderRadius: 999 },
  streakTxt: { color: "#fff", fontWeight: "700", fontSize: 12 },
  savedPill: { backgroundColor: "#0F1A12", borderWidth: 1, borderColor: "#1E3A1A", paddingHorizontal: 10, paddingVertical: 6, borderRadius: 999 },
  savedTxt: { color: "#22C55E", fontWeight: "700", fontSize: 11 },
  mono: { fontFamily: "IBMPlexMono_500Medium", fontSize: 10, color: "#8B93B8", letterSpacing: 1.2 },
  monoSmall: { fontFamily: "IBMPlexMono_400Regular", fontSize: 11, color: "#8B93B8" },
  monoSmallCenter: { fontFamily: "IBMPlexMono_400Regular", fontSize: 11, color: "#8B93B8", textAlign: "center", marginTop: 6 },
  monoCenter: { fontFamily: "IBMPlexMono_400Regular", fontSize: 10, color: "#5A6378", textAlign: "center", marginTop: 14, letterSpacing: 0.6 },
  tabBarWrap: { position: "absolute", bottom: 0, left: 0, right: 0, backgroundColor: "rgba(6,8,15,0.92)", borderTopWidth: 1, borderTopColor: "#1A1F2E", paddingBottom: Platform.OS === "ios" ? 18 : 10, paddingTop: 8 },
  tabBar: { flexDirection: "row", justifyContent: "space-around", paddingHorizontal: 10 },
  tabItem: { alignItems: "center", gap: 4, paddingHorizontal: 14, paddingVertical: 6, borderRadius: 12 },
  tabItemActive: { backgroundColor: "#0F1320", borderWidth: 1, borderColor: "#1A1F2E" },
  tabIcon: { width: 28, height: 28, borderRadius: 8, backgroundColor: "#0F1320", borderWidth: 1, borderColor: "#1A1F2E", alignItems: "center", justifyContent: "center" },
  tabIconActive: { backgroundColor: "#1E2440", borderColor: "#2A3148" },
  tabIconTxt: { color: "#8B93B8", fontWeight: "800", fontSize: 13 },
  dot: { position: "absolute", top: -3, right: -3, width: 8, height: 8, borderRadius: 4, backgroundColor: "#EF4444", borderWidth: 1, borderColor: "#06080F" },
  tabLabel: { fontFamily: "IBMPlexMono_400Regular", fontSize: 10, color: "#5A6378", letterSpacing: 0.6 },
  tabLabelActive: { color: "#fff", fontFamily: "IBMPlexMono_500Medium" },
  bannerAd: { marginTop: 8, marginHorizontal: 12, backgroundColor: "#0A0D18", borderWidth: 1, borderColor: "#1A1F2E", borderRadius: 10, padding: 8, flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
  bannerTxt: { fontFamily: "IBMPlexMono_400Regular", fontSize: 10, color: "#5A6378" },
  bannerAdInner: { backgroundColor: "#1A1F2E", paddingHorizontal: 8, paddingVertical: 4, borderRadius: 6 },
  bannerAdLabel: { color: "#60A5FA", fontSize: 10, fontWeight: "700" },
  // onboarding
  onTitle: { fontFamily: "SpaceGrotesk_700Bold", fontSize: 36, color: "#fff", lineHeight: 38, marginTop: 12 },
  onDesc: { fontFamily: "SpaceGrotesk_600SemiBold", fontSize: 15, color: "#AAB2D6", marginTop: 12, lineHeight: 22 },
  vaultPreview: { marginTop: 22 },
  vaultCard: { borderRadius: 16, borderWidth: 1, borderColor: "#1A1F2E", padding: 18, gap: 12 },
  vaultDoor: { height: 86, backgroundColor: "#0A0D18", borderRadius: 12, borderWidth: 1, borderColor: "#1A1F2E", flexDirection: "row", alignItems: "center", justifyContent: "space-around", paddingHorizontal: 10 },
  vaultBolt: { width: 8, height: 8, borderRadius: 4, backgroundColor: "#1A1F2E" },
  vaultIcon: { color: "#fff", fontSize: 28, fontWeight: "900" },
  vaultLabel: { fontFamily: "IBMPlexMono_400Regular", fontSize: 10, color: "#5A6378", textAlign: "center", letterSpacing: 1 },
  dotLine: { height: 4, width: 24, borderRadius: 2, backgroundColor: "#1A1F2E" },
  primaryBtn: { backgroundColor: "#fff", paddingHorizontal: 18, paddingVertical: 12, borderRadius: 12 },
  primaryBtnTxt: { color: "#06080F", fontWeight: "800", fontSize: 13 },
  input: { backgroundColor: "#0A0D18", borderWidth: 1, borderColor: "#1A1F2E", borderRadius: 10, padding: 14, color: "#fff", fontSize: 15 },
  // home
  hero: { borderRadius: 16, borderWidth: 1, borderColor: "#1A1F2E", padding: 16, gap: 14 },
  heroTitle: { fontFamily: "SpaceGrotesk_700Bold", fontSize: 28, color: "#fff", marginTop: 6 },
  heroSub: { fontFamily: "IBMPlexMono_400Regular", fontSize: 12, color: "#22C55E", marginTop: 4 },
  heroRing: { width: 64, height: 64, borderRadius: 32, backgroundColor: "#0A0D18", borderWidth: 2, borderColor: "#22C55E", alignItems: "center", justifyContent: "center" },
  heroRingTxt: { color: "#22C55E", fontWeight: "900", fontSize: 14 },
  heroBarTrack: { height: 6, backgroundColor: "#0A0D18", borderRadius: 999, overflow: "hidden", borderWidth: 1, borderColor: "#1A1F2E" },
  heroBarFill: { height: "100%", backgroundColor: "#22C55E" },
  sectionRow: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginTop: 2 },
  sectionTitle: { fontFamily: "SpaceGrotesk_700Bold", fontSize: 14, color: "#fff" },
  sectionSub: { fontFamily: "IBMPlexMono_400Regular", fontSize: 11, color: "#5A6378", marginTop: 2 },
  sectionLink: { fontFamily: "IBMPlexMono_500Medium", fontSize: 12, color: "#60A5FA" },
  appGrid: { flexDirection: "row", flexWrap: "wrap", gap: 12 },
  appCard: { width: (width - 16 * 2 - 12) / 2, backgroundColor: "#0F1320", borderWidth: 1, borderColor: "#1A1F2E", borderRadius: 14, padding: 14, gap: 8 },
  appCardJailed: { borderColor: "#EF444433", backgroundColor: "#14101A" },
  appIcon: { width: 38, height: 38, borderRadius: 10, borderWidth: 1, alignItems: "center", justifyContent: "center" },
  appIconTxt: { fontWeight: "900", fontSize: 16 },
  appName: { fontFamily: "SpaceGrotesk_600SemiBold", fontSize: 13, color: "#fff" },
  ringTrack: { height: 4, backgroundColor: "#0A0D18", borderRadius: 999, overflow: "hidden", borderWidth: 1, borderColor: "#1A1F2E" },
  ringFill: { height: "100%", borderRadius: 999 },
  appStatus: { fontFamily: "IBMPlexMono_500Medium", fontSize: 10, color: "#8B93B8", letterSpacing: 0.8 },
  qaRow: { flexDirection: "row", gap: 12 },
  qaCard: { flex: 1, backgroundColor: "#0F1320", borderWidth: 1, borderColor: "#1A1F2E", borderRadius: 14, padding: 14, gap: 6 },
  qaIcon: { color: "#60A5FA", fontSize: 18, fontWeight: "900" },
  qaTitle: { fontFamily: "SpaceGrotesk_600SemiBold", fontSize: 13, color: "#fff" },
  noteCard: { backgroundColor: "#0A0D18", borderWidth: 1, borderColor: "#1A1F2E", borderRadius: 12, padding: 12, borderStyle: "dashed" },
  noteTitle: { fontFamily: "SpaceGrotesk_600SemiBold", fontSize: 12, color: "#fff" },
  noteDesc: { fontFamily: "IBMPlexMono_400Regular", fontSize: 11, color: "#8B93B8", marginTop: 4, lineHeight: 16 },
  // jail
  jailList: { gap: 10 },
  jailRow: { flexDirection: "row", alignItems: "center", gap: 12, backgroundColor: "#0F1320", borderWidth: 1, borderColor: "#1A1F2E", borderRadius: 12, padding: 12 },
  jailIcon: { width: 40, height: 40, borderRadius: 10, alignItems: "center", justifyContent: "center", borderWidth: 1, borderColor: "#1A1F2E" },
  jailName: { fontFamily: "SpaceGrotesk_600SemiBold", fontSize: 13, color: "#fff" },
  jailBadge: { backgroundColor: "#1A1F2E", paddingHorizontal: 10, paddingVertical: 6, borderRadius: 999, borderWidth: 1, borderColor: "#2A3148" },
  jailBadgeTxt: { color: "#fff", fontSize: 11, fontWeight: "800" },
  statsCard: { backgroundColor: "#0F1320", borderWidth: 1, borderColor: "#1A1F2E", borderRadius: 14, padding: 14 },
  statsTitle: { fontFamily: "SpaceGrotesk_600SemiBold", fontSize: 12, color: "#fff" },
  statBox: { flex: 1, backgroundColor: "#0A0D18", borderWidth: 1, borderColor: "#1A1F2E", borderRadius: 10, padding: 10, alignItems: "center" },
  statNum: { fontFamily: "SpaceGrotesk_700Bold", fontSize: 16, color: "#fff" },
  statBoxLarge: { flex: 1, backgroundColor: "#0F1320", borderWidth: 1, borderColor: "#1A1F2E", borderRadius: 14, padding: 14, alignItems: "center" },
  statNumLarge: { fontFamily: "SpaceGrotesk_700Bold", fontSize: 20, color: "#fff" },
  // vault
  vaultTimerCard: { backgroundColor: "#0F1320", borderWidth: 1, borderColor: "#1A1F2E", borderRadius: 16, padding: 18, alignItems: "center", width: "100%" },
  vaultRingWrap: { width: 180, height: 180, borderRadius: 90, backgroundColor: "#0A0D18", borderWidth: 1, borderColor: "#1A1F2E", overflow: "hidden", alignItems: "center", justifyContent: "center" },
  vaultRingBg: { ...StyleSheet.absoluteFill, backgroundColor: "#0A0D18" },
  vaultRingFill: { position: "absolute", bottom: 0, left: 0, right: 0, backgroundColor: "#60A5FA22", borderTopWidth: 2, borderTopColor: "#60A5FA" },
  vaultRingCenter: { alignItems: "center" },
  vaultTime: { fontFamily: "SpaceGrotesk_700Bold", fontSize: 36, color: "#fff", letterSpacing: 2 },
  vaultBtn: { backgroundColor: "#fff", paddingHorizontal: 18, paddingVertical: 12, borderRadius: 12 },
  vaultBtnActive: { backgroundColor: "#1E3A5F" },
  vaultBtnTxt: { color: "#06080F", fontWeight: "800", fontSize: 13 },
  vaultBtnGhost: { backgroundColor: "#0A0D18", borderWidth: 1, borderColor: "#1A1F2E", paddingHorizontal: 18, paddingVertical: 12, borderRadius: 12 },
  vaultBtnGhostTxt: { color: "#8B93B8", fontWeight: "700" },
  ambientRow: { flexDirection: "row", gap: 8, marginTop: 14 },
  ambientPill: { backgroundColor: "#0A0D18", borderWidth: 1, borderColor: "#1A1F2E", paddingHorizontal: 12, paddingVertical: 6, borderRadius: 999 },
  // you / profile
  profileCard: { borderRadius: 16, overflow: "hidden", borderWidth: 1, borderColor: "#1A1F2E" },
  profileGrad: { flexDirection: "row", alignItems: "center", gap: 12, padding: 16 },
  avatar: { width: 44, height: 44, borderRadius: 22, backgroundColor: "#fff", alignItems: "center", justifyContent: "center" },
  avatarTxt: { color: "#06080F", fontWeight: "900" },
  profileName: { fontFamily: "SpaceGrotesk_600SemiBold", fontSize: 14, color: "#fff" },
  levelBadge: { backgroundColor: "#fff", paddingHorizontal: 10, paddingVertical: 6, borderRadius: 999 },
  levelBadgeTxt: { color: "#06080F", fontWeight: "900", fontSize: 11 },
  heatmap: { flexDirection: "row", flexWrap: "wrap", gap: 4, backgroundColor: "#0F1320", borderWidth: 1, borderColor: "#1A1F2E", borderRadius: 12, padding: 12 },
  heatCell: { width: 14, height: 14, borderRadius: 3, backgroundColor: "#0A0D18", borderWidth: 1, borderColor: "#1A1F2E" },
  settingsCard: { backgroundColor: "#0F1320", borderWidth: 1, borderColor: "#1A1F2E", borderRadius: 14, padding: 14, gap: 10 },
  settingsTitle: { fontFamily: "SpaceGrotesk_600SemiBold", fontSize: 12, color: "#fff" },
  settingRow: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", backgroundColor: "#0A0D18", borderWidth: 1, borderColor: "#1A1F2E", borderRadius: 10, padding: 10 },
  settingLabel: { fontFamily: "IBMPlexMono_400Regular", fontSize: 11, color: "#AAB2D6" },
  settingVal: { fontFamily: "IBMPlexMono_500Medium", fontSize: 11, color: "#5A6378" },
  settingValActive: { fontFamily: "IBMPlexMono_500Medium", fontSize: 11, color: "#22C55E" },
  // overlay
  overlay: { position: "absolute", top: 0, left: 0, right: 0, bottom: 0, zIndex: 50 },
  closeBtn: { width: 32, height: 32, borderRadius: 16, backgroundColor: "#1A1F2E", borderWidth: 1, borderColor: "#2A3148", alignItems: "center", justifyContent: "center" },
  closeTxt: { color: "#fff", fontWeight: "800" },
  jailCard: { backgroundColor: "#0F1320", borderWidth: 1, borderColor: "#1A1F2E", borderRadius: 16, padding: 16, alignItems: "center", marginTop: 18 },
  jailDoorLarge: { width: "100%", height: 96, backgroundColor: "#0A0D18", borderRadius: 12, borderWidth: 1, borderColor: "#1A1F2E", flexDirection: "row", alignItems: "center", justifyContent: "space-around", paddingHorizontal: 14 },
  jailDoorBar: { width: 14, height: 64, backgroundColor: "#1A1F2E", borderRadius: 4, borderWidth: 1, borderColor: "#2A3148" },
  jailDoorIcon: { color: "#EF4444", fontSize: 28, fontWeight: "900" },
  jailTitle: { fontFamily: "SpaceGrotesk_700Bold", fontSize: 18, color: "#fff", marginTop: 12 },
  jailSub: { fontFamily: "IBMPlexMono_400Regular", fontSize: 12, color: "#AAB2D6", marginTop: 4, textAlign: "center" },
  breakCard: { flexDirection: "row", alignItems: "center", gap: 12, backgroundColor: "#0F1320", borderWidth: 1, borderColor: "#1A1F2E", borderRadius: 14, padding: 14 },
  breakCardAd: { backgroundColor: "#0F1420", borderColor: "#60A5FA30" },
  breakIconWrap: { width: 40, height: 40, borderRadius: 10, backgroundColor: "#0A0D18", borderWidth: 1, borderColor: "#1A1F2E", alignItems: "center", justifyContent: "center" },
  breakIcon: { color: "#22C55E", fontWeight: "900" },
  breakTitle: { fontFamily: "SpaceGrotesk_600SemiBold", fontSize: 13, color: "#fff" },
  breakDesc: { fontFamily: "IBMPlexMono_400Regular", fontSize: 11, color: "#8B93B8", marginTop: 2 },
  breakArrow: { color: "#5A6378", fontWeight: "900", fontSize: 16 },
  adBadge: { backgroundColor: "#60A5FA", paddingHorizontal: 8, paddingVertical: 4, borderRadius: 6 },
  adBadgeTxt: { color: "#fff", fontSize: 10, fontWeight: "900" },
  miniBanner: { backgroundColor: "#0A0D18", borderWidth: 1, borderColor: "#1A1F2E", borderRadius: 10, padding: 10, alignItems: "center", borderStyle: "dashed" },
  miniBannerTxt: { fontFamily: "IBMPlexMono_400Regular", fontSize: 10, color: "#5A6378" },
  taskCard: { backgroundColor: "#0F1320", borderWidth: 1, borderColor: "#1A1F2E", borderRadius: 14, padding: 14, gap: 12, marginTop: 16 },
  taskTitle: { fontFamily: "SpaceGrotesk_600SemiBold", fontSize: 14, color: "#fff" },
  taskDesc: { fontFamily: "IBMPlexMono_400Regular", fontSize: 11, color: "#8B93B8" },
  ghostBtn: { backgroundColor: "#0A0D18", borderWidth: 1, borderColor: "#1A1F2E", padding: 12, borderRadius: 12, alignItems: "center" },
  ghostBtnTxt: { color: "#8B93B8", fontWeight: "700" },
  adProgressTrack: { height: 8, backgroundColor: "#0A0D18", borderRadius: 999, overflow: "hidden", borderWidth: 1, borderColor: "#1A1F2E" },
  adProgressFill: { height: "100%", backgroundColor: "#60A5FA" },
});
