/**
 * RevenueCat integration — single source of truth for purchases.
 *
 * Configured at module top level (NOT inside a component/useEffect) per the
 * RevenueCat RN guidance. This avoids re-configuring on every render.
 *
 * Three stores are wired:
 *  - Test Store   → EXPO_PUBLIC_REVENUECAT_TEST_API_KEY    (web preview / __DEV__)
 *  - iOS App Store → EXPO_PUBLIC_REVENUECAT_IOS_API_KEY     (production iOS)
 *  - Play Store   → EXPO_PUBLIC_REVENUECAT_ANDROID_API_KEY (production Android)
 *
 * Products (in the current offering, all attached to the "ChipIn Pro" entitlement):
 *  - $rc_weekly  → Weekend Pass ($6.99/wk, no trial)
 *  - $rc_monthly → Monthly Pro ($14.99/mo, 3-day free trial)
 *  - $rc_annual  → Annual Masterclass ($69.99/yr, best value)
 *  - credits_100_1dollar → $1 consumable credit pack
 */
import { Platform } from "react-native";
import Purchases from "react-native-purchases";

const TEST_KEY = process.env.EXPO_PUBLIC_REVENUECAT_TEST_API_KEY;
const IOS_KEY = process.env.EXPO_PUBLIC_REVENUECAT_IOS_API_KEY;
const ANDROID_KEY = process.env.EXPO_PUBLIC_REVENUECAT_ANDROID_API_KEY;

/** Pick the right RevenueCat public API key for the current platform/build. */
export function getRCToken(): string | undefined {
  if (__DEV__ || Platform.OS === "web") {
    return TEST_KEY;
  }
  return Platform.select<string | undefined>({
    ios: IOS_KEY,
    android: ANDROID_KEY,
    default: TEST_KEY,
  });
}

let configured = false;

/** Configure RevenueCat once at module load. Safe to call repeatedly — no-ops after first. */
export function configurePurchases(): void {
  if (configured) return;
  const apiKey = getRCToken();
  if (!apiKey) {
    // No key available — purchases will simply be unavailable. Fail soft.
    return;
  }
  try {
    Purchases.configure({ apiKey });
    configured = true;
  } catch {
    // Web/preview sometimes throws on first load — swallow and let queries fail soft.
    configured = false;
  }
}

// Configure immediately at module import (top-level, per RN guidance).
configurePurchases();

/** True if RevenueCat was successfully configured (i.e. a key was present). */
export function isPurchasesConfigured(): boolean {
  return configured;
}

/** Fetch the current offering's packages for the paywall. */
export async function fetchOfferings() {
  if (!configured) return null;
  const offerings = await Purchases.getOfferings();
  return offerings.current ?? null;
}

/** Fetch customer info to check the Pro entitlement. */
export async function fetchCustomerInfo() {
  if (!configured) return null;
  return Purchases.getCustomerInfo();
}

/** Whether the customer currently has the "ChipIn Pro" entitlement active. */
export function hasProEntitlement(info: Awaited<ReturnType<typeof fetchCustomerInfo>>): boolean {
  if (!info) return false;
  return info.entitlements.active["ChipIn Pro"] != null;
}

export type PurchaseResult =
  | { ok: true; info: Awaited<ReturnType<typeof fetchCustomerInfo>> }
  | { ok: false; cancelled: boolean; error: string };

/** Attempt to purchase a package by its identifier (e.g. "$rc_annual"). */
export async function purchasePackageById(packageId: string): Promise<PurchaseResult> {
  if (!configured) {
    return { ok: false, cancelled: false, error: "Purchases are not available right now." };
  }
  const current = await fetchOfferings();
  if (!current) {
    return { ok: false, cancelled: false, error: "Couldn't load plans. Try again in a sec." };
  }
  const pkg = current.availablePackages.find((p) => p.identifier === packageId);
  if (!pkg) {
    return { ok: false, cancelled: false, error: "That plan isn't available. Pick another?" };
  }
  try {
    const { customerInfo } = await Purchases.purchasePackage(pkg);
    return { ok: true, info: customerInfo };
  } catch (err: unknown) {
    const e = err as { userCancelled?: boolean; message?: string };
    if (e?.userCancelled) {
      return { ok: false, cancelled: true, error: "Cancelled" };
    }
    return { ok: false, cancelled: false, error: e?.message ?? "Purchase failed. Try again." };
  }
}

/** Restore previous purchases — required by App Store review. */
export async function restorePurchases(): Promise<PurchaseResult> {
  if (!configured) {
    return { ok: false, cancelled: false, error: "Purchases are not available right now." };
  }
  try {
    const info = await Purchases.restorePurchases();
    if (hasProEntitlement(info)) {
      return { ok: true, info };
    }
    return { ok: false, cancelled: true, error: "No active purchases to restore." };
  } catch (err: unknown) {
    const e = err as { message?: string };
    return { ok: false, cancelled: false, error: e?.message ?? "Restore failed. Try again." };
  }
}
