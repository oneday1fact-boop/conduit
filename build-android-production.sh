#!/bin/bash
set -euo pipefail

cd "$(dirname "$0")"

SOURCE="admob-bridge-src.js"
BUNDLE="www/admob-bridge.js"
BACKUP="$(mktemp)"
TEMP_SOURCE=".admob-bridge-production-temp.js"
SYNCED=0
BACKED_UP=0

cleanup() {
  status=$?
  trap - EXIT

  if [ "$BACKED_UP" = "1" ] && ! cp "$BACKUP" "$BUNDLE"; then
    echo "ERROR: Could not restore the development ad bundle."
    status=1
  fi

  if [ "$SYNCED" = "1" ]; then
    echo "Restoring Android project to the test-ad bundle..."
    if ! npx cap sync android; then
      echo "ERROR: Android sync restoration failed."
      status=1
    fi
  fi

  rm -f "$BACKUP" "$TEMP_SOURCE"
  exit "$status"
}
trap cleanup EXIT

if [ ! -f "$SOURCE" ] || [ ! -f "$BUNDLE" ]; then
  echo "ERROR: Required source or bundle is missing."
  exit 1
fi

if [ ! -f "$HOME/.conduit-signing/key.properties" ] ||
   [ ! -f "$HOME/.conduit-signing/conduit-upload.jks" ]; then
  echo "ERROR: Signing properties or keystore is missing."
  exit 1
fi

node scripts/check-release-config.cjs

cp "$BUNDLE" "$BACKUP"
BACKED_UP=1

echo "Preparing temporary production ad source..."
node - "$SOURCE" "$TEMP_SOURCE" <<'NODE'
const fs = require('fs');
const [sourcePath, outputPath] = process.argv.slice(2);
let source = fs.readFileSync(sourcePath, 'utf8');

function replaceOnce(regex, replacement, label) {
  const matches = source.match(regex) || [];
  if (matches.length !== 1) {
    console.error(`ERROR: Expected exactly one match for ${label}; found ${matches.length}.`);
    process.exit(1);
  }
  source = source.replace(regex, replacement);
}

replaceOnce(
  /const USE_TEST_ADS = true;/,
  'const USE_TEST_ADS = false;',
  'test mode setting'
);

replaceOnce(
  /initializeForTesting:\s*true\s*,/,
  '',
  'test initialization'
);

replaceOnce(
  /,\s*isTesting:\s*true\b/,
  '',
  'test ad request flag'
);

if (
  source.includes('const USE_TEST_ADS = true;') ||
  source.includes('initializeForTesting: true') ||
  source.includes('isTesting: true') ||
  !source.includes('ca-app-pub-9967525901358281/7914292147') ||
  !source.includes('ca-app-pub-3940256099942544/1712485313')
) {
  console.error('ERROR: Production source validation failed.');
  process.exit(1);
}

fs.writeFileSync(outputPath, source);
console.log('PASS: Production source checks.');
NODE

echo "Building temporary production ad bundle..."
./node_modules/.bin/esbuild "$TEMP_SOURCE" \
  --bundle --platform=browser --format=iife \
  --outfile="$BUNDLE"

node --check "$BUNDLE"

echo "Checking production bundle..."
if grep -q 'initializeForTesting: true' "$BUNDLE" ||
   grep -q 'isTesting: true' "$BUNDLE"; then
  echo "ERROR: Test settings remain in the production bundle."
  exit 1
fi

if ! grep -q 'ca-app-pub-9967525901358281/7914292147' "$BUNDLE"; then
  echo "ERROR: Live Android rewarded ad unit is missing."
  exit 1
fi

echo "Syncing production assets to Android..."
SYNCED=1
npx cap sync android

echo "Building signed Android App Bundle..."
(
  cd android
  bash ./gradlew :app:bundleRelease
)

AAB="android/app/build/outputs/bundle/release/app-release.aab"
if [ ! -f "$AAB" ]; then
  echo "ERROR: Expected App Bundle was not found."
  exit 1
fi

echo ""
echo "SUCCESS: Release App Bundle created:"
echo "$AAB"
echo "The development test-ad bundle will now be restored."
