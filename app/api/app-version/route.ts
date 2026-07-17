import { NextResponse } from "next/server";
import { getMobileAppVersionConfig } from "@/lib/mobile-app-version";

/** Public — mobile clients poll this to decide OTA vs App Store update. */
export async function GET() {
  return NextResponse.json(
    {
      ...getMobileAppVersionConfig(),
      // Helps clients correlate with expo.version / runtimeVersion.
      schemaVersion: 1,
    },
    {
      headers: {
        "Cache-Control": "public, max-age=60, stale-while-revalidate=300",
      },
    },
  );
}
