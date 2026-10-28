#!/bin/bash
# The Capacitor project root owns www/, dependencies and the release build.
set -euo pipefail
exec bash "$(dirname "$0")/../build-android-production.sh" "$@"
