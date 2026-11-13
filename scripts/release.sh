#!/usr/bin/env bash
# Everything to hand out, in a tidy mobile/dist:
#   DriveWay.apk          customer app, release-signed
#   DriveWay-Partner.apk  partner (rider / driver) app, release-signed
#   DriveWay-Admin.apk    admin app (debug build, not for the Play Store)
#   PlayStore/DriveWay/          DriveWay.aab + listing, icon, feature graphic, screenshots (store/play-driveway)
#   PlayStore/DriveWay-Partner/  DriveWay-Partner.aab + the same for the partner app (store/play-partner)
# Needs the upload key in ~/DriveWay-PlayStore-Keys. Bump versionCode before each Play upload.
set -euo pipefail
cd "$(dirname "$0")/.."
if [ -z "${JAVA_HOME:-}" ] && [ -d "$HOME/.local/jdk21/Contents/Home" ]; then export JAVA_HOME="$HOME/.local/jdk21/Contents/Home"; fi
export ANDROID_HOME="${ANDROID_HOME:-$HOME/Library/Android/sdk}"
props="${DRIVEWAY_KEYSTORE:-$HOME/DriveWay-PlayStore-Keys/keystore.properties}"
[ -f "$props" ] || { echo "Upload key not found at $props" >&2; exit 1; }

bash scripts/prepare-mobile-web.sh customer rider admin
for app in customer rider admin; do (cd "mobile/$app" && npx cap sync android); done
(cd mobile/customer/android && ./gradlew assembleRelease bundleRelease --quiet)
(cd mobile/rider/android && ./gradlew assembleRelease bundleRelease --quiet)
(cd mobile/admin/android && ./gradlew assembleDebug --quiet)

out=mobile/dist; rel=app/build/outputs
rm -rf "$out" && mkdir -p "$out/PlayStore"
cp mobile/customer/android/$rel/apk/release/app-release.apk "$out/DriveWay.apk"
cp mobile/rider/android/$rel/apk/release/app-release.apk "$out/DriveWay-Partner.apk"
cp mobile/admin/android/$rel/apk/debug/app-debug.apk "$out/DriveWay-Admin.apk"
cp -R store/play-driveway "$out/PlayStore/DriveWay"
cp -R store/play-partner "$out/PlayStore/DriveWay-Partner"
cp mobile/customer/android/$rel/bundle/release/app-release.aab "$out/PlayStore/DriveWay/DriveWay.aab"
cp mobile/rider/android/$rel/bundle/release/app-release.aab "$out/PlayStore/DriveWay-Partner/DriveWay-Partner.aab"
cp mobile/dist-readme.txt "$out/PEHLE-YE-PADHO.txt"
echo "✓ $out: DriveWay.apk, DriveWay-Partner.apk, DriveWay-Admin.apk, PlayStore/DriveWay, PlayStore/DriveWay-Partner"
