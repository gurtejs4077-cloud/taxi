# Grand RideApp — Build Android APK

## Quick Start (Linux / macOS)

```bash
bash scripts/setup-and-build.sh
```
That's it. The script installs everything and outputs the APK path.

---

## Quick Start (Windows)

Double-click `scripts/setup-and-build.bat`
*(requires Android Studio already installed for the SDK)*

---

## Prerequisites

| Tool | Min version | Install |
|------|-------------|---------|
| **JDK** | 17 | `sudo apt install openjdk-17-jdk` |
| **Node.js** | 18 | https://nodejs.org |
| **npm** | 9 | bundled with Node |
| **Android SDK** | API 34 | Auto-installed by script on Linux/macOS |

---

## Manual Step-by-Step

### 1 — Install dependencies
```bash
npm install
```

### 2 — Set Android SDK path
```bash
export ANDROID_HOME="$HOME/Android/Sdk"
export ANDROID_SDK_ROOT="$ANDROID_HOME"
export PATH="$PATH:$ANDROID_HOME/cmdline-tools/latest/bin:$ANDROID_HOME/platform-tools"
```

### 3 — Install SDK components (first time only)
```bash
sdkmanager "platform-tools" "platforms;android-34" "build-tools;34.0.0"
yes | sdkmanager --licenses
```

### 4 — Sync web assets
```bash
npm run www:sync
```

### 5 — Add Android platform (first time only)
```bash
npx cap add android
```

### 6 — Capacitor sync
```bash
npx cap sync android
```

### 7 — Build the APK
```bash
echo "sdk.dir=$ANDROID_HOME" > android/local.properties
cd android
chmod +x gradlew
./gradlew assembleDebug
```

### 8 — Find your APK
```
android/app/build/outputs/apk/debug/app-debug.apk
```

---

## Install on your phone

**Via USB (ADB):**
```bash
adb install android/app/build/outputs/apk/debug/app-debug.apk
```

**Direct install:**
1. Copy `app-debug.apk` to your Android phone
2. Open a file manager → tap the APK
3. Allow "Install from unknown sources" if prompted
4. Install ✓

---

## Release / signed APK (for Play Store)

Generate a keystore:
```bash
keytool -genkey -v -keystore rideapp-release.jks \
  -alias rideapp -keyalg RSA -keysize 2048 -validity 10000
```

Build signed release APK:
```bash
cd android
./gradlew assembleRelease \
  -Pandroid.injected.signing.store.file=../rideapp-release.jks \
  -Pandroid.injected.signing.store.password=YOUR_STORE_PASS \
  -Pandroid.injected.signing.key.alias=rideapp \
  -Pandroid.injected.signing.key.password=YOUR_KEY_PASS
```

Output: `android/app/build/outputs/apk/release/app-release.apk`

---

## Firebase Storage Rules

Add these rules in Firebase Console → Storage → Rules:

```
rules_version = '2';
service firebase.storage {
  match /b/{bucket}/o {
    match /profile_photos/{uid} {
      allow read: if true;
      allow write: if request.auth != null && request.auth.uid == uid;
    }
  }
}
```

---

## Troubleshooting

**`ANDROID_HOME not set`** — Run `export ANDROID_HOME=~/Android/Sdk` before building.

**`SDK location not found`** — Check that `android/local.properties` has `sdk.dir=...`

**`License not accepted`** — Run `yes | sdkmanager --licenses`

**`Capacitor: webDir does not exist`** — Run `npm run www:sync` first.

**Camera/file permissions on Android** — Already handled by `androidScheme: https` in `capacitor.config.json`. For production, add camera plugin: `npm install @capacitor/camera`.

