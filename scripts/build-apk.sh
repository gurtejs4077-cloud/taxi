#!/usr/bin/env bash
# Build a debug APK from the terminal (no Android Studio UI).
# Needs: JDK 17+, Android SDK, and ANDROID_HOME (see below).

set -e
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"

if [[ -z "${ANDROID_HOME:-}" && -z "${ANDROID_SDK_ROOT:-}" ]]; then
  echo "Set ANDROID_HOME to your Android SDK path, e.g.:"
  echo "  export ANDROID_HOME=\"\$HOME/Android/Sdk\""
  echo "Install SDK command-line tools: https://developer.android.com/studio#command-line-tools-only"
  exit 1
fi

export ANDROID_SDK_ROOT="${ANDROID_SDK_ROOT:-$ANDROID_HOME}"

npm run cap:sync

if [[ ! -d "$ROOT/android" ]]; then
  echo "First time: npx cap add android"
  npx cap add android
fi

# Tell Gradle where the SDK is (same as Studio would write).
echo "sdk.dir=${ANDROID_SDK_ROOT}" > "$ROOT/android/local.properties"

cd "$ROOT/android"
chmod +x gradlew 2>/dev/null || true
./gradlew assembleDebug

echo ""
echo "Debug APK:"
echo "  $ROOT/android/app/build/outputs/apk/debug/app-debug.apk"
