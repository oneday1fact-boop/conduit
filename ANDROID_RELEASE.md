# CONDUIT Android release guide

This repository currently contains the web game source. It is **not yet a complete reproducible Android Studio project**. The native Android project used to produce the uploaded APK/AAB must be added before CI can build signed releases. Do not upload signing keys, passwords, or Google Play service-account credentials.

## Inspected release artifacts (27 October 2026)

- Uploaded file: `app-release(1).aab` (artifact is intentionally not tracked in Git).
- Capacitor application ID bundled into Android: `com.oneday1fact.conduit`.
- The Android bundle contains `base/assets/public/index.html`, `base/assets/public/puzzle-library.json` and `base/assets/public/admob-bridge.js`.
- The AAB and uploaded release APK share the same bundled game HTML and puzzle library.
- The **AAB and APK advertising bridge files differ**. Verify the production Android ads behavior using the AAB-derived app in Google Play internal testing.
- GitHub's `index.html` is not identical to the game HTML packaged in the AAB. Do not overwrite either one automatically; compare and merge deliberately.
- The web assets packaged in the app include old development/back-up files. Exclude these from future release packaging after verifying they are not referenced.
- A static file inspection cannot prove device compatibility, puzzle quality, AdMob delivery, store approval, or absence of crashes.

## Before publishing to Google Play

1. **Source of truth:** add the actual Android project (Gradle wrapper, root and app Gradle files, AndroidManifest.xml, Java/Kotlin sources, Capacitor configuration and plugins, and original web assets) in a separate reviewed change. Exclude build outputs and all credentials.
2. **Reproducibility:** use a pinned Android Gradle Plugin, Gradle, Java and Capacitor version; document local build steps and verify a clean build produces the same functionality.
3. **Bundle validation:** check package/application ID, monotonically increasing versionCode, target SDK per current Play rules, min SDK, ABI support, Play App Signing, release debuggability and permissions with Android Studio Bundle Analyzer or bundletool.
4. **AdMob:** verify app ID and ad unit IDs, production versus test behavior, child-directed/family settings where applicable, consent flows, privacy policy and Data safety disclosure. Do not click your own live ads. A production ad ID alone does not prove approval or live delivery.
5. **Game QA:** test onboarding, every puzzle rule, saved progress, offline and online modes, worker/API failure fallbacks, reward granted exactly once, ad failure/cancel paths, app background/restore, and network loss.
6. **Play internal test:** upload the AAB to an internal track, install via Play on several Android versions and screen sizes, then review Android vitals and pre-launch report before promoting the release.
7. **Store listing:** provide appropriate screenshots, icon, feature graphic, content rating, privacy policy URL, developer contact and required Play Console declarations.

## Build commands (after the native Android project is committed)

From the Capacitor project root, the usual workflow is:

```sh
npm ci
npm run build # only if this project defines a build step
npx cap sync android
cd android
./gradlew bundleRelease
```

The output is normally `android/app/build/outputs/bundle/release/app-release.aab`. **This is illustrative, not yet executable in this repository**, because the Android sources and package scripts have not been provided here. Configure signing securely in a local protected setup or CI secrets, not in tracked source.

## Repository protection

The root `.gitignore` excludes APK/AAB artifacts and signing secrets from new commits. Note that ignore rules do not remove files that have already been tracked: remove historical credentials from Git history separately if any are found.
