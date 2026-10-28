# CONDUIT source archive audit (2026-10-27)

This cleaned package retains the latest top-level project sources supplied in Archive.zip. Removed node_modules (reinstall with npm ci), macOS resource-fork metadata, dated backups, and an old patch preparation directory. No game logic or live production build script was edited.

IMPORTANT: This ZIP contains no native android/ directory or Gradle wrapper. To build the Android app, combine this package with the separately provided, reviewed native Android project folder. Ensure versions/configurations match before running npm ci, npx cap sync android, and build-android-production.sh.

The included www/admob-bridge.js is the DEVELOPMENT test-ad bundle. The production script temporarily generates the release variant; it restores the development bundle afterward. Verify production AdMob and consent behavior in Play internal testing.

Before release: inspect target SDK and versionCode in android/, confirm Play signing, test rewarded-ad/cancel paths and offline puzzles, review child-directed consent settings, and do not commit keystores.
