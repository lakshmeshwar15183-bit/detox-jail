# DON'T — Screen Jail (Play Store Ready AAB)

> Your apps go to jail so you can go free. Premium dark UI, offline-first, AdMob monetized.

**Package:** `com.dont.jail`  **Version:** 1.0.0  **SDK:** Expo 57  **Build:** AAB

### Offline for people, Online for returns
- **Offline:** Jail, timers, streak, heatmap, Focus Vault — all AsyncStorage, works airplane mode.
- **Online:** AdMob banner/interstitial/rewarded + IAP. Fails gracefully offline.

### Sophisticated UI
Dark premium (#06080F), Space Grotesk + IBM Plex Mono, Jail-door spring animation, haptics, glass nav. 4 tabs: Today / Jail / Vault / You + 3-screen onboarding. 60fps.

### Ad Returns (0 cost)
- Banner Home/Stats ($0.7 eCPM)
- Interstitial after unlock ($2.2 eCPM, 1/5m cap)
- Rewarded 15m unlock ($8.4 eCPM, unlimited) ← goldmine
- IAP Remove Ads ₹99

### Run
```bash
npm install
npx expo start           # Expo Go
npx expo prebuild --clean
```

### Build AAB (Play Store)
```bash
npm i -g eas-cli
eas login
eas build --platform android --profile production   # → .aab (store)
eas build --platform android --profile preview      # → .apk (test)

# After build
eas submit --platform android   # or upload .aab manually to Play Console
```

### Replace AdMob IDs
1. Create AdMob app → get `androidAppId` / `iosAppId` → put in `app.json` plugins[react-native-google-mobile-ads]
2. Replace banner/interstitial/rewarded IDs in `src/ads/adMob.ts`
3. `npx expo prebuild --clean && eas build`

### Play Store Checklist
- Icon 512x512 (assets/icon.png) ✓
- Adaptive icon (assets/adaptive-icon.png) ✓
- Splash (assets/splash.png) ✓
- Feature graphic 1024x500 (generate from Figma)
- Screenshots 2x phone (use Expo screenshot)
- Data Safety: No data collected (AdMob declared), Encryption yes, Ads yes
- Content rating: Everyone, Contains ads
- Privacy Policy: PRIVACY.md (host on Notion/GitHub Pages)

### Location
`/var/folders/_9/w0f85fv10494qtdm7v8p5k_80000gn/T/opencode/dont`
Move to `~/dont` when ready: `cp -r /var/folders/.../T/opencode/dont ~/dont`

