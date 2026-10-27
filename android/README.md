# CONDUIT — Complete Android release source

This folder combines the supplied web/Capacitor source and native Android Studio project. It is intended for version control after review.

## Restore

1. Install Node.js and a compatible JDK/Android SDK.
2. Run `npm ci` from this folder.
3. Run `npx cap sync android`.
4. For a production signed AAB, set up the original upload signing keystore securely outside Git, following `build-android-production.sh`, then execute `bash build-android-production.sh`.

Never commit signing keys, `key.properties`, Google Play credentials, `node_modules`, Gradle caches, or build outputs. Keep the original signing keystore and its passwords in a secure independent backup.

The development web assets contain test ads; the production script temporarily switches them to production ads. The `release-reference/` file is only a copy of the bridge in the uploaded AAB for audit, not an automatic replacement for source.

This project has not been successfully built or runtime-tested in this environment. Verify with Gradle and Play Console internal testing before shipping.

The Google Play Console generally accepts the signed `.aab`, while the `.apk` is helpful for local installation/testing.
