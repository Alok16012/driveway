#!/usr/bin/env bash
# One command for everything to hand out, in a tidy mobile/dist:
#   DriveWay.apk        customer + rider app, release-signed (install on phones)
#   DriveWay-Admin.apk  admin app (debug build, not for the Play Store)
#   PlayStore/          DriveWay.aab + icon, feature graphic, screenshots, listing (store/play-driveway)
# Needs the upload key in ~/DriveWay-PlayStore-Keys. Bump versionCode before each Play upload.
set -euo pipefail
cd "$(dirname "$0")/.."
if [ -z "${JAVA_HOME:-}" ] && [ -d "$HOME/.local/jdk21/Contents/Home" ]; then export JAVA_HOME="$HOME/.local/jdk21/Contents/Home"; fi
export ANDROID_HOME="${ANDROID_HOME:-$HOME/Library/Android/sdk}"
props="${DRIVEWAY_KEYSTORE:-$HOME/DriveWay-PlayStore-Keys/keystore.properties}"
[ -f "$props" ] || { echo "Upload key not found at $props" >&2; exit 1; }

bash scripts/prepare-mobile-web.sh customer admin
(cd mobile/customer && npx cap sync android)
(cd mobile/admin && npx cap sync android)
(cd mobile/customer/android && ./gradlew assembleRelease bundleRelease --quiet)
(cd mobile/admin/android && ./gradlew assembleDebug --quiet)

rm -rf mobile/dist && mkdir -p mobile/dist
cp mobile/customer/android/app/build/outputs/apk/release/app-release.apk mobile/dist/DriveWay.apk
cp mobile/admin/android/app/build/outputs/apk/debug/app-debug.apk mobile/dist/DriveWay-Admin.apk
cp -R store/play-driveway mobile/dist/PlayStore
cp mobile/customer/android/app/build/outputs/bundle/release/app-release.aab mobile/dist/PlayStore/DriveWay.aab
cp mobile/dist-readme.txt mobile/dist/PEHLE-YE-PADHO.txt
echo "✓ mobile/dist: DriveWay.apk, DriveWay-Admin.apk, PlayStore/"
