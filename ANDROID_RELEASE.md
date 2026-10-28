# CONDUIT Android release guide

The complete Capacitor project is at the repository root. Use `www/` as the Android web source. The root `index.html` is a different web build: do not copy it over `www/index.html` because it lacks the native rewarded-hint integration.

## Next internal candidate

- Application ID and namespace: `com.oneday1fact.conduit` (unchanged).
- Version code: **2**; version name: **1.0.1**. Verify no newer code has been uploaded before building/uploading.
- Minimum SDK: 24; compile/target SDK: 36 (unchanged).
- Gradle: 8.14.3; AGP: 8.13.0. Use JDK 21 and an Android SDK installation with API 36.
- Signing: keep the existing upload keystore and `~/.conduit-signing/key.properties`. The script also expects `~/.conduit-signing/conduit-upload.jks`. Never generate a replacement key for an ordinary update.
- Keep the Capacitor origin/configuration, localStorage keys, puzzle IDs and puzzle ordering stable to preserve existing progress. Do not uninstall or clear app data for upgrade testing.
- No billing/premium implementation is added by this update. Rewarded hints remain user initiated; no banner or interstitial ads are added.

## Build from the project root

```sh
npm ci
node scripts/validate-source.cjs
node scripts/test-release-build.cjs
bash build-android-production.sh
```

The script prepares production Android rewarded ads while retaining the source's child-directed, under-age and maximum-content-rating settings. It syncs `www/`, builds the signed AAB, then restores development test ads in both `www/` and staged Android assets. The AAB already produced keeps the production assets. The wrapper `android/build-android-production.sh` delegates here; do not treat `android/` as a second Capacitor project.

Output: `android/app/build/outputs/bundle/release/app-release.aab`.

Running only `npx cap sync android` and `bundleRelease` packages the development test-ad bridge. Use the production script for the intended live-ad candidate. Use approved test devices during ad testing; do not click your own live ads.

## Checks before upload

1. Inspect the AAB's package, version, target SDK, permissions and signer certificate. Confirm the signer matches the original upload key. Check that no development/backup files are packaged.
2. Review Data safety, Advertising ID, target audience/Families and privacy policy against the final SDKs and actual data flows. Keep sensitive declaration changes pending owner approval.
3. The current source has consent and child-directed settings absent from the older v1 production bridge. Validate these changes on real Android devices, including unavailable/cancelled ads, reward granted once, consent failures and regional flows.
4. Upgrade the existing Play-installed version without uninstalling. Verify records, streak, preferences, offline play, remote-library fallback, date rollover, three practice puzzles and touch input.
5. Test phones/tablets and any enabled PC/XR form factors. Inspect pre-launch results and Android vitals once available.
6. Prepare the internal-track release, show the exact AAB/version, release notes and declaration changes to the owner, and obtain approval before rollout/submission. Do not promote to production.

## Suggested en-US internal release notes

Internal maintenance update. Retains the current puzzles and saved-progress format. Includes updated rewarded-hint consent safeguards and cleaner release packaging.

These notes describe the prepared source relative to version 1, not a verified device build. Do not claim a successful native build until it completes with the original signing setup.

## Validation limits

Source/puzzle checks, Capacitor sync, ad transformation/bundling and mocked build-cleanup checks can run without signing material. They do not prove native build success, SDK policy compliance, ad delivery or upgrade preservation. A clean native build and device upgrade test remain required.
