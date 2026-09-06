// DON'T store — offline-first (AsyncStorage-ready)
// All core logic runs offline. No server. 0 cost.

import AsyncStorage from "@react-native-async-storage/async-storage";

export type JailConfig = {
  apps: Record<string, { limitMin: number; usedMin: number; jailed: boolean }>;
  streak: number;
  timeSavedMin: number;
  level: number;
};

const KEY = "dont_jail_v1";

export async function load(): Promise<JailConfig | null> {
  const raw = await AsyncStorage.getItem(KEY);
  return raw ? JSON.parse(raw) : null;
}

export async function save(cfg: JailConfig) {
  await AsyncStorage.setItem(KEY, JSON.stringify(cfg));
}

// Mock UsageStats for demo (real: native module UsageStatsManager)
// In production, replace with `react-native-usage-stats` or custom native module
export function mockTick(cfg: JailConfig): JailConfig {
  const next = JSON.parse(JSON.stringify(cfg)) as JailConfig;
  for (const k of Object.keys(next.apps)) {
    if (Math.random() < 0.3) next.apps[k].usedMin += 1;
    if (next.apps[k].usedMin >= next.apps[k].limitMin) next.apps[k].jailed = true;
  }
  return next;
}
