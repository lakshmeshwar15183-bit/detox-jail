import { NativeModules, Platform } from "react-native";

const { UsageStatsModule, OverlayModule } = NativeModules as any;

export async function isUsageAccessGranted(): Promise<boolean> {
  if (Platform.OS !== "android") return true;
  if (!UsageStatsModule) return false;
  try {
    return await UsageStatsModule.isUsageAccessGranted();
  } catch {
    return false;
  }
}

export async function getForegroundApp(): Promise<string | null> {
  if (Platform.OS !== "android" || !UsageStatsModule) return null;
  try {
    return await UsageStatsModule.getForegroundApp();
  } catch {
    return null;
  }
}

export async function getAppUsage(packageName: string): Promise<number> {
  if (Platform.OS !== "android" || !UsageStatsModule) return 0;
  try {
    const v = await UsageStatsModule.getAppUsage(packageName);
    return typeof v === "number" ? v : 0;
  } catch {
    return 0;
  }
}

export async function canDrawOverlays(): Promise<boolean> {
  if (Platform.OS !== "android" || !OverlayModule) return true;
  try {
    return await OverlayModule.canDrawOverlays();
  } catch {
    return false;
  }
}

export async function requestOverlayPermission(): Promise<boolean> {
  if (Platform.OS !== "android" || !OverlayModule) return true;
  try {
    return await OverlayModule.requestOverlayPermission();
  } catch {
    return false;
  }
}

export async function showOverlay(appName: string): Promise<boolean> {
  if (Platform.OS !== "android" || !OverlayModule) return false;
  try {
    return await OverlayModule.showOverlay(appName);
  } catch {
    return false;
  }
}

export async function hideOverlay(): Promise<boolean> {
  if (Platform.OS !== "android" || !OverlayModule) return true;
  try {
    return await OverlayModule.hideOverlay();
  } catch {
    return false;
  }
}

export async function isOverlayShowing(): Promise<boolean> {
  if (Platform.OS !== "android" || !OverlayModule) return false;
  try {
    return await OverlayModule.isShowing();
  } catch {
    return false;
  }
}
