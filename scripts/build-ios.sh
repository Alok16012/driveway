#!/usr/bin/env bash
# Builds the iOS apps: DriveWay (customer) and DriveWay Rider.
#   npm run build:ios            → both apps
#   npm run build:ios -- rider   → just one
# Without APPLE_TEAM_ID: a simulator build, mobile/dist/driveway-<app>-simulator.app (drag onto a running Simulator).
# With APPLE_TEAM_ID=<10-char team id>: a signed mobile/dist/driveway-<app>.ipa for installing on registered
# iPhones (IOS_EXPORT_METHOD defaults to release-testing; use app-store-connect for TestFlight/App Store).
# Signing needs that team's Apple account signed in to Xcode (Settings → Accounts).
set -euo pipefail
cd "$(dirname "$0")/.."

apps=("$@"); [ ${#apps[@]} -eq 0 ] && apps=(customer rider)
team="${APPLE_TEAM_ID:-}"
build=mobile/ios-build

bash scripts/prepare-mobile-web.sh "${apps[@]}"
mkdir -p mobile/dist
for app in "${apps[@]}"; do
  echo "── $app"
  (cd "mobile/$app" && npx cap sync ios)
  proj="mobile/$app/ios/App/App.xcodeproj"
  if [ -z "$team" ]; then
    xcodebuild -project "$proj" -scheme App -configuration Debug -sdk iphonesimulator \
      -destination 'generic/platform=iOS Simulator' -derivedDataPath "$build/$app" -quiet build
    rm -rf "mobile/dist/driveway-$app-simulator.app"
    cp -R "$build/$app/Build/Products/Debug-iphonesimulator/App.app" "mobile/dist/driveway-$app-simulator.app"
    echo "✓ mobile/dist/driveway-$app-simulator.app"
  else
    xcodebuild -project "$proj" -scheme App -configuration Release -destination 'generic/platform=iOS' \
      -archivePath "$build/$app.xcarchive" -allowProvisioningUpdates DEVELOPMENT_TEAM="$team" CODE_SIGN_STYLE=Automatic -quiet archive
    cat > "$build/export-$app.plist" <<PLIST
<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0"><dict>
  <key>method</key><string>${IOS_EXPORT_METHOD:-release-testing}</string>
  <key>teamID</key><string>$team</string>
  <key>signingStyle</key><string>automatic</string>
</dict></plist>
PLIST
    xcodebuild -exportArchive -archivePath "$build/$app.xcarchive" -exportOptionsPlist "$build/export-$app.plist" \
      -exportPath "$build/$app-export" -allowProvisioningUpdates -quiet
    cp "$build/$app-export/App.ipa" "mobile/dist/driveway-$app.ipa"
    echo "✓ mobile/dist/driveway-$app.ipa"
  fi
done
