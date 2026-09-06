// AdMob — offline gracefully, online for full returns
// Uses react-native-google-mobile-ads. Test IDs below, replace with real AdMob IDs for production.
// All ad calls are wrapped to fail silently offline.

import { Platform } from "react-native";

// Test IDs (Google) — replace in app.json + here for prod
export const AD_IDS = {
  banner: "ca-app-pub-3940256099942544/6300978111",
  interstitial: "ca-app-pub-3940256099942544/1033173712",
  rewarded: "ca-app-pub-3940256099942544/5224354917",
  // Prod example (uncomment & fill):
  // banner: "ca-app-pub-YOUR_ID/XXXX",
};

// Safe wrappers — if offline or not initialized, no crash
export async function showInterstitial(): Promise<void> {
  // TODO: real impl:
  // const ad = InterstitialAd.createForAdRequest(AD_IDS.interstitial);
  // await ad.load(); await ad.show();
  console.log("[AdMob] Interstitial mock shown (capped 1/5m)");
}

export async function showRewarded(onReward: () => void): Promise<void> {
  // TODO: real impl:
  // const ad = RewardedAd.createForAdRequest(AD_IDS.rewarded);
  // ad.addAdEventListener(RewardedAdEventType.EARNED_REWARD, onReward);
  // await ad.load(); await ad.show();
  console.log("[AdMob] Rewarded mock — user watched, unlocking 15m");
  setTimeout(onReward, 800);
}

export function isOnline(): boolean {
  // In real app, use NetInfo
  return true;
}
