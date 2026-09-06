// DON'T store — offline-first (AsyncStorage-ready)
// All core logic runs offline. No server. 0 cost.

import AsyncStorage from "@react-native-async-storage/async-storage";

export type JailConfig = {
  apps: Record<string, { limitMin: number; usedMin: number; jailed: boolean }>;
  streak: number;
  timeSavedMin: number;
  level: number;
  adWatchCount: number;
  heatmap: number[]; // 90 days, 0=free 1=jailed
};

const KEY = "dont_jail_v1";

export const defaultConfig = (limits: Record<string, number>): JailConfig => ({
  apps: Object.fromEntries(Object.entries(limits).map(([k, v]) => [k, { limitMin: v, usedMin: 0, jailed: false }])),
  streak: 0,
  timeSavedMin: 0,
  level: 1,
  adWatchCount: 0,
  heatmap: Array.from({ length: 90 }, () => 0),
});

export async function load(): Promise<JailConfig | null> {
  const raw = await AsyncStorage.getItem(KEY);
  if (!raw) return null;
  try {
    const cfg = JSON.parse(raw) as JailConfig;
    // migrate old configs missing fields
    if (!cfg.heatmap || cfg.heatmap.length !== 90) cfg.heatmap = Array.from({ length: 90 }, () => 0);
    if (cfg.adWatchCount === undefined) cfg.adWatchCount = 0;
    if (cfg.streak === undefined) cfg.streak = 0;
    if (cfg.timeSavedMin === undefined) cfg.timeSavedMin = 0;
    return cfg;
  } catch {
    return null;
  }
}

export async function save(cfg: JailConfig) {
  await AsyncStorage.setItem(KEY, JSON.stringify(cfg));
}

export async function clear() {
  await AsyncStorage.removeItem(KEY);
}

// Real data helper — mark today as jailed day in heatmap
export function markToday(heatmap: number[]): number[] {
  const next = [...heatmap];
  next[89] = 1;
  return next;
}
