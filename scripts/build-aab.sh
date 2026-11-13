#!/usr/bin/env bash
# Builds the Play Store bundles (signed with the upload key in ~/DriveWay-PlayStore-Keys).
#   npm run build:aab            → DriveWay, DriveWay Partner (mobile/rider) and DriveWay Admin
#   npm run build:aab -- rider   → just one
# Output: mobile/dist/driveway-<app>.aab. Bump versionCode in mobile/<app>/android/app/build.gradle for every upload.
set -euo pipefail
cd "$(dirname "$0")/.."

apps=("$@"); [ ${#apps[@]} -eq 0 ] && apps=(customer rider admin)
if [ -z "${JAVA_HOME:-}" ] && [ -d "$HOME/.local/jdk21/Contents/Home" ]; then export JAVA_HOME="$HOME/.local/jdk21/Contents/Home"; fi
export ANDROID_HOME="${ANDROID_HOME:-$HOME/Library/Android/sdk}"
props="${DRIVEWAY_KEYSTORE:-$HOME/DriveWay-PlayStore-Keys/keystore.properties}"
[ -f "$props" ] || { echo "Upload key not found at $props — the Play Store needs a signed bundle." >&2; exit 1; }

bash scripts/prepare-mobile-web.sh "${apps[@]}"
mkdir -p mobile/dist
for app in "${apps[@]}"; do
  echo "── $app"
  (cd "mobile/$app" && npx cap sync android)
  (cd "mobile/$app/android" && ./gradlew bundleRelease --quiet)
  cp "mobile/$app/android/app/build/outputs/bundle/release/app-release.aab" "mobile/dist/driveway-$app.aab"
  echo "✓ mobile/dist/driveway-$app.aab"
done
