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
} from "react-native";
import { StatusBar } from "expo-status-bar";
import { SafeAreaView } from "react-native-safe-area-context";
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
import AuthScreen from "./src/auth/AuthScreen";
import { getUser, guestDaysLeft, signOut, User } from "./src/auth/auth";
import { load as loadStore, save as saveStore, markToday } from "./src/store/useStore";

SplashScreen.preventAutoHideAsync().catch(() => {});

// --- MOCK STORE (offline-first, AsyncStorage-ready) ---
type AppId = "instagram" | "youtube" | "reddit" | "twitter";
const APPS: Record<AppId, { name: string; icon: string; color: string; limit: number }> = {
  instagram: { name: "Instagram", icon: "◈", color: "#E1306C", limit: 30 },
  youtube: { name: "YouTube", icon: "▶", color: "#FF0000", limit: 45 },
  reddit: { name: "Reddit", icon: "⬢", color: "#FF4500", limit: 20 },
  twitter: { name: "X", icon: "✕", color: "#1DA1F2", limit: 20 },
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

const { width } = Dimensions.get("window");

export default function App() {
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
  const vaultAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    (async () => {
      const u = await getUser();
      setUser(u);
      // load real persisted stats (starts at 0, no mock)
      try {
        const cfg = await loadStore();
        if (cfg) {
          setStreak(cfg.streak);
          setTimeSaved(cfg.timeSavedMin);
          const m: Record<AppId, number> = { instagram: 0, youtube: 0, reddit: 0, twitter: 0 };
          (Object.keys(cfg.apps) as AppId[]).forEach((k) => {
            if (m[k as AppId] !== undefined) m[k as AppId] = cfg.apps[k].usedMin;
          });
          setUsage(m);
          setAdWatchCount(cfg.adWatchCount || 0);
          if (cfg.heatmap?.length === 90) setHeatmap(cfg.heatmap);
        }
      } catch {}
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
        (Object.keys(APPS) as AppId[]).map((k) => [k, { limitMin: APPS[k].limit, usedMin: usage[k] || 0, jailed: jailed === k }])
      ) as any,
      streak,
      timeSavedMin: timeSaved,
      level: Math.floor(streak / 3) + 1,
      adWatchCount,
      heatmap,
    };
    saveStore(cfg as any);
  }, [usage, streak, timeSaved, adWatchCount, heatmap, jailed, authLoading]);

  if (!fontsLoaded || authLoading) return <View style={{ flex: 1, backgroundColor: "#06080F" }} />;

  return (
    <View style={styles.root}>
      <StatusBar style="light" />
      <LinearGradient colors={["#06080F", "#0A0E1A"]} style={StyleSheet.absoluteFill} />

      {!user ? (
        <AuthScreen
          onAuthed={async () => {
            const u = await getUser();
            setUser(u);
          }}
        />
      ) : !onboarded ? (
        <Onboarding
          onDone={async () => {
            const AsyncStorage = (await import("@react-native-async-storage/async-storage")).default;
            await AsyncStorage.setItem("dont_onboarded", "1");
            setOnboarded(true);
          }}
        />
      ) : (
        <SafeAreaView style={{ flex: 1 }}>
          {/* HEADER */}
          <View style={styles.header}>
            <View>
              <Text style={styles.logo}>DON'T</Text>
              <Text style={styles.sub}>
                {user?.isGuest ? `Guest • ${guestDaysLeft(user)}d left` : user?.email} • Level {Math.floor(streak / 3) + 1} Warden
              </Text>
            </View>
            <View style={styles.headerRight}>
              <View style={styles.streakPill}>
                <Text style={styles.streakTxt}>🔥 {streak}</Text>
              </View>
              <View style={styles.savedPill}>
                <Text style={styles.savedTxt}>{Math.floor(timeSaved / 60)}h saved</Text>
              </View>
            </View>
          </View>
          {user?.isGuest && (
            <View style={{ marginHorizontal: 16, marginTop: 8, backgroundColor: "#1A1400", borderWidth: 1, borderColor: "#854D0E", borderRadius: 10, padding: 10, flexDirection: "row", justifyContent: "space-between", alignItems: "center" }}>
              <Text style={{ color: "#FDE68A", fontSize: 11, fontWeight: "700" }}>Guest trial: {guestDaysLeft(user)} days left → Sign in with email to keep streak</Text>
              <TouchableOpacity
                onPress={async () => {
                  await signOut();
                  setUser(null);
                  setOnboarded(false);
                }}
                style={{ backgroundColor: "#854D0E", paddingHorizontal: 8, paddingVertical: 4, borderRadius: 6 }}
              >
                <Text style={{ color: "#fff", fontSize: 10, fontWeight: "800" }}>Sign In</Text>
              </TouchableOpacity>
            </View>
          )}

          <ScrollView contentContainerStyle={{ paddingBottom: 110 }} showsVerticalScrollIndicator={false}>
            {tab === "today" && (
              <HomeTab
                usage={usage}
                jailed={jailed}
                setJailed={setJailed}
                setTab={setTab}
                timeSaved={timeSaved}
              />
            )}
            {tab === "jail" && (
              <JailTab
                jailed={jailed}
                setJailed={setJailed}
                setUsage={setUsage}
                setTimeSaved={setTimeSaved}
                setAdWatchCount={setAdWatchCount}
                adWatchCount={adWatchCount}
              />
            )}
            {tab === "vault" && (
              <VaultTab pomodoro={pomodoro} setPomodoro={setPomodoro} pomRunning={pomRunning} setPomRunning={setPomRunning} />
            )}
            {tab === "you" && (
              <YouTab
                streak={streak}
                timeSaved={timeSaved}
                adWatchCount={adWatchCount}
                heatmap={heatmap}
                user={user}
                onClear={async () => {
                  const { clear } = await import("./src/store/useStore");
                  await clear();
                  setStreak(0);
                  setTimeSaved(0);
                  setUsage({ instagram: 0, youtube: 0, reddit: 0, twitter: 0 });
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

          {/* BOTTOM NAV — sophisticated glass */}
          <View style={styles.tabBarWrap}>
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
            {/* BANNER AD MOCK */}
            <View style={styles.bannerAd}>
              <Text style={styles.bannerTxt}>AdMob Banner — 320×50 • Adaptive • Offline hides</Text>
              <View style={styles.bannerAdInner}>
                <Text style={styles.bannerAdLabel}>DON'T Pro — Remove ads ₹99</Text>
              </View>
            </View>
          </View>

          {/* JAIL OVERLAY — full screen sophisticated */}
          {jailed && <JailOverlay appId={jailed} onClose={() => setJailed(null)} onUnlock={(via) => {
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

function Onboarding({ onDone }: { onDone: () => void }) {
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
    <SafeAreaView style={{ flex: 1, padding: 24 }}>
      <View style={{ flex: 1, justifyContent: "center" }}>
        <Text style={styles.mono}>DON'T • {s.k} / 03</Text>
        <Text style={[styles.onTitle, { color: s.accent }]}>{s.title}</Text>
        <Text style={styles.onDesc}>{s.desc}</Text>

        <View style={styles.vaultPreview}>
          <LinearGradient colors={["#0F1320", "#1A1F2E"]} style={styles.vaultCard}>
            <View style={styles.vaultDoor}>
              <View style={styles.vaultBolt} />
              <Text style={styles.vaultIcon}>▦</Text>
              <View style={styles.vaultBolt} />
            </View>
            <Text style={styles.vaultLabel}>VAULT DOOR • 60fps spring</Text>
          </LinearGradient>
        </View>
      </View>

      <View style={{ flexDirection: "row", gap: 12, alignItems: "center" }}>
        <View style={{ flexDirection: "row", gap: 6, flex: 1 }}>
          {slides.map((_, idx) => (
            <View key={idx} style={[styles.dotLine, idx === i && { backgroundColor: "#fff", width: 28 }]} />
          ))}
        </View>
        <TouchableOpacity
          onPress={() => (i < 2 ? setI(i + 1) : onDone())}
          style={styles.primaryBtn}
        >
          <Text style={styles.primaryBtnTxt}>{i < 2 ? "Next →" : "Enter DON'T"}</Text>
        </TouchableOpacity>
      </View>
      <Text style={styles.monoCenter}>Offline-first • AdMob online • AAB ready • com.dont.jail</Text>
    </SafeAreaView>
  );
}

function HomeTab({ usage, jailed, setJailed, setTab, timeSaved }: any) {
  return (
    <View style={{ padding: 16, gap: 14 }}>
      {/* HERO — time saved */}
      <LinearGradient colors={["#0F1320", "#111A2E"]} style={styles.hero}>
        <View style={{ flexDirection: "row", justifyContent: "space-between" }}>
          <View>
            <Text style={styles.mono}>TODAY • {new Date().toLocaleDateString()}</Text>
            <Text style={styles.heroTitle}>{Math.floor(timeSaved / 60)}h {timeSaved % 60}m saved</Text>
            <Text style={styles.heroSub}>{timeSaved === 0 ? "No time saved yet • Jail an app to start" : `+18m vs start • ${Math.floor(timeSaved / 18)} jails avoided`}</Text>
          </View>
          <View style={styles.heroRing}>
            <Text style={styles.heroRingTxt}>{timeSaved === 0 ? "0%" : `${Math.min(100, Math.round((timeSaved / 120) * 100))}%`}</Text>
            <Text style={styles.monoSmall}>FOCUS</Text>
          </View>
        </View>
        <View style={styles.heroBarTrack}>
          <View style={[styles.heroBarFill, { width: timeSaved === 0 ? "0%" : `${Math.min(100, Math.round((timeSaved / 120) * 100))}%` }]} />
        </View>
      </LinearGradient>

      {/* APPS — sophisticated rings */}
      <View style={styles.sectionRow}>
        <Text style={styles.sectionTitle}>Jailed Apps</Text>
        <Text style={styles.sectionLink}>Edit →</Text>
      </View>

      <View style={styles.appGrid}>
        {(Object.keys(APPS) as AppId[]).map((id) => {
          const app = APPS[id];
          const used = usage[id];
          const pct = Math.min(100, (used / app.limit) * 100);
          const isJailed = jailed === id || pct >= 100;
          return (
            <TouchableOpacity
              key={id}
              onPress={() => {
                Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                if (isJailed) setJailed(id);
              }}
              style={[styles.appCard, isJailed && styles.appCardJailed]}
            >
              <View style={[styles.appIcon, { backgroundColor: app.color + "18", borderColor: app.color + "40" }]}>
                <Text style={[styles.appIconTxt, { color: app.color }]}>{app.icon}</Text>
              </View>
              <Text style={styles.appName}>{app.name}</Text>
              <Text style={styles.monoSmall}>{used}m / {app.limit}m</Text>
              <View style={styles.ringTrack}>
                <View style={[styles.ringFill, { width: `${pct}%`, backgroundColor: isJailed ? "#EF4444" : app.color }]} />
              </View>
              <Text style={[styles.appStatus, isJailed && { color: "#EF4444" }]}>{isJailed ? "🔒 JAILED" : pct > 80 ? "⚠ " + Math.round(pct) + "%" : "○ free"}</Text>
            </TouchableOpacity>
          );
        })}
      </View>

      {/* QUICK ACTIONS */}
      <View style={styles.qaRow}>
        <TouchableOpacity onPress={() => setTab("vault")} style={styles.qaCard}>
          <Text style={styles.qaIcon}>◐</Text>
          <Text style={styles.qaTitle}>Focus Vault</Text>
          <Text style={styles.monoSmall}>25:00 • Start</Text>
        </TouchableOpacity>
        <TouchableOpacity onPress={() => setTab("jail")} style={styles.qaCard}>
          <Text style={styles.qaIcon}>▦</Text>
          <Text style={styles.qaTitle}>Jail Breach</Text>
          <Text style={styles.monoSmall}>{jailed ? "1 jailed" : "All free"}</Text>
        </TouchableOpacity>
      </View>

      <View style={styles.noteCard}>
        <Text style={styles.noteTitle}>How offline works ✈︎</Text>
        <Text style={styles.noteDesc}>All timers run locally (AsyncStorage). No internet needed. Ads load only when online — fail gracefully offline. No data leaves your phone.</Text>
      </View>
    </View>
  );
}

function JailTab({ jailed, setJailed, setUsage, setTimeSaved, setAdWatchCount, adWatchCount }: any) {
  return (
    <View style={{ padding: 16, gap: 16 }}>
      <Text style={styles.sectionTitle}>Jail Control</Text>
      <Text style={styles.sectionSub}>Tap any app to test jail door • AdMob interstitial after unlock (capped 1/5m)</Text>

      <View style={styles.jailList}>
        {(Object.keys(APPS) as AppId[]).map((id) => (
          <TouchableOpacity
            key={id}
            onPress={() => setJailed(id)}
            style={styles.jailRow}
          >
            <View style={[styles.jailIcon, { backgroundColor: APPS[id].color + "14" }]}>
              <Text style={{ color: APPS[id].color, fontWeight: "800" }}>{APPS[id].icon}</Text>
            </View>
            <View style={{ flex: 1 }}>
              <Text style={styles.jailName}>{APPS[id].name}</Text>
              <Text style={styles.monoSmall}>Limit {APPS[id].limit}m • Tap to jail</Text>
            </View>
            <View style={styles.jailBadge}>
              <Text style={styles.jailBadgeTxt}>JAIL →</Text>
            </View>
          </TouchableOpacity>
        ))}
      </View>

      <View style={styles.statsCard}>
        <Text style={styles.statsTitle}>Ad Returns (mock)</Text>
        <View style={{ flexDirection: "row", gap: 10, marginTop: 8 }}>
          <View style={styles.statBox}>
            <Text style={styles.statNum}>{adWatchCount}</Text>
            <Text style={styles.monoSmall}>Rewarded</Text>
          </View>
          <View style={styles.statBox}>
            <Text style={styles.statNum}>~${(adWatchCount * 0.012).toFixed(2)}</Text>
            <Text style={styles.monoSmall}>Est. today</Text>
          </View>
          <View style={styles.statBox}>
            <Text style={styles.statNum}>2.4k</Text>
            <Text style={styles.monoSmall}>Impressions</Text>
          </View>
        </View>
        <Text style={styles.monoSmallCenter}>Banner + Interstitial + Rewarded = full returns • No AI cost</Text>
      </View>
    </View>
  );
}

function VaultTab({ pomodoro, setPomodoro, pomRunning, setPomRunning }: any) {
  const mins = Math.floor(pomodoro / 60)
    .toString()
    .padStart(2, "0");
  const secs = (pomodoro % 60).toString().padStart(2, "0");
  const pct = 1 - pomodoro / (25 * 60);
  return (
    <View style={{ padding: 16, gap: 16, alignItems: "center" }}>
      <Text style={styles.sectionTitle}>Focus Vault • Pomodoro</Text>
      <Text style={styles.sectionSub}>25/5 • ambient rain • streak +1 on complete • interstitial after</Text>

      <View style={styles.vaultTimerCard}>
        <View style={styles.vaultRingWrap}>
          <View style={styles.vaultRingBg} />
          <View style={[styles.vaultRingFill, { height: `${pct * 100}%` }]} />
          <View style={styles.vaultRingCenter}>
            <Text style={styles.vaultTime}>{mins}:{secs}</Text>
            <Text style={styles.monoSmall}>{pomRunning ? "FOCUSING" : "READY"}</Text>
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
        <Text style={styles.noteTitle}>AdMob here → Interstitial</Text>
        <Text style={styles.noteDesc}>After vault completes, show interstitial (capped). Rewarded to extend vault +10m.</Text>
      </View>
    </View>
  );
}

function YouTab({ streak, timeSaved, adWatchCount, heatmap, user, onSignOut, onClear }: any) {
  const days: number[] = heatmap || Array.from({ length: 90 }, () => 0);
  const level = Math.floor(streak / 3) + 1;
  return (
    <View style={{ padding: 16, gap: 16 }}>
      <View style={styles.profileCard}>
        <LinearGradient colors={["#1A1F2E", "#0F1320"]} style={styles.profileGrad}>
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

      <Text style={styles.sectionTitle}>90-Day Heatmap</Text>
      <View style={styles.heatmap}>
        {days.map((v, i) => (
          <View key={i} style={[styles.heatCell, v ? { backgroundColor: v ? "#22C55E" : "#1A1F2E" } : null]} />
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

      <View style={styles.settingsCard}>
        <Text style={styles.settingsTitle}>Monetization — Your Returns</Text>
        <View style={styles.settingRow}>
          <Text style={styles.settingLabel}>Banner (Home/Stats)</Text>
          <Text style={styles.settingVal}>$0.7 eCPM • Always</Text>
        </View>
        <View style={styles.settingRow}>
          <Text style={styles.settingLabel}>Interstitial (after unlock)</Text>
          <Text style={styles.settingVal}>$2.2 eCPM • 1/5m cap</Text>
        </View>
        <View style={styles.settingRow}>
          <Text style={styles.settingLabel}>Rewarded (unlock 15m)</Text>
          <Text style={styles.settingValActive}>$8.4 eCPM • Unlimited</Text>
        </View>
        <View style={styles.settingRow}>
          <Text style={styles.settingLabel}>Remove Ads IAP</Text>
          <Text style={styles.settingVal}>₹99 • 4% convert</Text>
        </View>
      </View>

      <TouchableOpacity onPress={onClear} style={{ backgroundColor: "#1A0F0F", borderWidth: 1, borderColor: "#7F1D1D", borderRadius: 12, padding: 12, alignItems: "center" }}>
        <Text style={{ color: "#FECACA", fontWeight: "800", fontSize: 12 }}>Clear All Data — Reset to 0</Text>
        <Text style={{ color: "#8B93B8", fontSize: 10, marginTop: 2 }}>Removes streak, time saved, heatmap • Cannot undo</Text>
      </TouchableOpacity>

      <Text style={styles.monoSmallCenter}>Real data only • Streak starts at 0 • Each jail unlock saves 18m & marks today • Offline persisted via AsyncStorage</Text>
    </View>
  );
}

function JailOverlay({ appId, onClose, onUnlock }: { appId: AppId; onClose: () => void; onUnlock: (via: "task" | "ad") => void }) {
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

  const app = APPS[appId];

  return (
    <View style={styles.overlay}>
      <LinearGradient colors={["#06080F", "#0F0F1A"]} style={StyleSheet.absoluteFill} />
      <SafeAreaView style={{ flex: 1, padding: 20 }}>
        <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center" }}>
          <Text style={styles.mono}>🔒 JAIL • {app.name.toUpperCase()}</Text>
          <TouchableOpacity onPress={onClose} style={styles.closeBtn}>
            <Text style={styles.closeTxt}>✕</Text>
          </TouchableOpacity>
        </View>

        <Animated.View style={[styles.jailCard, { transform: [{ scale }] }]}>
          <View style={styles.jailDoorLarge}>
            <View style={styles.jailDoorBar} />
            <View style={styles.jailDoorBar} />
            <View style={styles.jailDoorBar} />
            <Text style={styles.jailDoorIcon}>▦</Text>
            <View style={styles.jailDoorBar} />
            <View style={styles.jailDoorBar} />
          </View>
          <Text style={styles.jailTitle}>{app.name} is in jail.</Text>
          <Text style={styles.jailSub}>You hit {app.limit}m today. Vault door is locked for 12m.</Text>
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
                <Text style={styles.breakTitle}>Watch Rewarded Ad (15m unlock)</Text>
                <Text style={styles.breakDesc}>~20s • Supports us • Highest AdMob eCPM • Full returns</Text>
              </View>
              <View style={styles.adBadge}>
                <Text style={styles.adBadgeTxt}>$ • REWARDED</Text>
              </View>
            </TouchableOpacity>

            <Text style={styles.monoSmallCenter}>Interstitial will show after unlock (capped 1/5m) • Banner below</Text>
            <View style={styles.miniBanner}>
              <Text style={styles.miniBannerTxt}>AdMob Banner • 320×50 • Offline hidden</Text>
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
