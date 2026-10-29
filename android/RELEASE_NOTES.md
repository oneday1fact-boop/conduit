# CONDUIT Android release source (sanitized)

This folder is the user's **existing Android native project**, cleaned of generated output, backup copies, Mac-specific settings and signing material. It is not standalone: the sibling project root's `package.json` and matching `node_modules` containing `@capacitor/android` and `@capacitor-community/admob` are required.

- Actual embedded web game: `app/src/main/assets/public/index.html`.
- Offline puzzles: `app/src/main/assets/public/puzzle-library.json`.
- The staged AdMob JS bridge currently contains development test ads. Use the root production script to prepare live Android ads; it restores development assets after the build.
- No gameplay logic was intentionally changed.
- `app/build.gradle` excludes backup files during packaging; historical back-ups were removed from `assets/public`.
- App ID: `com.oneday1fact.conduit`; target SDK 36; next candidate versionCode 2 / versionName 1.0.1 (increase for each Play update).
- Before building, verify AdMob consent/age declarations and use Google Play internal testing.
- Signing is read from `~/.conduit-signing/key.properties`; do not commit or share it.
- For the full release process, see the GitHub `ANDROID_RELEASE.md`.

Typical commands from the **original Capacitor project root** (not this Android folder):

```sh
npm ci
npx cap sync android
cd android && ./gradlew bundleRelease
```

**CAUTION**: `npx cap sync android` can overwrite staged assets from a different `webDir`, so first ensure the Capacitor web source has the same production bridge and game assets. After sync, re-check `assets/public/admob-bridge.js` before building.
