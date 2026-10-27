# Android release source (in progress)

Selected native Android source/configuration files from the supplied `android.zip` have been added in this review branch. This is **not yet a complete Android Studio build checkout**: resources, generated Capacitor plugin modules and embedded web assets must also be synchronized.

A full sanitized copy of the supplied Android folder, including those remaining native resources and web assets, is supplied separately as `conduit-android-release-source.zip` in this ChatGPT conversation. It is not hosted here on GitHub yet.

## Changes verified
- Gradle Android target SDK 36 and application ID `com.oneday1fact.conduit` retained.
- Original AAB's production `admob-bridge.js` replaces the test-only bridge inside the downloadable cleaned source ZIP.
- Generated build intermediates, machine-specific `local.properties`, and historical web backups removed from the downloadable ZIP.
- Signing properties remain outside the repository at `~/.conduit-signing/key.properties`.
- Original game's HTML and 800-puzzle library not modified.

See [../ANDROID_RELEASE.md](../ANDROID_RELEASE.md) for release checklist. Before any Play upload, synchronize the **full** source into the repo, provide the parent Capacitor `package.json` / lockfile and verify the clean build on a device. The checked-in Gradle fragments alone are not sufficient to build.
