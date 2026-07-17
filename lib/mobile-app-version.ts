/**
 * Mobile native version gates — bump when shipping a store build that
 * older binaries must update to (minVersion), or to advertise a soft update
 * (latestVersion). OTA JS updates use the same runtimeVersion as expo.version
 * and do not change these numbers.
 *
 * Override via env without code change if needed:
 *   MOBILE_IOS_MIN_VERSION, MOBILE_IOS_LATEST_VERSION, MOBILE_IOS_STORE_URL
 *   MOBILE_ANDROID_MIN_VERSION, MOBILE_ANDROID_LATEST_VERSION, MOBILE_ANDROID_STORE_URL
 */
export type MobilePlatformVersion = {
  minVersion: string;
  latestVersion: string;
  /** App Store / Play Store listing URL. Empty until the listing exists. */
  storeUrl: string;
};

export type MobileAppVersionConfig = {
  ios: MobilePlatformVersion;
  android: MobilePlatformVersion;
};

const defaults: MobileAppVersionConfig = {
  ios: {
    minVersion: "1.0.0",
    latestVersion: "1.0.0",
    // Fill in after App Store Connect app is created (ascAppId → store URL).
    storeUrl: "",
  },
  android: {
    minVersion: "1.0.0",
    latestVersion: "1.0.0",
    storeUrl:
      "https://play.google.com/store/apps/details?id=com.davidtapestry.graider_mobile",
  },
};

function envOr(key: string, fallback: string): string {
  const value = process.env[key]?.trim();
  return value || fallback;
}

export function getMobileAppVersionConfig(): MobileAppVersionConfig {
  return {
    ios: {
      minVersion: envOr("MOBILE_IOS_MIN_VERSION", defaults.ios.minVersion),
      latestVersion: envOr("MOBILE_IOS_LATEST_VERSION", defaults.ios.latestVersion),
      storeUrl: envOr("MOBILE_IOS_STORE_URL", defaults.ios.storeUrl),
    },
    android: {
      minVersion: envOr("MOBILE_ANDROID_MIN_VERSION", defaults.android.minVersion),
      latestVersion: envOr(
        "MOBILE_ANDROID_LATEST_VERSION",
        defaults.android.latestVersion,
      ),
      storeUrl: envOr("MOBILE_ANDROID_STORE_URL", defaults.android.storeUrl),
    },
  };
}
