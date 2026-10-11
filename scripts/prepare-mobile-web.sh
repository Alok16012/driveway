#!/usr/bin/env bash
# Static-exports the site (cross-app links hidden) and copies it into mobile/<app>/www for each app given.
# Every extensionless path is served from www/index.html and each app starts at / (customer) or /<app>,
# so index.html must be that app's page for the URL and the rendered route to match.
# Supabase URL + anon key come from .env.local at build time.
set -euo pipefail
cd "$(dirname "$0")/.."

NEXT_PUBLIC_NATIVE_APP=1 npx next build
for app in "$@"; do
  rm -rf "mobile/$app/www" && mkdir -p "mobile/$app/www"
  cp -R out/. "mobile/$app/www/"
  # The customer app is the site root (out/index.html already); other apps start at /<app>.
  [ "$app" = customer ] || cp "out/$app.html" "mobile/$app/www/index.html"
done
