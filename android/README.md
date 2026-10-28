# CONDUIT native Android project

This is the native Gradle project. The Capacitor project root is one directory above it; dependencies, `capacitor.config.json`, `www/` and the canonical production script live there.

From the repository root, run `npm ci`, then follow [ANDROID_RELEASE.md](../ANDROID_RELEASE.md). From this directory, `bash build-android-production.sh` delegates to the root script.

Do not run `npm ci` or `cap sync android` here using the historical duplicate package/configuration files. Do not commit signing credentials or generated APK/AAB files.
