#!/usr/bin/env node
/**
 * Patches the iOS asset catalog after `tauri icon` to add iOS 18
 * dark and tinted icon variants using the modern universal format.
 *
 * `tauri icon` generates a legacy per-device Contents.json that
 * doesn't support dark/tinted appearances. This script replaces it
 * with the single-size universal format and copies the dark/tinted
 * source PNGs into the asset catalog.
 */

import { copyFileSync, writeFileSync, existsSync, mkdirSync } from "fs";
import { join } from "path";

const APPICONSET = join(
  "src-tauri",
  "gen",
  "apple",
  "Assets.xcassets",
  "AppIcon.appiconset",
);

const IOS_ICONS_SRC = join("src-tauri", "icons", "ios");

const CONTENTS = {
  images: [
    {
      filename: "AppIcon-512@2x.png",
      idiom: "universal",
      platform: "ios",
      size: "1024x1024",
    },
    {
      appearances: [{ appearance: "luminosity", value: "dark" }],
      filename: "AppIcon-dark.png",
      idiom: "universal",
      platform: "ios",
      size: "1024x1024",
    },
    {
      appearances: [{ appearance: "luminosity", value: "tinted" }],
      filename: "AppIcon-tinted.png",
      idiom: "universal",
      platform: "ios",
      size: "1024x1024",
    },
  ],
  info: { version: 1, author: "xcode" },
};

if (!existsSync(APPICONSET)) {
  console.error(
    `Asset catalog not found at ${APPICONSET}. Run \`tauri ios init\` first.`,
  );
  process.exit(1);
}

for (const name of ["AppIcon-dark.png", "AppIcon-tinted.png"]) {
  const src = join(IOS_ICONS_SRC, name);
  if (!existsSync(src)) {
    console.error(`Missing source icon: ${src}`);
    process.exit(1);
  }
  copyFileSync(src, join(APPICONSET, name));
  console.log(`  Copied ${name}`);
}

writeFileSync(
  join(APPICONSET, "Contents.json"),
  JSON.stringify(CONTENTS, null, 2) + "\n",
);
console.log("  Patched Contents.json with iOS 18 dark/tinted entries");
