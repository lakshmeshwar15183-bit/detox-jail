# DON'T — Screen Jail | Play Store Ready Plan (10000%)

> **Tagline:** Your apps go to jail so you can go free.
> **Package:** `com.dont.jail` | **Version:** 1.0.0 | **Expo SDK:** 57 | **Build:** AAB (Play Store)

## 1. Vision (sophisticated, everyone needs)
Every human wastes 3-5h/day doom-scrolling. Willpower apps fail because they are boring/punitive. DON'T is **premium, playful, powerful** — like Apple Screen Time meets Duolingo streaks meets jail aesthetic. Feels expensive, works offline, monetizes online.

## 2. Core Principles
- **Offline-first:** All jail logic (timers, locks, stats) = AsyncStorage + local UsageStats mock → works airplane mode.
- **Online-for-returns:** AdMob (banner/interstitial/rewarded) + remote config (optional) load when online, fail gracefully offline.
- **Sophisticated UI:** Dark premium, glassmorphism, SF Pro/Geist fonts, haptics, 60fps animations, jail-door micro-interactions. No cheap gradients.
- **0 server cost:** No backend, no user auth needed for MVP. Later: Supabase optional for backup.

## 3. Features (MVP Play Store ready)

### Offline Core (100% local)
- **App Jail:** Pick 3-6 apps (IG, YT, X, Reddit) → set daily jail time (e.g., IG 30m). Mock UsageStats (real UsageStatsManager plugin ready for prod).
- **Jail Door:** When limit hit → full-screen jail (vault door animation, countdown, "BREAK OUT?" CTA).
- **Breakout Choices:** (a) Do Task (10 pushups / clean desk / 1-min breathing) OR (b) Watch Rewarded Ad (15m unlock) — user chooses, no forced ads.
- **Focus Vault:** Pomodoro 25/5 with ambient (rain/lofi) + streak.
- **Stats:** Heatmap (90 days), time saved, unlocks avoided, streak (GitHub-style).
- **Streak & Levels:** Level 1 Prisoner → Level 50 Warden. Revive streak via rewarded ad (monetization loop).

### Online Layer (AdMob + growth)
- **Banner:** Home & Stats (bottom, 320x50, adaptive).
- **Interstitial:** After jail break / focus session (frequency cap 1/5min).
- **Rewarded:** Unlock 15m, revive streak, unlock ambient pack. Highest eCPM ($5-12).
- **Remote:** Firebase Remote Config for ad frequency without update (optional).

## 4. Sophisticated UI System
- **Colors:** bg #06080F, card #0F1320, border #1A1F2E, accent #60A5FA, success #22C55E, warn #F59E0B, jail-red #EF4444. Glass: backdrop-blur.
- **Typography:** Space Grotesk (display) + IBM Plex Mono (mono stats). 12/14/18/28/36 scale.
- **Motion:** Jail door spring (react-native-reanimated), haptics on lock/unlock, confetti on streak.
- **Icons:** @expo/vector-icons (Ionicons) + custom jail SVG.
- **Layout:** 4 tabs (Today / Jail / Vault / You) + onboarding (3 screens). SafeArea + notch.

## 5. Tech Stack (0 cost, AAB ready)
```
Expo SDK 57, React 19, RN 0.86
@react-native-async-storage/async-storage (offline)
expo-haptics, expo-linear-gradient, expo-font, expo-secure-store
react-native-safe-area-context
react-native-google-mobile-ads (AdMob) — plugin in app.json
expo-build-properties (for UsageStats permission)
```
No AI APIs, no server → $0/month.

## 6. AdMob Strategy (full returns)
| Placement | When | eCPM | Cap |
|-----------|------|------|-----|
| Banner | Home/Stats always | $0.5-1 | — |
| Interstitial | After unlock / focus end | $1.5-3 | 1 per 5 min |
| Rewarded | Unlock 15m / revive streak | $5-12 | unlimited (user-initiated) |
| IAP | Remove Ads ₹99 / Pro ₹199/yr | — | — |
Avg user: 3 rewarded + 2 interstitial + banner = ~$0.04-0.07/day → 10k DAU = $400-700/day.

## 7. Play Store Checklist (10000%)
- [x] app.json: name, package `com.dont.jail`, versionCode 1, adaptive icon, permissions (PACKAGE_USAGE_STATS, QUERY_ALL_PACKAGES hint)
- [x] eas.json: production → aab, preview → apk
- [x] Privacy Policy (generated), Data Safety: No data collected (AdMob self-declared)
- [x] Assets: 512x512 icon, 1024x500 feature graphic, 2 phone screenshots (built-in)
- [x] Content rating: Everyone, no ads? Actually "Contains ads" checked
- [ ] Build: `eas build --platform android --profile production` → .aab
- [ ] Play Console: upload .aab, complete Data Safety + Ads declaration

## 8. File Structure
```
dont/
  app.json
  eas.json
  package.json
  App.tsx (root + nav)
  src/
    screens/Onboarding, Home, Jail, Vault, Stats, Settings
    components/JailDoor, Ring, Heatmap, AdBannerMock
    store/useStore.ts (AsyncStorage)
    ads/adMob.ts (mock + real toggle)
  assets/icon.png, adaptive-icon.png, splash.png
  PLAN.md (this)
```

## 9. Build Commands
```bash
npm install
npx expo prebuild --clean   # generates android folder
eas build --platform android --profile production   # → .aab
eas build --platform android --profile preview      # → .apk for testing
```

## 10. Next Steps (after your approval)
1. Scaffold files (this plan → done)
2. Implement UI (dark premium)
3. Wire AdMob mocks (toggle to real IDs)
4. Test on Expo Go + build AAB
