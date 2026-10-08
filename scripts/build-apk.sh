#!/usr/bin/env bash
# Builds the Android apps: DriveWay (customer) and DriveWay Rider.
#   npm run build:apk            → both apps
#   npm run build:apk -- rider   → just one
# Output: mobile/dist/driveway-<app>.apk (debug-signed, installable for testing).
# Needs JDK 21 (JAVA_HOME, or ~/.local/jdk21) and the Android SDK (ANDROID_HOME, or ~/Library/Android/sdk).
set -euo pipefail
cd "$(dirname "$0")/.."

apps=("$@"); [ ${#apps[@]} -eq 0 ] && apps=(customer rider)

if [ -z "${JAVA_HOME:-}" ] && [ -d "$HOME/.local/jdk21/Contents/Home" ]; then export JAVA_HOME="$HOME/.local/jdk21/Contents/Home"; fi
export ANDROID_HOME="${ANDROID_HOME:-$HOME/Library/Android/sdk}"

bash scripts/prepare-mobile-web.sh "${apps[@]}"
mkdir -p mobile/dist
for app in "${apps[@]}"; do
  echo "── $app"
  (cd "mobile/$app" && npx cap sync android)
  (cd "mobile/$app/android" && ./gradlew assembleDebug --quiet)
  cp "mobile/$app/android/app/build/outputs/apk/debug/app-debug.apk" "mobile/dist/driveway-$app.apk"
  echo "✓ mobile/dist/driveway-$app.apk"
done
